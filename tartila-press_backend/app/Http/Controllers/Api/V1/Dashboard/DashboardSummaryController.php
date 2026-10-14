<?php

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\ChapterRevisionRequest;
use App\Models\CustomPackageItem;
use App\Models\EventRegistration;
use App\Models\IsbnApplication;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\Order;
use App\Models\Package;
use App\Models\RoleRequest;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WalletWithdrawal;
use App\Services\CertificateService;
use App\Services\FinanceService;
use App\Services\HkiService;
use App\Services\ManuscriptAssignmentService;
use App\Services\ManuscriptPoolService;
use App\Services\WalletService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Ringkasan dashboard: angka penting dan hal yang perlu ditindaklanjuti dari
 * semua fitur, dikelompokkan per peran (akun, penulis, editor, admin), plus
 * notifikasi terbaru.
 */
class DashboardSummaryController extends Controller
{
    private const ACTIVE_MANUSCRIPT_EXCLUDED = ['completed', Manuscript::STATUS_COMPILED];

    // Pesanan yang menunggu naskah dikirim penulis.
    private const MANUSCRIPT_ITEMABLES = [Package::class, CustomPackageItem::class, BookChapter::class];

    public function __construct(
        private readonly CertificateService $certificates,
        private readonly HkiService $hki,
        private readonly ManuscriptPoolService $pool,
        private readonly ManuscriptAssignmentService $assignment,
        private readonly WalletService $wallet,
        private readonly FinanceService $finance,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $roles = $user->roles()->pluck('name')->all();

        $isPenulis = in_array('penulis', $roles, true);
        $isEditor = in_array('editor', $roles, true);
        $isAdmin = in_array('admin', $roles, true);

        $sections = [$this->accountSection($user)];

        $writerSection = $this->writerSection($user, $isPenulis);

        if ($writerSection !== null) {
            $sections[] = $writerSection;
        }

        if ($isEditor) {
            $sections[] = $this->editorSection($user);
        }

        if ($isPenulis || $isEditor) {
            $sections[] = $this->walletSection($user);
        }

        if ($isAdmin) {
            $sections[] = $this->adminSection();
        }

        $updates = UserNotification::where('user_id', $user->id)
            ->latest('id')
            ->limit(6)
            ->get(['id', 'category', 'title', 'body', 'link', 'read_at', 'created_at']);

        return response()->json([
            'success' => true,
            'message' => 'Ringkasan dashboard berhasil diambil.',
            'data' => [
                'name' => $user->name,
                'roles' => $roles,
                'unread_notifications' => UserNotification::where('user_id', $user->id)->whereNull('read_at')->count(),
                'sections' => $sections,
                'updates' => $updates,
            ],
        ]);
    }

    // =====================================================================

    private function accountSection(User $user): array
    {
        $orders = Order::where('user_id', $user->id);

        $awaitingPayment = (clone $orders)->where('status', 'pending')->whereNull('payment_proof_file')->count();
        $awaitingVerification = (clone $orders)->where('status', 'pending')->whereNotNull('payment_proof_file')->count();
        $inProcess = (clone $orders)->where('status', 'confirmed')->count();

        $upcomingEvents = EventRegistration::where('user_id', $user->id)
            ->where('status', 'confirmed')
            ->whereHas('event', fn (Builder $query) => $query->where(
                fn (Builder $time) => $time->where('starts_at', '>=', now())->orWhere('ends_at', '>=', now())
            ))
            ->count();

        $certificateCount = $this->certificates->listFor($user)->count()
            + count($this->hki->certificatesFor($user));

        $items = [
            $this->item('orders_payment', 'Menunggu pembayaran', $awaitingPayment, '/dashboard/pesanan', $awaitingPayment > 0, 'Unggah bukti pembayaran'),
            $this->item('orders_verification', 'Menunggu verifikasi admin', $awaitingVerification, '/dashboard/pesanan'),
            $this->item('orders_process', 'Pesanan diproses', $inProcess, '/dashboard/pesanan'),
            $this->item('events', 'Event mendatang', $upcomingEvents, '/dashboard/event-saya'),
            $this->item('certificates', 'Sertifikat', $certificateCount, '/dashboard/sertifikat-saya'),
        ];

        if (! $user->personalProfile()->exists()) {
            $items[] = $this->item('personal_data', 'Data pribadi belum diisi', null, '/dashboard/data-pribadi', true, 'Dipakai untuk surat ISBN & sertifikat');
        }

        return $this->section('account', 'Akun & Pesanan', $items);
    }

