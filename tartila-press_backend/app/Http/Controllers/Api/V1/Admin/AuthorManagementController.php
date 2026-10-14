<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminUserNote;
use App\Models\Book;
use App\Models\Manuscript;
use App\Models\User;
use App\Models\WalletWithdrawal;
use App\Services\AuthorProgressService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Kelola Penulis: daftar penulis dengan bidang, buku terbit, naskah dalam proses, royalti,
 * royalti yang belum dicairkan, serta catatan progres/hak yang belum selesai.
 */
class AuthorManagementController extends Controller
{
    public function __construct(
        private readonly WalletService $wallet,
        private readonly AuthorProgressService $progress,
    ) {}

    public function index(): JsonResponse
    {
        $authors = User::where(fn ($query) => $query
            ->whereHas('roles', fn ($roles) => $roles->where('name', 'penulis'))
            ->orWhereHas('manuscriptAuthorLinks'))
            ->orderBy('name')
            ->get();

        $ids = $authors->pluck('id');

        $manuscripts = Manuscript::whereHas('authorLinks', fn ($query) => $query->whereIn('user_id', $ids))
            ->with(['authorLinks:id,manuscript_id,user_id', 'mou.signatories', 'book:id,manuscript_id,title,isbn', 'bookChapter:id,manuscript_id,book_id'])
            ->get()
            ->flatMap(fn (Manuscript $manuscript) => $manuscript->authorLinks->map(fn ($link) => [$link->user_id, $manuscript]))
            ->groupBy(0)
            ->map(fn ($pairs) => $pairs->pluck(1));

        $withdrawn = WalletWithdrawal::whereIn('user_id', $ids)
            ->whereIn('status', ['paid', 'pending'])
            ->select('user_id', DB::raw('SUM(amount) as total'))
            ->groupBy('user_id')
            ->pluck('total', 'user_id');

        $notes = AdminUserNote::whereIn('user_id', $ids)->pluck('note', 'user_id');

        $rows = $authors->map(function (User $author) use ($manuscripts, $withdrawn, $notes) {
            $mine = $manuscripts->get($author->id, collect());
            $books = Book::publishedByAuthor($author->id)->with('fieldCategory:id,name')->get(['id', 'title', 'field_category_id']);

            // Royalti hanya ada bila punya buku terbit (hemat query untuk penulis yang belum terbit).
            $royalty = $books->isEmpty() ? 0.0 : round($this->wallet->royaltyEntries($author)->sum('amount'), 2);

            return [
                'id' => $author->id,
                'name' => $author->name,
                'email' => $author->email,
                'fields' => $books->map(fn (Book $book) => $book->fieldCategory?->name)->filter()->unique()->values(),
                'published_books' => $books->count(),
                'in_process' => $mine->where('status', '!=', 'completed')->count(),
                'royalty_total' => $royalty,
                // Perkiraan: royalti dikurangi penarikan (penarikan dompet dipakai bersama fee lain).
                'royalty_unclaimed' => max(0, round($royalty - (float) ($withdrawn[$author->id] ?? 0), 2)),
                'notes' => $this->progress->notesFor($author->id, $mine),
                'admin_note' => $notes[$author->id] ?? null,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Daftar penulis berhasil diambil.',
            'data' => $rows->values(),
        ]);
    }

    /** Simpan catatan admin untuk seorang penulis (kosong = hapus). */
    public function note(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['note' => ['nullable', 'string', 'max:5000']]);

        $note = trim((string) ($validated['note'] ?? ''));

        if ($note === '') {
            AdminUserNote::where('user_id', $user->id)->delete();
        } else {
            AdminUserNote::updateOrCreate(['user_id' => $user->id], ['note' => $note, 'updated_by' => $request->user()->id]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Catatan disimpan.',
            'data' => ['id' => $user->id, 'admin_note' => $note === '' ? null : $note],
        ]);
    }
}
