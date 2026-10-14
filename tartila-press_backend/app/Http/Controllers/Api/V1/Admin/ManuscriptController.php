<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Services\BookChapterCompilationService;
use App\Services\Cover\CoverService;
use App\Services\ManuscriptAssignmentService;
use App\Services\ManuscriptAutoLayoutService;
use App\Services\ManuscriptPoolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class ManuscriptController extends Controller
{
    public function __construct(
        private readonly ManuscriptAutoLayoutService $autoLayout,
        private readonly BookChapterCompilationService $compilation,
        private readonly ManuscriptAssignmentService $assignment,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Semua naskah
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?status=, ?search= (judul/pengirim/penulis),
        // ?unpublished=1 (belum jadi buku/bab buku).
        $query = Manuscript::with(['user', 'editor', 'book', 'bookChapter'])
            ->latest()
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower((string) $request->query('search')).'%';

            $query->where(fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', [$term])
                ->orWhereHas('user', fn ($user) => $user->whereRaw('LOWER(name) LIKE ?', [$term])));
        }

        if ($request->boolean('unpublished')) {
            $query->doesntHave('book')->doesntHave('bookChapter');
        }

        return $this->pageResponse($query->paginate($this->perPage($request, 20)), 'Daftar naskah berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | Review Revision - Approve/Reject revisi terbaru
    |--------------------------------------------------------------------------
    */

    public function reviewRevision(
        Request $request,
        Manuscript $manuscript,
        ManuscriptRevision $revision
    ): JsonResponse {
        abort_unless($revision->manuscript_id === $manuscript->id, 404);

        abort_unless(
            $revision->admin_status === 'pending',
            422,
            'Revisi ini sudah pernah direview.'
        );

        $manuscript->load('order.bookChapterSlot.book');

        /*
        |--------------------------------------------------------------------------
        | Fee dari admin
        |--------------------------------------------------------------------------
        |
        | Kalau penulis memilih editor secara langsung, fee dari admin tetap
        | wajib diisi saat approve naskah. Total fee editor = fee permintaan
        | editor (sudah dibayar penulis di order) + fee dari admin.
        |
        */

        $needsAdminFee = $request->input('decision') === 'approve'
            && $revision->role === 'penulis'
            && $manuscript->order?->editor_id !== null;

        // Penulis memilih co-author sendiri: fee dari admin untuk co-author juga wajib diisi.
        $needsCoauthorFee = $request->input('decision') === 'approve'
            && $revision->role === 'penulis'
            && $manuscript->wants_coauthor
            && $manuscript->order?->coauthor_id !== null;

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note' => ['nullable', 'string', 'max:2000'],
            'fee' => [
                Rule::requiredIf($needsAdminFee),
                'nullable',
                'numeric',
                'min:0',
                'max:'.self::MAX_MONEY_AMOUNT,
            ],
            'coauthor_fee' => [
                Rule::requiredIf($needsCoauthorFee),
                'nullable',
                'numeric',
                'min:0',
                'max:'.self::MAX_MONEY_AMOUNT,
            ],
            'auto_layout' => ['nullable', 'boolean'],
            'manuscript_template_id' => ['nullable', 'integer', Rule::exists('manuscript_templates', 'id')],
            // Tingkat kesulitan naskah, diisi saat menerima naskah penulis.
            ...ManuscriptPoolService::difficultyRules(),
        ], [
            'fee.required' => 'Fee dari admin wajib diisi karena penulis memilih editor secara langsung. Total fee editor = fee permintaan editor + fee dari admin.',
            'coauthor_fee.required' => 'Fee co-author dari admin wajib diisi karena penulis memilih co-author secara langsung. Total fee co-author = fee permintaan co-author + fee dari admin.',
        ]);

        $approve = $validated['decision'] === 'approve';

        // Bab Book Chapter: tidak langsung ke editor dan tidak di-auto layout
        // sendiri; menunggu digabung dengan bab lain menjadi satu buku.
        $isChapter = $revision->role === 'penulis' && $this->compilation->chapterOf($manuscript) !== null;

        // Layanan co-author: naskah masih disusun co-author dulu, jadi tidak di-auto layout di sini.
        if ($isChapter || $manuscript->wants_coauthor) {
            $validated['auto_layout'] = false;
        }

        // Auto layout: naskah Word penulis ditata dengan template lalu
        // dikirim ke editor sebagai revisi baru. Dibuat sebelum status
        // berubah supaya kegagalan tidak meninggalkan setengah proses.
        $layout = null;
        $template = null;

        if ($approve && $revision->role === 'penulis' && ! empty($validated['auto_layout'])) {
            // Template: pilihan admin > pilihan penulis saat submit > template bawaan.
            $template = isset($validated['manuscript_template_id'])
                ? ManuscriptTemplate::find($validated['manuscript_template_id'])
                : (ManuscriptTemplate::where('is_active', true)->find($manuscript->manuscript_template_id) ?? ManuscriptTemplate::default());

            abort_unless($template, 422, 'Belum ada template naskah. Buat template di menu Template Naskah.');
            abort_unless($this->autoLayout->supports($revision), 422, 'Auto layout hanya bisa untuk naskah Word (.docx). Matikan auto layout atau minta penulis mengunggah .docx.');

            try {
                $layout = $this->autoLayout->render($manuscript, $revision, $template);
            } catch (RuntimeException $exception) {
                abort(422, 'Auto layout gagal: '.$exception->getMessage());
            }
        }

        DB::transaction(function () use ($request, $manuscript, $revision, $validated, $approve, $layout, $template, $isChapter) {
            $revision->update([
                'admin_status' => $approve ? 'approved' : 'rejected',
                'admin_note' => $validated['note'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            if ($approve && $revision->role === 'penulis' && ! empty($validated['difficulty'])) {
                $manuscript->update(['difficulty' => $validated['difficulty']]);
            }

            if ($approve) {
                if ($isChapter) {
                    $this->compilation->chapterApproved($manuscript);
                } elseif ($revision->role === 'penulis') {
                    if ($layout !== null && $template !== null) {
                        $this->autoLayout->storeRevision($manuscript, $template, $layout, $request->user());
                    }

                    // Layanan co-author: ke co-author dulu; tanpa layanan itu langsung ke editor.
                    $this->assignment->afterAuthorApproved($manuscript, $validated['fee'] ?? null, $validated['coauthor_fee'] ?? null);
                } elseif ($revision->role === 'coauthor') {
                    // Susunan co-author disetujui admin: dikirim ke penulis untuk disetujui / direvisi.
                    $manuscript->update(['status' => ManuscriptAssignmentService::STATUS_PENDING_AUTHOR_REVIEW_COAUTHOR]);
                    $manuscript->authorLinks()->where('is_coauthor', false)->update(['approved_at' => null]);
                } else {
                    $manuscript->update(['status' => 'pending_penulis_review']);
                    $manuscript->authorLinks()->where('is_coauthor', false)->update(['approved_at' => null]);

                    // Hasil editing disetujui: naskah masuk tagihan cover (cover paket).
                    if ($revision->role === 'editor') {
                        app(CoverService::class)->openForManuscript($manuscript);
                    }
                }
            } else {
                $manuscript->update([
                    'status' => match ($revision->role) {
                        'penulis' => 'revision_requested',
                        'coauthor' => ManuscriptAssignmentService::STATUS_COAUTHOR_REVISION_REQUESTED,
                        default => 'editor_revision_requested',
                    },
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Review revisi berhasil disimpan.',
            'data' => $manuscript->fresh(['revisions', 'editor', 'order']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Auto layout preview - unduh hasil penataan otomatis tanpa menyimpannya
    |--------------------------------------------------------------------------
    */

    public function autoLayoutPreview(Request $request, Manuscript $manuscript, ManuscriptRevision $revision): Response
    {
        abort_unless($revision->manuscript_id === $manuscript->id, 404);

        $validated = $request->validate([
            'template_id' => ['nullable', 'integer', Rule::exists('manuscript_templates', 'id')],
        ]);

        $template = isset($validated['template_id'])
            ? ManuscriptTemplate::find($validated['template_id'])
            : ManuscriptTemplate::default();

        abort_unless($template, 422, 'Belum ada template naskah.');
        abort_unless($this->autoLayout->supports($revision), 422, 'Auto layout hanya bisa untuk naskah Word (.docx).');

        try {
            $docx = $this->autoLayout->render($manuscript, $revision, $template);
        } catch (RuntimeException $exception) {
            abort(422, 'Auto layout gagal: '.$exception->getMessage());
        }

        return response($docx, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => 'attachment; filename="'.$this->autoLayout->filename($manuscript).'"',
            'Access-Control-Expose-Headers' => 'Content-Disposition',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Assign Editor - Admin menunjuk editor langsung
    |--------------------------------------------------------------------------
    */

    public function assignEditor(Request $request, Manuscript $manuscript): JsonResponse
    {
        $manuscript->load('order');

        abort_unless(
            $manuscript->status === 'pending_editor_assignment',
            422,
            'Naskah tidak sedang menunggu penugasan editor.'
        );

        abort_if(
            $manuscript->order?->editor_id,
            422,
            'Penulis sudah memilih editor sendiri untuk pesanan ini.'
        );

        $validated = $request->validate([
            'editor_id' => ['required', 'integer'],
            'fee' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'deadline' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            ...ManuscriptPoolService::difficultyRules(),
        ]);

        $editorProfile = EditorProfile::where('user_id', $validated['editor_id'])->first();

        abort_unless($editorProfile, 422, 'User yang dipilih bukan Editor.');

        // Co-author dan editor satu naskah harus orang yang berbeda.
        abort_if(
            $manuscript->coauthor_id !== null && $manuscript->coauthor_id === (int) $validated['editor_id'],
            422,
            'Co-author naskah ini tidak bisa menjadi editornya. Pilih editor lain.'
        );

        $manuscript->update([
            'editor_id' => $validated['editor_id'],
            'editor_source' => Manuscript::EDITOR_SOURCE_ADMIN,
            'editor_fee' => $validated['fee'],
            'editor_requested_fee' => null,
            'editor_deadline' => $validated['deadline'] ?? null,
            'editor_assignment_note' => $validated['note'] ?? null,
            'open_for_claim' => false,
            'status' => 'in_editing',
            'difficulty' => $validated['difficulty'] ?? $manuscript->difficulty,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Editor berhasil ditugaskan.',
            'data' => $manuscript->fresh(['editor']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Open Pool - Admin membuka naskah untuk diambil editor
    |--------------------------------------------------------------------------
    */

    public function openPool(Request $request, Manuscript $manuscript): JsonResponse
    {
        $manuscript->load('order');

        abort_unless(
            $manuscript->status === 'pending_editor_assignment',
            422,
            'Naskah tidak sedang menunggu penugasan editor.'
        );

        abort_if(
            $manuscript->order?->editor_id,
            422,
            'Penulis sudah memilih editor sendiri untuk pesanan ini.'
        );

        $validated = $request->validate([
            'fee' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'deadline' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            ...ManuscriptPoolService::difficultyRules(),
            // Kriteria editor: kosong = umum (semua editor).
            ...ManuscriptPoolService::fieldRules('pool_field_category_ids'),
        ]);

        $manuscript->update([
            'editor_fee' => $validated['fee'],
            'editor_deadline' => $validated['deadline'] ?? null,
            'editor_assignment_note' => $validated['note'] ?? null,
            'difficulty' => $validated['difficulty'] ?? $manuscript->difficulty,
            'pool_field_category_ids' => ManuscriptPoolService::ids($validated['pool_field_category_ids'] ?? []) ?: null,
            'open_for_claim' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Naskah berhasil dibuka untuk diambil editor.',
            'data' => $manuscript->fresh(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Pool Settings - Ubah tingkat kesulitan / kriteria editor pool
    |--------------------------------------------------------------------------
    |
    | Bisa kapan saja (mis. naskah gabungan Book Chapter, atau naskah yang
    | sudah ada di pool tetapi kriterianya perlu diubah).
    |
    */

    public function updatePoolSettings(Request $request, Manuscript $manuscript): JsonResponse
    {
        $validated = $request->validate([
            ...ManuscriptPoolService::difficultyRules(),
            ...ManuscriptPoolService::fieldRules('pool_field_category_ids'),
        ]);

        $changes = [];

        if ($request->exists('difficulty')) {
            $changes['difficulty'] = $validated['difficulty'] ?? null;
        }

        if ($request->exists('pool_field_category_ids')) {
            $changes['pool_field_category_ids'] = ManuscriptPoolService::ids($validated['pool_field_category_ids'] ?? []) ?: null;
        }

        $manuscript->update($changes);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan naskah berhasil disimpan.',
            'data' => $manuscript->fresh(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Assign Co-author - Admin menunjuk co-author langsung
    |--------------------------------------------------------------------------
    */

    public function assignCoauthor(Request $request, Manuscript $manuscript): JsonResponse
    {
        abort_unless(
            $manuscript->status === ManuscriptAssignmentService::STATUS_PENDING_COAUTHOR_ASSIGNMENT,
            422,
            'Naskah tidak sedang menunggu penugasan co-author.'
        );

        $validated = $request->validate([
            'coauthor_id' => ['required', 'integer'],
            'fee' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'deadline' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $coauthor = $this->assignment->assertAssignable($manuscript, (int) $validated['coauthor_id']);

        $this->assignment->attach(
            $manuscript,
            $coauthor,
            Manuscript::EDITOR_SOURCE_ADMIN,
            (float) $validated['fee'],
            null,
            $validated['deadline'] ?? null,
            $validated['note'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'Co-author berhasil ditugaskan.',
            'data' => $manuscript->fresh(['coauthor']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Open Coauthor Pool - Admin membuka naskah untuk diambil co-author
    |--------------------------------------------------------------------------
    */

    public function openCoauthorPool(Request $request, Manuscript $manuscript): JsonResponse
    {
        abort_unless(
            $manuscript->status === ManuscriptAssignmentService::STATUS_PENDING_COAUTHOR_ASSIGNMENT,
            422,
            'Naskah tidak sedang menunggu penugasan co-author.'
        );

        $validated = $request->validate([
            'fee' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'deadline' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            ...ManuscriptPoolService::difficultyRules(),
            ...ManuscriptPoolService::fieldRules('pool_field_category_ids'),
        ]);

        $manuscript->update([
            'coauthor_fee' => $validated['fee'],
            'coauthor_deadline' => $validated['deadline'] ?? null,
            'coauthor_assignment_note' => $validated['note'] ?? null,
            'difficulty' => $validated['difficulty'] ?? $manuscript->difficulty,
            'pool_field_category_ids' => ManuscriptPoolService::ids($validated['pool_field_category_ids'] ?? []) ?: null,
            'coauthor_open_for_claim' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Naskah berhasil dibuka untuk diambil co-author.',
            'data' => $manuscript->fresh(),
        ]);
    }
}
