<?php

namespace App\Http\Controllers\Api\V1\Manuscript;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ManuscriptController extends Controller
{
    private const MANUSCRIPT_UPLOAD_RULES = [
        'file',
        'mimes:pdf,doc,docx,odt',
        'max:20480',
    ];

    /*
    |--------------------------------------------------------------------------
    | Store - Penulis submit naskah pertama kali
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'order_id' => ['required', 'integer'],
            'title' => ['nullable', 'string', 'max:255'],
            'author_user_ids' => ['nullable', 'array', 'max:10'],
            'author_user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'file' => self::MANUSCRIPT_UPLOAD_RULES,
            'author_bio_photo' => ['nullable', 'string', 'max:500'],
            'author_bio_name' => ['nullable', 'string', 'max:255'],
            'author_bio_text' => ['nullable', 'string', 'max:5000'],
        ]);

        $order = Order::where('id', $validated['order_id'])
            ->where('user_id', $user->id)
            ->first();

        abort_unless($order, 404, 'Pesanan tidak ditemukan.');

        abort_unless(
            $order->status === 'confirmed',
            422,
            'Pesanan harus berstatus dikonfirmasi sebelum naskah bisa disubmit.'
        );

        abort_if(
            $order->items()->where('itemable_type', Book::class)->exists(),
            422,
            'Pesanan ini adalah pembelian buku, tidak memerlukan submit naskah.'
        );

        abort_if(
            Manuscript::where('order_id', $order->id)->exists(),
            422,
            'Naskah untuk pesanan ini sudah pernah disubmit.'
        );

        $chapter = $order->bookChapterSlot()->whereNull('manuscript_id')->with('book')->first();

        if ($chapter) {
            $title = $chapter->book->title.' — '.$chapter->title;
            $authorUserIds = [$user->id];
        } else {
            abort_if(blank($validated['title'] ?? null), 422, 'Judul buku wajib diisi.');

            $title = $validated['title'];
            $authorUserIds = collect($validated['author_user_ids'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

            if (! in_array($user->id, $authorUserIds, true)) {
                array_unshift($authorUserIds, $user->id);
            }
        }

        $usersById = User::with('publicProfile')->whereIn('id', $authorUserIds)->get()->keyBy('id');
        $authorNames = collect($authorUserIds)
            ->map(fn (int $id) => $usersById[$id]->publicProfile?->pen_name ?: $usersById[$id]->name)
            ->all();

        $manuscript = DB::transaction(function () use ($request, $validated, $user, $order, $title, $authorUserIds, $authorNames) {

            $manuscript = Manuscript::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'title' => $title,
                'authors' => $authorNames,
                'status' => 'submitted',
                'author_bio_photo' => $validated['author_bio_photo'] ?? null,
                'author_bio_name' => $validated['author_bio_name'] ?? null,
                'author_bio_text' => $validated['author_bio_text'] ?? null,
            ]);

            foreach ($authorUserIds as $index => $authorUserId) {
                $manuscript->authorLinks()->create([
                    'user_id' => $authorUserId,
                    'position' => $index + 1,
                ]);
            }

            $this->storeRevision(
                $manuscript,
                $request->file('file'),
                $user->id,
                'penulis'
            );

            $this->linkBookChapterSlot($order, $manuscript);

            return $manuscript;
        });

        return response()->json([
            'success' => true,
            'message' => 'Naskah berhasil disubmit.',
            'data' => $manuscript->load('revisions'),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Mine - Naskah milik penulis sendiri
    |--------------------------------------------------------------------------
    */

