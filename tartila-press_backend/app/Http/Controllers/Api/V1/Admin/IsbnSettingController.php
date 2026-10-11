<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Isbn\IsbnApplicationController as UserIsbnApplicationController;
use App\Http\Controllers\Controller;
use App\Models\IsbnApplication;
use App\Models\IsbnLetterSetting;
use App\Services\IsbnApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Template surat ISBN: data penerbit, teks surat, kop (logo), serta tanda
 * tangan dan stempel penanggung jawab. Berkas gambar disimpan di disk privat
 * dan hanya admin yang bisa membacanya.
 */
class IsbnSettingController extends Controller
{
    private const ASSETS = [
        'logo' => 'logo_path',
        'signature' => 'signature_path',
        'stamp' => 'stamp_path',
    ];

    public function __construct(private readonly IsbnApplicationService $service) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pengaturan surat ISBN berhasil diambil.',
            'data' => $this->present(IsbnLetterSetting::current()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'city' => ['required', 'string', 'max:100'],
            'publisher_name' => ['required', 'string', 'max:150'],
            'publisher_address' => ['required', 'string', 'max:500'],
            'website' => ['nullable', 'string', 'max:150'],
            'email' => ['nullable', 'string', 'max:150'],
            'responsible_name' => ['required', 'string', 'max:150'],
            'admin_name' => ['nullable', 'string', 'max:150'],
            'letter_code' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9\/\-]+$/'],
            'subject' => ['required', 'string', 'max:200'],
            'recipient' => ['required', 'string', 'max:500'],
            'application_body' => ['required', 'string', 'max:2000'],
            'application_closing' => ['required', 'string', 'max:1000'],
            'statement_body' => ['required', 'string', 'max:1000'],
            'statement_closing' => ['required', 'string', 'max:1000'],
        ]);

        $setting = IsbnLetterSetting::current();
        $setting->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Template surat disimpan.',
            'data' => $this->present($setting->fresh()),
        ]);
    }

    /** Kembalikan semua teks ke surat contoh bawaan (gambar tidak berubah). */
    public function reset(): JsonResponse
    {
        $setting = IsbnLetterSetting::current();
        $setting->update(IsbnLetterSetting::DEFAULTS);

        return response()->json([
            'success' => true,
            'message' => 'Template dikembalikan ke surat bawaan.',
            'data' => $this->present($setting->fresh()),
        ]);
    }

    public function uploadAsset(Request $request, string $kind): JsonResponse
    {
        $column = $this->column($kind);

        $request->validate([
            'file' => ['required', 'file', 'mimes:png,jpg,jpeg', 'max:3072'],
        ]);

        $file = $request->file('file');
        $this->assertSupported($file);

        $setting = IsbnLetterSetting::current();
        $this->deleteFile($setting->{$column});

        $path = $file->storeAs('isbn/assets', $kind.'-'.Str::random(10).'.'.($file->guessExtension() === 'png' ? 'png' : 'jpg'), 'local');
        $setting->update([$column => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Gambar disimpan.',
            'data' => $this->present($setting->fresh()),
        ]);
    }

    public function deleteAsset(string $kind): JsonResponse
    {
        $column = $this->column($kind);
        $setting = IsbnLetterSetting::current();

        $this->deleteFile($setting->{$column});
        $setting->update([$column => null]);

        return response()->json([
            'success' => true,
            'message' => 'Gambar dihapus.',
            'data' => $this->present($setting->fresh()),
        ]);
    }

    public function asset(string $kind): Response
    {
        $path = IsbnLetterSetting::current()->{$this->column($kind)};

        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return response(Storage::disk('local')->get($path), 200, [
            'Content-Type' => str_ends_with($path, '.png') ? 'image/png' : 'image/jpeg',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** Pratinjau template dengan data contoh, lengkap dengan tanda tangan + stempel. */
    public function preview(): Response
    {
        $application = new IsbnApplication([
            'type' => IsbnApplication::TYPE_REGULAR,
            'title' => 'Contoh Judul Buku',
            'authors_text' => 'Nama Penulis, S.Pd.',
            'availability_link' => 'https://www.tartilapress.com',
            'letter_number' => '001/'.IsbnLetterSetting::current()->letter_code.'/X/'.now()->year,
            'letter_date' => now(),
            'applicant_data' => [
                'name' => 'Nama Penulis, S.Pd.',
                'address' => 'Jl. Contoh No. 1, Kota Contoh',
                'nik' => '0000000000000000',
                'phone' => '081200000000',
            ],
        ]);

        return UserIsbnApplicationController::pdfResponseFor(
            $this->service->pdf($application, sealed: true),
            $application,
            true
        );
    }

    private function column(string $kind): string
    {
        abort_unless(isset(self::ASSETS[$kind]), 404);

        return self::ASSETS[$kind];
    }

    /** tFPDF membaca PNG 8-bit tanpa interlace saja; tolak yang lain dengan pesan jelas. */
    private function assertSupported(UploadedFile $file): void
    {
        $bytes = (string) file_get_contents($file->getRealPath());

        if (str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) {
            abort_if(
                strlen($bytes) < 30 || ord($bytes[24]) !== 8 || ord($bytes[28]) !== 0,
                422,
                'PNG harus 8-bit dan tidak interlace. Ekspor ulang gambarnya, atau pakai JPG.'
            );

            return;
        }

        abort_unless(str_starts_with($bytes, "\xFF\xD8"), 422, 'Berkas bukan gambar PNG/JPG yang valid.');
    }

    private function deleteFile(?string $path): void
    {
        if ($path && Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function present(IsbnLetterSetting $setting): array
    {
        return [
            ...$setting->only(IsbnLetterSetting::TEXT_FIELDS),
            'has_logo' => (bool) $setting->logo_path,
            'has_signature' => (bool) $setting->signature_path,
            'has_stamp' => (bool) $setting->stamp_path,
            'defaults' => IsbnLetterSetting::DEFAULTS,
        ];
    }
}
