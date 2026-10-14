<?php

namespace App\Http\Controllers\Api\V1\Manuscript;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Models\Order;
use App\Models\User;
use App\Services\BookChapterCompilationService;
use App\Services\ManuscriptAssignmentService;
use App\Services\MouService;
use App\Services\PublicationProcessService;
use App\Support\ManuscriptTemplates\DocxPackage;
use App\Support\SignatureImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class ManuscriptController extends Controller
{
    public function __construct(
        private readonly BookChapterCompilationService $compilation,
        private readonly ManuscriptAssignmentService $assignment,
    ) {}

    private const MANUSCRIPT_UPLOAD_RULES = [
        'file',
        'mimes:pdf,doc,docx,odt',
        'max:20480',
    ];

    /*
    |--------------------------------------------------------------------------
    | Template naskah yang bisa dipilih penulis (tanpa pengaturan internal)
    |--------------------------------------------------------------------------
    */

    public function templateOptions(): JsonResponse
    {
        $templates = ManuscriptTemplate::where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'is_default']);

        return response()->json([
            'success' => true,
            'message' => 'Daftar template naskah berhasil diambil.',
            'data' => $templates,
        ]);
    }

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
            'author_bio_photo' => ['nullable', 'string', 'max:500', 'http_url'],
            'author_bio_name' => ['nullable', 'string', 'max:255'],
            'author_bio_text' => ['nullable', 'string', 'max:5000'],
            // Template naskah pilihan penulis (dipakai untuk auto layout); wajib untuk naskah paket.
            'manuscript_template_id' => ['nullable', 'integer', Rule::exists('manuscript_templates', 'id')->where('is_active', true)],
        ]);

        $this->ensureUsableDocx($request);

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
            // Bab Book Chapter digabung menjadi satu buku → wajib Word.
            $this->ensureDocx($request);

            $title = $chapter->book->title.' — '.$chapter->title;
            $authorUserIds = [$user->id];
        } else {
            abort_if(blank($validated['title'] ?? null), 422, 'Judul buku wajib diisi.');

            // Penulis memilih template naskah sendiri dulu sebelum naskahnya terkirim.
            if (empty($validated['manuscript_template_id']) && ManuscriptTemplate::where('is_active', true)->exists()) {
                throw ValidationException::withMessages([
                    'manuscript_template_id' => 'Pilih template naskah terlebih dahulu sebelum mengirim naskah.',
                ]);
            }

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

        $manuscript = DB::transaction(function () use ($request, $validated, $user, $order, $title, $authorUserIds, $authorNames, $chapter) {

            $manuscript = Manuscript::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'title' => $title,
                'authors' => $authorNames,
                'status' => 'submitted',
                'wants_coauthor' => ! $chapter && (bool) $order->wants_coauthor,
                'manuscript_template_id' => $chapter ? null : ($validated['manuscript_template_id'] ?? null),
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
            'data' => $manuscript->load('revisions')->hideFeesFrom($request->user(), false),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Mine - Naskah milik penulis sendiri
    |--------------------------------------------------------------------------
    */

    public function mine(Request $request, PublicationProcessService $publication): JsonResponse
    {
        $manuscripts = Manuscript::whereHas(
            'authorLinks',
            fn ($query) => $query->where('user_id', $request->user()->id)
        )
            ->with([
                'revisions',
                'editor',
                'bookChapter',
                'authorLinks',
                'isbnApplication:id,manuscript_id,applicant_id,type,status,signed_at',
            ])
            ->latest()
            ->get()
            ->each(function (Manuscript $manuscript) use ($request, $publication) {
                // Ringkasan proses penerbitan (setelah naskah selesai).
                $progress = in_array($manuscript->status, ['completed', Manuscript::STATUS_COMPILED], true)
                    ? $publication->progressForManuscript($manuscript)
                    : null;
                $manuscript->setAttribute('publication', $progress
                    ? ['current' => $progress['current'], 'completed' => $progress['completed']]
                    : null);

                // Tombol "Ajukan ISBN" di daftar: hanya penulis pertama, naskah
                // selesai (bukan slot Book Chapter), dan surat belum dibuka.
                $manuscript->setAttribute('can_request_isbn', $manuscript->status === 'completed'
                    && $manuscript->bookChapter === null
                    && $manuscript->compiled_book_id === null
                    && $manuscript->isbnApplication === null
                    && $manuscript->authorLinks->first()?->user_id === $request->user()->id);
                $manuscript->makeHidden(['bookChapter', 'authorLinks']);
                $manuscript->hideFeesFrom($request->user(), false);
            });

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

    public function show(Request $request, Manuscript $manuscript, MouService $mous): JsonResponse
    {
        $this->ensureCanView($request, $manuscript);

        // MOU distribusi buku (naskah selesai / naskah gabungan di review akhir).
        $chapterBook = $manuscript->bookChapter()->with('book')->first()?->book;
        $mou = match (true) {
            $manuscript->isCompilation() => $mous->forCompilation($manuscript),
            $chapterBook !== null => $mous->forBook($chapterBook),
            default => $mous->forManuscript($manuscript),
        };
        // Relasi "mou" (model mentah) jangan menimpa data tampilan ini.
        $manuscript->unsetRelation('mou')->setAttribute('mou', $mou ? $mous->present($mou, $request->user()) : null);

        $manuscript->load([
            'revisions.uploader',
            'editor',
            'coauthor:id,name',
            'user',
            'book',
            'bookChapter.book',
            'authorLinks.user',
            'isbnApplication:id,manuscript_id,applicant_id,type,status,signed_at',
            'compiledBook:id,title',
            'chapterRevisionRequests.requester:id,name',
        ]);
        $manuscript->append('co_authors');
        $isAdmin = $request->user()->roles()->where('name', 'admin')->exists();
        $manuscript->hideFeesFrom($request->user(), $isAdmin);

        // Hanya untuk admin: saat approve, admin wajib mengisi fee bila penulis
        // memilih editor langsung. Data order lainnya tidak ikut terkirim.
        if ($request->user()->roles()->where('name', 'admin')->exists()) {
            $order = $manuscript->order()->with(['editor:id,name', 'coauthor:id,name'])->first();

            $manuscript->setAttribute(
                'author_chosen_coauthor',
                $order?->coauthor_id ? [
                    'id' => $order->coauthor_id,
                    'name' => $order->coauthor?->name,
                    'requested_fee' => (float) $order->coauthor_fee,
                ] : null
            );

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

        // "Penulis" di sini = penulis naskah; co-author layanan paket punya tahapnya sendiri.
        $isCoAuthor = $manuscript->authorLinks()->where('user_id', $user->id)->where('is_coauthor', false)->exists();
        $isServiceCoauthor = $manuscript->coauthor_id === $user->id;
        $isEditor = $manuscript->editor_id === $user->id;

        abort_unless($isCoAuthor || $isServiceCoauthor || $isEditor, 403, 'Anda tidak berwenang mengunggah revisi untuk naskah ini.');

        $this->ensureUsableDocx($request);

        if ($isServiceCoauthor) {
            abort_unless(
                in_array($manuscript->status, ManuscriptAssignmentService::COAUTHOR_WORKING, true),
                422,
                'Naskah tidak sedang menunggu hasil susunan dari Anda.'
            );

            $role = 'coauthor';
            $nextStatus = ManuscriptAssignmentService::STATUS_PENDING_ADMIN_REVIEW_COAUTHOR;
        } elseif ($isCoAuthor) {
            abort_unless(
                in_array($manuscript->status, ['submitted', 'revision_requested'], true),
                422,
                'Naskah tidak sedang menunggu revisi dari Anda.'
            );

            if ($this->compilation->chapterOf($manuscript)) {
                $this->ensureDocx($request);
            }

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
            'data' => $manuscript->fresh(['revisions', 'editor'])->hideFeesFrom($request->user(), false),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Final Review - Penulis menyetujui atau minta revisi lagi
    |--------------------------------------------------------------------------
    */

    public function finalReview(Request $request, Manuscript $manuscript, MouService $mous): JsonResponse
    {
        $user = $request->user();

        $coAuthorLink = $manuscript->authorLinks()->where('user_id', $user->id)->where('is_coauthor', false)->first();

        abort_unless($coAuthorLink, 403, 'Anda tidak berwenang melakukan aksi ini.');

        abort_unless(
            $manuscript->status === 'pending_penulis_review',
            422,
            'Naskah tidak sedang menunggu review akhir Anda.'
        );

        // Book Chapter: MOU distribusi buku disetujui saat menyetujui naskah akhir.
        $mou = $manuscript->isCompilation() && $request->input('decision') === 'approve'
            ? $mous->forCompilation($manuscript)
            : null;
        $signsMou = $mou !== null && $mous->blockedReason($mou, $user, 'final_review') === null;

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'revise'])],
            'note' => ['nullable', 'string', 'max:2000'],
            'mou_agreed' => [$signsMou ? 'accepted' : 'nullable'],
            'signature' => [$signsMou ? 'required' : 'nullable', 'string', 'max:700000'],
        ], [
            'mou_agreed.accepted' => 'Centang pernyataan bahwa Anda sudah membaca dan menyepakati isi MOU distribusi buku.',
            'signature.required' => 'Tanda tangani MOU distribusi buku untuk menyetujui naskah akhir.',
        ]);

        if ($signsMou) {
            $mous->sign($mou, $user, SignatureImage::decode($validated['signature']), 'final_review');
        } elseif ($mou && $validated['decision'] === 'approve' && ($reason = $mous->blockedReason($mou, $user, 'final_review'))
            && ! $mou->signatories->firstWhere('user_id', $user->id)?->signed_at) {
            abort(422, $reason);
        }

        if ($validated['decision'] === 'approve') {
            $coAuthorLink->update(['approved_at' => now()]);

            if ($manuscript->authorLinks()->where('is_coauthor', false)->whereNull('approved_at')->doesntExist()) {
                $manuscript->update(['status' => 'completed']);

                // Naskah gabungan Book Chapter selesai → semua babnya selesai.
                if ($manuscript->isCompilation()) {
                    $this->compilation->compilationCompleted($manuscript);
                }
            }
        } else {
            $manuscript->authorLinks()->where('is_coauthor', false)->update(['approved_at' => null]);

            $latestRevision = $manuscript->latestRevision();
            $latestRevision?->update([
                'author_note' => $validated['note'] ?? 'Penulis meminta revisi tambahan.',
            ]);

            $manuscript->update(['status' => 'in_editing']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Review akhir berhasil disimpan.',
            'data' => $manuscript->fresh(['revisions', 'editor', 'authorLinks.user'])->append('co_authors')->hideFeesFrom($request->user(), false),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Coauthor Review - Penulis menyetujui atau meminta revisi hasil co-author
    |--------------------------------------------------------------------------
    |
    | Setelah admin menyetujui susunan co-author, naskah dikirim ke penulis. Setuju -> naskah
    | diteruskan ke editor; minta revisi -> kembali ke co-author.
    |
    */

    public function coauthorReview(Request $request, Manuscript $manuscript): JsonResponse
    {
        $user = $request->user();

        $link = $manuscript->authorLinks()->where('user_id', $user->id)->where('is_coauthor', false)->first();

        abort_unless($link, 403, 'Anda tidak berwenang melakukan aksi ini.');

        abort_unless(
            $manuscript->status === ManuscriptAssignmentService::STATUS_PENDING_AUTHOR_REVIEW_COAUTHOR,
            422,
            'Naskah tidak sedang menunggu tinjauan Anda atas hasil co-author.'
        );

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'revise'])],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validated['decision'] === 'approve') {
            $link->update(['approved_at' => now()]);

            if ($manuscript->authorLinks()->where('is_coauthor', false)->whereNull('approved_at')->doesntExist()) {
                $this->assignment->afterCoauthorApproved($manuscript);
            }
        } else {
            $manuscript->authorLinks()->where('is_coauthor', false)->update(['approved_at' => null]);

            $manuscript->latestRevision()?->update([
                'author_note' => $validated['note'] ?? 'Penulis meminta revisi hasil co-author.',
            ]);

            $manuscript->update(['status' => ManuscriptAssignmentService::STATUS_IN_COAUTHORING]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Tinjauan hasil co-author berhasil disimpan.',
            'data' => $manuscript->fresh(['revisions', 'editor', 'coauthor', 'authorLinks.user'])->append('co_authors')->hideFeesFrom($request->user(), false),
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
    ): Response {
        $this->ensureCanView($request, $manuscript);

        abort_unless($revision->manuscript_id === $manuscript->id, 404);

        abort_unless(
            $revision->file_path && Storage::disk('local')->exists($revision->file_path),
            404,
            $revision->file_purged_at ? 'Dokumen revisi sudah dihapus dari sistem setelah buku terbit (tersisa riwayat).' : 'File tidak ditemukan.'
        );

        // Word: salinan tanpa template jarak jauh, tautan UNC/file:// dan
        // makro, supaya admin/editor aman membukanya. Berkas asli tetap utuh.
        if (strtolower(pathinfo((string) $revision->original_filename, PATHINFO_EXTENSION)) === 'docx') {
            try {
                $safe = DocxPackage::sanitizedCopy(Storage::disk('local')->path($revision->file_path));
            } catch (RuntimeException) {
                abort(422, 'Berkas Word ini rusak atau berisi bagian yang tidak aman sehingga tidak bisa diunduh. Minta pengunggah mengirim ulang naskahnya.');
            }

            return response()->download($safe, $revision->original_filename)->deleteFileAfterSend();
        }

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
        $isEditor = $manuscript->editor_id === $user->id || $manuscript->coauthor_id === $user->id;
        $isAdmin = $user->roles()->where('name', 'admin')->exists();

        // Editor naskah gabungan Book Chapter boleh membuka naskah tiap bab.
        $isCompilationEditor = ! $isCoAuthor && ! $isEditor && ! $isAdmin
            && Manuscript::where('editor_id', $user->id)
                ->where('compiled_book_id', $this->compilation->chapterOf($manuscript)?->book_id ?? 0)
                ->exists();

        abort_unless(
            $isCoAuthor || $isEditor || $isAdmin || $isCompilationEditor,
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

    /** .docx yang diunggah harus berkas Word utuh yang bisa diperiksa keamanannya. */
    private function ensureUsableDocx(Request $request): void
    {
        $file = $request->file('file');

        if (! $file || strtolower((string) $file->getClientOriginalExtension()) !== 'docx') {
            return;
        }

        try {
            DocxPackage::assertUsable((string) $file->getRealPath());
        } catch (RuntimeException $exception) {
            abort(422, $exception->getMessage().' Simpan ulang naskah dari Microsoft Word sebagai .docx lalu unggah lagi.');
        }
    }

    private function ensureDocx(Request $request): void
    {
        abort_unless(
            strtolower((string) $request->file('file')?->getClientOriginalExtension()) === 'docx',
            422,
            'Naskah bab Book Chapter harus berformat Word (.docx) karena semua bab digabung menjadi satu buku.'
        );
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
