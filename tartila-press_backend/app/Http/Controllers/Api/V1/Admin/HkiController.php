<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\HkiRecord;
use App\Services\HkiService;
use App\Services\Notifier;
use App\Services\PublicationProcessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/** Admin: daftar karya ber-HKI, status pengurusan, sertifikat. */
class HkiController extends Controller
{
    public function __construct(
        private readonly HkiService $hki,
        private readonly Notifier $notifier,
        private readonly PublicationProcessService $publication,
    ) {}

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?status=<status HKI>, ?search= (judul/sumber/penulis).
        // meta.counts = jumlah per status (sebelum filter status), meta.statuses = label.
        $entries = collect($this->hki->entries());
        $keyword = mb_strtolower(trim((string) $request->query('search', '')));

        if ($keyword !== '') {
            $entries = $entries->filter(fn (array $entry) => str_contains(
                mb_strtolower(implode(' ', [$entry['title'], $entry['source'], ...array_column($entry['authors'], 'name')])),
                $keyword
            ));
        }

        $counts = $entries->countBy(fn (array $entry) => $entry['hki']['status']);
        $status = (string) $request->query('status', '');

        if (array_key_exists($status, HkiRecord::STATUSES)) {
            $entries = $entries->where('hki.status', $status);
        }

        return $this->pageResponse(
            $this->paginateCollection($entries->values(), $request, 20),
            'Daftar HKI berhasil diambil.',
            meta: [
                'statuses' => HkiRecord::STATUSES,
                'counts' => ['all' => $counts->sum()] + $counts->all(),
            ]
        );
    }

    public function update(Request $request, string $subjectType, int $subjectId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(HkiRecord::STATUSES))],
            'application_number' => ['nullable', 'string', 'max:100'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'registered_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $record = $this->record($request, $subjectType, $subjectId);
        $previous = $record->status;
        $record->update($validated + ['updated_by' => $request->user()->id]);
        $this->publication->recordHki($record, $previous, $request->user());

        return response()->json(['success' => true, 'message' => 'Data HKI disimpan.', 'data' => $record->fresh()]);
    }

    /** Unggah sertifikat HKI (PDF/gambar) — tampil untuk semua penulis karya. */
    public function uploadCertificate(Request $request, string $subjectType, int $subjectId): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $record = $this->record($request, $subjectType, $subjectId);
        $file = $request->file('file');
        $old = $record->certificate_path;
        $previous = $record->status;
        $path = $file->storeAs('hki-certificates/'.$record->id, Str::random(24).'.'.strtolower($file->extension()), 'local');

        $record->update([
            'certificate_path' => $path,
            'certificate_name' => Str::limit($file->getClientOriginalName(), 200, ''),
            'certificate_uploaded_at' => now(),
            'status' => 'registered',
            'updated_by' => $request->user()->id,
        ]);

        if ($old && $old !== $path) {
            Storage::disk('local')->delete($old);
        }

        $this->publication->recordHki($record, $previous, $request->user());

        $title = $this->hki->titleOf($record);
        $this->notifier->notify(
            $this->hki->authorsOf($record),
            'certificate',
            'Sertifikat HKI tersedia',
            $title,
            '/dashboard/sertifikat-saya',
            ['subject_type' => 'hki', 'subject_id' => $record->id, 'email' => true, 'email_lines' => [
                "Sertifikat HKI untuk karya \"{$title}\" sudah terbit dan bisa diunduh di menu Sertifikat Saya.",
            ]]
        );

        return response()->json(['success' => true, 'message' => 'Sertifikat HKI diunggah dan dikirim ke semua penulis.', 'data' => $record->fresh()]);
    }

    public function deleteCertificate(HkiRecord $hkiRecord): JsonResponse
    {
        if ($hkiRecord->certificate_path) {
            Storage::disk('local')->delete($hkiRecord->certificate_path);
        }

        $hkiRecord->update(['certificate_path' => null, 'certificate_name' => null, 'certificate_uploaded_at' => null]);

        return response()->json(['success' => true, 'message' => 'Sertifikat HKI dihapus.']);
    }

    public function downloadCertificate(Request $request, HkiRecord $hkiRecord): Response
    {
        return self::certificateResponse($hkiRecord, $request->boolean('inline'));
    }

    /** Berkas sertifikat (unduh atau tampil di browser). */
    public static function certificateResponse(HkiRecord $record, bool $inline): Response
    {
        abort_unless($record->certificate_path && Storage::disk('local')->exists($record->certificate_path), 404, 'Sertifikat HKI belum diunggah.');

        $extension = pathinfo($record->certificate_path, PATHINFO_EXTENSION);
        $name = Str::slug(pathinfo((string) $record->certificate_name, PATHINFO_FILENAME) ?: 'sertifikat-hki').'.'.$extension;
        $response = Storage::disk('local')->response($record->certificate_path, $name, [
            'Access-Control-Expose-Headers' => 'Content-Disposition',
            'Cache-Control' => 'private, no-store',
        ]);

        if (! $inline) {
            $response->headers->set('Content-Disposition', 'attachment; filename="'.$name.'"');
        }

        return $response;
    }

    /** Catatan HKI karya ini (dibuat kalau belum ada); karya harus ada di daftar HKI. */
    private function record(Request $request, string $subjectType, int $subjectId): HkiRecord
    {
        abort_unless(in_array($subjectType, HkiRecord::SUBJECTS, true), 404);

        $record = HkiRecord::where('subject_type', $subjectType)->where('subject_id', $subjectId)->first();

        if ($record) {
            return $record;
        }

        abort_unless($this->hki->exists($subjectType, $subjectId), 404, 'Karya ini tidak memiliki layanan HKI.');

        return HkiRecord::create([
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'status' => 'pending',
            'updated_by' => $request->user()->id,
        ]);
    }
}
