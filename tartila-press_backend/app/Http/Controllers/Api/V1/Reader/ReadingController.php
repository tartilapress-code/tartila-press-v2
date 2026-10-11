<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderBookmark;
use App\Services\Reader\ReaderAccessService;
use App\Services\Reader\ReaderReadingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/** Membaca: berkas PDF (hanya yang berhak), hitungan baca, posisi terakhir, penanda halaman. */
class ReadingController extends Controller
{
    public function __construct(
        private readonly ReaderAccessService $access,
        private readonly ReaderReadingService $reading,
    ) {}

    /** Berkas ebook; mendukung Range supaya PDF.js bisa memuat bertahap. */
    public function file(Request $request, ReaderBook $readerBook): Response
    {
        $this->authorizeRead($request, $readerBook);

        abort_unless($readerBook->hasFile() && Storage::disk('local')->exists($readerBook->file_path), 404, 'Berkas buku belum tersedia.');

        return response()->file(Storage::disk('local')->path($readerBook->file_path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="buku.pdf"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Access-Control-Expose-Headers' => 'Accept-Ranges, Content-Range, Content-Length',
        ]);
    }

    /** Catat halaman yang dibuka (satu pembaca-halaman-hari dihitung 1). */
    public function reads(Request $request, ReaderBook $readerBook): JsonResponse
    {
        $this->authorizeRead($request, $readerBook);

        $validated = $request->validate([
            'pages' => ['required', 'array', 'min:1', 'max:'.ReaderReadingService::MAX_PAGES_PER_CALL],
            'pages.*' => ['integer', 'min:1'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Bacaan dicatat.',
            'data' => $this->reading->record($request->user(), $readerBook, $validated['pages']),
        ]);
    }

    public function progress(Request $request, ReaderBook $readerBook): JsonResponse
    {
        $this->authorizeRead($request, $readerBook);

        $validated = $request->validate(['page' => ['required', 'integer', 'min:1', 'max:'.max(1, $readerBook->page_count)]]);

        DB::table('reader_progress')->updateOrInsert(
            ['user_id' => $request->user()->id, 'reader_book_id' => $readerBook->id],
            ['last_page' => $validated['page'], 'last_read_at' => now(), 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['success' => true, 'message' => 'Posisi baca disimpan.', 'data' => ['page' => $validated['page']]]);
    }

    public function bookmarks(Request $request, ReaderBook $readerBook): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Penanda berhasil diambil.',
            'data' => ReaderBookmark::where('user_id', $request->user()->id)
                ->where('reader_book_id', $readerBook->id)->orderBy('page')->get(['id', 'page', 'note']),
        ]);
    }

    /** Menandai halaman; menandai lagi halaman yang sama memperbarui catatannya. */
    public function storeBookmark(Request $request, ReaderBook $readerBook): JsonResponse
    {
        $this->authorizeRead($request, $readerBook);

        $validated = $request->validate([
            'page' => ['required', 'integer', 'min:1', 'max:'.max(1, $readerBook->page_count)],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $bookmark = ReaderBookmark::updateOrCreate(
            ['user_id' => $request->user()->id, 'reader_book_id' => $readerBook->id, 'page' => $validated['page']],
            ['note' => $validated['note'] ?? null]
        );

        return response()->json(['success' => true, 'message' => 'Halaman ditandai.', 'data' => $bookmark->only(['id', 'page', 'note'])], 201);
    }

    public function destroyBookmark(Request $request, ReaderBookmark $bookmark): JsonResponse
    {
        abort_unless($bookmark->user_id === $request->user()->id, 403, 'Penanda ini bukan milik Anda.');
        $bookmark->delete();

        return response()->json(['success' => true, 'message' => 'Penanda dihapus.']);
    }

    private function authorizeRead(Request $request, ReaderBook $readerBook): void
    {
        abort_unless(ReaderBook::listed()->whereKey($readerBook->id)->exists(), 404, 'Buku tidak ditemukan.');

        $access = $this->access->evaluate($request->user(), $readerBook);

        abort_unless($access['allowed'], 403, 'Buku ini terkunci. Berlangganan atau beli buku ini untuk membacanya.');
    }
}