    private function writerSection(User $user, bool $isPenulis): ?array
    {
        $mine = fn (Builder $query) => $query->where('user_id', $user->id)
            ->orWhereHas('authorLinks', fn (Builder $link) => $link->where('user_id', $user->id));

        $manuscripts = Manuscript::where($mine)->with('authorLinks')->get(['id', 'user_id', 'status']);

        $waitingManuscript = Order::where('user_id', $user->id)
            ->where('status', 'confirmed')
            ->whereDoesntHave('manuscript')
            ->whereHas('items', fn (Builder $item) => $item->whereIn('itemable_type', self::MANUSCRIPT_ITEMABLES))
            ->count();

        if (! $isPenulis && $manuscripts->isEmpty() && $waitingManuscript === 0) {
            return null;
        }

        $needsRevision = $manuscripts->where('status', 'revision_requested')->count();
        $needsFinalReview = $manuscripts->filter(fn (Manuscript $manuscript) => in_array($manuscript->status, ['pending_penulis_review', 'pending_author_review_coauthor'], true)
            && $manuscript->authorLinks->contains(fn ($link) => $link->user_id === $user->id && $link->approved_at === null))->count();
        $chapterNotes = ChapterRevisionRequest::whereNull('resolved_at')
            ->whereIn('manuscript_id', $manuscripts->pluck('id'))
            ->count();
        $active = $manuscripts->whereNotIn('status', self::ACTIVE_MANUSCRIPT_EXCLUDED)->count();
        $isbnDrafts = IsbnApplication::where('applicant_id', $user->id)
            ->where('status', IsbnApplication::STATUS_DRAFT)
            ->count();

        $books = Book::publishedByAuthor($user->id)->get(['id', 'ebook_file']);

        $items = [
            $this->item('submit_manuscript', 'Pesanan menunggu naskah', $waitingManuscript, '/dashboard/pesanan', $waitingManuscript > 0, 'Kirim naskah Anda'),
            $this->item('manuscript_revision', 'Naskah perlu revisi', $needsRevision + $chapterNotes, '/dashboard/naskah', $needsRevision + $chapterNotes > 0),
            $this->item('manuscript_review', 'Menunggu persetujuan akhir Anda', $needsFinalReview, '/dashboard/naskah', $needsFinalReview > 0),
            $this->item('manuscript_active', 'Naskah sedang diproses', $active, '/dashboard/naskah'),
            $this->item('isbn_drafts', 'Surat ISBN belum ditandatangani', $isbnDrafts, '/dashboard/naskah', $isbnDrafts > 0),
            $this->item('published_books', 'Buku terbit', $books->count(), '/dashboard/buku-terbit'),
            $this->item('ebooks', 'Ebook lengkap tersedia', $books->filter->hasEbook()->count(), '/dashboard/buku-terbit'),
        ];

        return $this->section('writer', 'Penulis', $items);
    }

    private function editorSection(User $user): array
    {
        $assigned = $user->assignedManuscripts()->get(['id', 'status', 'editor_fee', 'open_for_claim', 'pool_field_category_ids']);

        $toWork = $assigned->whereIn('status', ['in_editing', 'editor_revision_requested'])->count();
        $inReview = $assigned->whereIn('status', ['pending_admin_review_editor', 'pending_penulis_review'])->count();
        $runningFee = (float) $assigned->whereNotIn('status', ['completed'])->sum('editor_fee');

        $coauthored = $user->coauthoredManuscripts()->get(['id', 'status', 'coauthor_fee']);
        $coauthorWork = $coauthored->whereIn('status', ['in_coauthoring', 'coauthor_revision_requested'])->count();
        $coauthorFee = (float) $coauthored->where('status', '!=', 'completed')->sum('coauthor_fee');
        $coauthorPool = ManuscriptAssignmentService::isCoauthor($user)
            ? Manuscript::where('coauthor_open_for_claim', true)->get()->filter(fn (Manuscript $manuscript) => $this->assignment->canClaim($user, $manuscript))->count()
            : 0;

        $editorFields = $this->pool->editorFieldIds($user);
        $poolCount = Manuscript::where('open_for_claim', true)
            ->get(['id', 'pool_field_category_ids'])
            ->filter(fn (Manuscript $manuscript) => $this->pool->matches($manuscript, $editorFields))
            ->count();

        $projects = Book::where('is_chapter_offering', true)->where('owner_editor_id', $user->id)->count();

        return $this->section('editor', 'Editor', [
            $this->item('editor_work', 'Naskah perlu dikerjakan', $toWork, '/dashboard/naskah-ditugaskan', $toWork > 0),
            $this->item('editor_review', 'Hasil edit sedang direview', $inReview, '/dashboard/naskah-ditugaskan'),
            $this->item('editor_pool', 'Naskah tersedia di pool', $poolCount, '/dashboard/pool-naskah', $poolCount > 0, 'Sesuai bidang keahlian Anda'),
            $this->item('editor_fee', 'Fee naskah berjalan', $runningFee + $coauthorFee, '/dashboard/fee-saya', false, null, 'currency'),
            ...($coauthored->isNotEmpty() || $coauthorPool > 0 ? [
                $this->item('coauthor_work', 'Naskah co-author perlu dikerjakan', $coauthorWork, '/dashboard/naskah-coauthor', $coauthorWork > 0),
                $this->item('coauthor_pool', 'Naskah tersedia di pool co-author', $coauthorPool, '/dashboard/pool-coauthor', $coauthorPool > 0, 'Sesuai bidang keahlian Anda'),
            ] : []),
            $this->item('editor_projects', 'Proyek Book Chapter saya', $projects, '/dashboard/proyek-bab-buku-saya'),
        ]);
    }