    public function mine(Request $request): JsonResponse
    {
        $manuscripts = Manuscript::whereHas(
            'authorLinks',
            fn ($query) => $query->where('user_id', $request->user()->id)
        )
            ->with(['revisions', 'editor'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah berhasil diambil.',
            'data' => $manuscripts,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail naskah
    |--------------------------------------------------------------------------
    */

    public function show(Request $request, Manuscript $manuscript): JsonResponse
    {
        $this->ensureCanView($request, $manuscript);

        $manuscript->load(['revisions.uploader', 'editor', 'user', 'book', 'bookChapter.book', 'authorLinks.user']);
        $manuscript->append('co_authors');

        // Hanya untuk admin: saat approve, admin wajib mengisi fee bila penulis
        // memilih editor langsung. Data order lainnya tidak ikut terkirim.
        if ($request->user()->roles()->where('name', 'admin')->exists()) {
            $order = $manuscript->order()->with('editor:id,name')->first();

            $manuscript->setAttribute(
                'author_chosen_editor',
                $order?->editor_id ? [
                    'id' => $order->editor_id,
                    'name' => $order->editor?->name,
                    'requested_fee' => (float) $order->editor_fee,
                ] : null
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail naskah berhasil diambil.',
            'data' => $manuscript,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Add Revision - Penulis atau Editor upload revisi baru
    |--------------------------------------------------------------------------
    */

    public function addRevision(Request $request, Manuscript $manuscript): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'file' => self::MANUSCRIPT_UPLOAD_RULES,
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $isCoAuthor = $manuscript->authorLinks()->where('user_id', $user->id)->exists();
        $isEditor = $manuscript->editor_id === $user->id;

        abort_unless($isCoAuthor || $isEditor, 403, 'Anda tidak berwenang mengunggah revisi untuk naskah ini.');

        if ($isCoAuthor) {
            abort_unless(
                in_array($manuscript->status, ['submitted', 'revision_requested'], true),
                422,
                'Naskah tidak sedang menunggu revisi dari Anda.'
            );

            $role = 'penulis';
            $nextStatus = 'submitted';
        } else {
            abort_unless(
                in_array($manuscript->status, ['in_editing', 'editor_revision_requested'], true),
                422,
                'Naskah tidak sedang menunggu revisi dari Anda.'
            );

            $role = 'editor';
            $nextStatus = 'pending_admin_review_editor';
        }

        DB::transaction(function () use ($request, $manuscript, $validated, $user, $role, $nextStatus) {
            $this->storeRevision(
                $manuscript,
                $request->file('file'),
                $user->id,
                $role,
                $validated['note'] ?? null
            );

            $manuscript->update(['status' => $nextStatus]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Revisi berhasil diunggah.',
            'data' => $manuscript->fresh(['revisions', 'editor']),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Final Review - Penulis menyetujui atau minta revisi lagi
    |--------------------------------------------------------------------------
    */

    public function finalReview(Request $request, Manuscript $manuscript): JsonResponse
    {
        $user = $request->user();

        $coAuthorLink = $manuscript->authorLinks()->where('user_id', $user->id)->first();

        abort_unless($coAuthorLink, 403, 'Anda tidak berwenang melakukan aksi ini.');

        abort_unless(
            $manuscript->status === 'pending_penulis_review',
            422,
            'Naskah tidak sedang menunggu review akhir Anda.'
        );

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'revise'])],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validated['decision'] === 'approve') {
            $coAuthorLink->update(['approved_at' => now()]);

            if ($manuscript->authorLinks()->whereNull('approved_at')->doesntExist()) {
                $manuscript->update(['status' => 'completed']);
            }
        } else {
            $manuscript->authorLinks()->update(['approved_at' => null]);

            $latestRevision = $manuscript->latestRevision();
            $latestRevision?->update([
                'admin_note' => $validated['note'] ?? 'Penulis meminta revisi tambahan.',
            ]);

            $manuscript->update(['status' => 'in_editing']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Review akhir berhasil disimpan.',
            'data' => $manuscript->fresh(['revisions', 'editor', 'authorLinks.user'])->append('co_authors'),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Download Revision
    |--------------------------------------------------------------------------
    */

    public function downloadRevision(
        Request $request,
        Manuscript $manuscript,
        ManuscriptRevision $revision
    ): StreamedResponse {
        $this->ensureCanView($request, $manuscript);

        abort_unless($revision->manuscript_id === $manuscript->id, 404);

        abort_unless(
            Storage::disk('local')->exists($revision->file_path),
            404,
            'File tidak ditemukan.'
        );

        return Storage::disk('local')->download(
            $revision->file_path,
            $revision->original_filename
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function ensureCanView(Request $request, Manuscript $manuscript): void
    {
        $user = $request->user();

        $isCoAuthor = $manuscript->authorLinks()->where('user_id', $user->id)->exists();
        $isEditor = $manuscript->editor_id === $user->id;
        $isAdmin = $user->roles()->where('name', 'admin')->exists();

        abort_unless(
            $isCoAuthor || $isEditor || $isAdmin,
            403,
            'Anda tidak berwenang mengakses naskah ini.'
        );
    }

    /**
     * Kalau order ini adalah pembelian slot Book Chapter, taut manuscript
     * baru ke slot tsb dan refresh authors/authors_text buku dari semua
     * chapter yang sudah terisi.
     */
    private function linkBookChapterSlot(Order $order, Manuscript $manuscript): void
    {
        $chapter = BookChapter::where('order_id', $order->id)
            ->whereNull('manuscript_id')
            ->first();

        if (! $chapter) {
            return;
        }

        $chapter->update(['manuscript_id' => $manuscript->id]);

        $book = $chapter->book()->with('chapters.manuscript.user')->first();

        $filledAuthors = $book->chapters
            ->filter(fn (BookChapter $c) => $c->manuscript)
            ->map(fn (BookChapter $c) => $c->manuscript->user->name);

        $book->update([
            'authors' => $filledAuthors->values()->all(),
            'authors_text' => $filledAuthors->implode(', '),
        ]);
    }

    private function storeRevision(
        Manuscript $manuscript,
        $file,
        int $uploadedBy,
        string $role,
        ?string $note = null
    ): ManuscriptRevision {
        $nextRevisionNumber = ($manuscript->revisions()->max('revision_number') ?? 0) + 1;

        $path = $file->store('manuscripts/'.$manuscript->id, 'local');

        return $manuscript->revisions()->create([
            'revision_number' => $nextRevisionNumber,
            'uploaded_by' => $uploadedBy,
            'role' => $role,
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'note' => $note,
            'admin_status' => 'pending',
        ]);
    }
}