    private function walletSection(User $user): array
    {
        $summary = $this->wallet->summary($user);

        return $this->section('wallet', 'Dompet & Royalti', [
            $this->item('wallet_balance', 'Saldo dompet', $summary['balance'], '/dashboard/dompet', false, null, 'currency'),
            $this->item('wallet_pending', 'Penarikan diproses', $summary['pending'], '/dashboard/dompet', false, null, 'currency'),
            $this->item('royalty', 'Royalti diterima', ($summary['by_type']['royalty'] ?? 0) + ($summary['by_type']['ebook_royalty'] ?? 0), '/dashboard/royalti', false, null, 'currency'),
        ]);
    }

    private function adminSection(): array
    {
        $paymentToVerify = Order::where('status', 'pending')->whereNotNull('payment_proof_file')->count();
        $revisionsToReview = ManuscriptRevision::where('admin_status', 'pending')->distinct()->count('manuscript_id');
        $awaitingEditor = Manuscript::where('status', 'pending_editor_assignment')->where('open_for_claim', false)->count();
        $inPool = Manuscript::where('open_for_claim', true)->count();
        $roleRequests = RoleRequest::where('status', 'pending')->count();
        $withdrawals = WalletWithdrawal::where('status', 'pending')->count();
        $isbnSigned = IsbnApplication::where('status', IsbnApplication::STATUS_SIGNED)->count();
        $articles = Article::where('status', 'pending')->count();
        $hkiWithoutCertificate = collect($this->hki->entries())->where('hki.has_certificate', false)->count();

        $monthStart = Carbon::now(FinanceService::TIMEZONE)->startOfMonth();
        // Dijumlahkan di database (tanggal bayar = konfirmasi pembayaran, kalau tidak ada: diubah terakhir).
        $monthRevenue = (float) DB::table('orders')
            ->whereIn('status', FinanceService::PAID_STATUSES)
            ->whereRaw('COALESCE((SELECT MIN(h.created_at) FROM order_status_histories h WHERE h.order_id = orders.id AND h.event = ?), orders.updated_at, orders.created_at) >= ?', ['payment_confirmed', $monthStart->copy()->utc()->toDateTimeString()])
            ->sum('total')
            + (float) DB::table('reader_orders')
                ->where('status', 'confirmed')
                ->where('confirmed_at', '>=', $monthStart->copy()->utc()->toDateTimeString())
                ->sum('amount');

        return $this->section('admin', 'Admin', [
            $this->item('admin_payments', 'Pembayaran perlu diverifikasi', $paymentToVerify, '/admin/orders', $paymentToVerify > 0),
            $this->item('admin_revisions', 'Naskah perlu direview', $revisionsToReview, '/admin/manuscripts', $revisionsToReview > 0),
            $this->item('admin_assign', 'Naskah menunggu editor', $awaitingEditor, '/admin/manuscripts', $awaitingEditor > 0),
            $this->item('admin_pool', 'Naskah di pool editor', $inPool, '/admin/pool-naskah'),
            $this->item('admin_roles', 'Permintaan peran', $roleRequests, '/admin', $roleRequests > 0),
            $this->item('admin_withdrawals', 'Penarikan saldo', $withdrawals, '/admin/withdrawals', $withdrawals > 0),
            $this->item('admin_isbn', 'Surat ISBN siap diproses', $isbnSigned, '/admin/terbitkan-naskah', $isbnSigned > 0),
            $this->item('admin_articles', 'Artikel menunggu review', $articles, '/admin/articles', $articles > 0),
            $this->item('admin_hki', 'HKI belum ada sertifikat', $hkiWithoutCertificate, '/admin/hki'),
            $this->item('admin_revenue', 'Omzet bulan ini', $monthRevenue, '/admin/keuangan', false, null, 'currency'),
        ]);
    }

    // =====================================================================

    /** @param  list<array<string, mixed>>  $items */
    private function section(string $key, string $title, array $items): array
    {
        return ['key' => $key, 'title' => $title, 'items' => $items];
    }

    private function item(
        string $key,
        string $label,
        int|float|null $value,
        string $link,
        bool $attention = false,
        ?string $hint = null,
        string $format = 'number',
    ): array {
        return [
            'key' => $key,
            'label' => $label,
            'value' => $value === null ? null : round((float) $value, 2),
            'format' => $format,
            'link' => $link,
            'attention' => $attention,
            'hint' => $hint,
        ];
    }
}
