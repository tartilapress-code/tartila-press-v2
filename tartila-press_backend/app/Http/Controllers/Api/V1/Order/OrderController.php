<?php

namespace App\Http\Controllers\Api\V1\Order;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookShipment;
use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Event;
use App\Models\Order;
use App\Models\Package;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\OrderStatusService;
use App\Services\VoucherService;
use App\Support\InvoicePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(
        private readonly VoucherService $vouchers,
        private readonly OrderStatusService $orderStatus,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Store - User mengambil paket (admin atau custom)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            ...$this->selectionRules(),

            'voucher_code' => [
                'nullable',
                'string',
                'max:40',
            ],

            'editor_id' => [
                'nullable',
                'integer',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            // Rekening tujuan transfer yang dipilih pembeli (tampil di invoice).
            'payment_method_id' => self::paymentMethodRules(),

            'recipient_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'recipient_phone' => [
                'nullable',
                'string',
                'max:20',
            ],

            'recipient_address' => [
                'nullable',
                'string',
            ],
        ], [
            'payment_method_id.required' => 'Pilih rekening tujuan pembayaran.',
            'payment_method_id.exists' => 'Rekening yang dipilih tidak tersedia.',
        ]);

        $editorFee = 0;

        if (! empty($validated['editor_id'])) {
            $editorProfile = EditorProfile::where(
                'user_id',
                $validated['editor_id']
            )
                ->where('is_available', true)
                ->first();

            abort_unless(
                $editorProfile,
                422,
                'Editor yang dipilih tidak tersedia.'
            );

            $editorFee = $editorProfile->fee;
        }

        $order = DB::transaction(function () use ($request, $validated, $editorFee) {

            $user = $request->user();
            [$items, $subtotal, $discountTotal, $reservedChapter] = $this->buildItems($validated);

            // Voucher: potongan dihitung per item (setelah diskon produk) dan
            // disimpan di baris pesanan supaya royalti/fee bisa dihitung ulang.
            $voucher = null;
            $voucherQuote = ['lines' => [], 'discount' => 0.0, 'fee' => 0.0];

            if (! empty($validated['voucher_code'])) {
                $voucher = $this->vouchers->findUsable($validated['voucher_code'], lock: true);
                $voucherQuote = $this->vouchers->quote($voucher, $items);

                abort_if(
                    $voucherQuote['discount'] <= 0,
                    422,
                    'Voucher ini tidak berlaku untuk item di pesanan Anda.'
                );
            }

            $order = Order::create([
                'order_number' => Order::generateOrderNumber(),
                'user_id' => $user->id,
                'status' => 'pending',
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'voucher_id' => $voucher?->id,
                'voucher_code' => $voucher?->code,
                'voucher_discount' => $voucherQuote['discount'],
                'voucher_fee' => $voucherQuote['fee'],
                'editor_id' => $validated['editor_id'] ?? null,
                'editor_fee' => $editorFee,
                'total' => $subtotal - $discountTotal - $voucherQuote['discount'] + $editorFee,
                'notes' => $validated['notes'] ?? null,
                'payment_method_id' => $validated['payment_method_id'] ?? null,
            ]);

            $order->logStatusHistory('order_placed');

            foreach ($items as $index => $item) {
                $order->items()->create(
                    Arr::except($item, ['target_type', 'target_id']) + [
                        'voucher_discount' => $voucherQuote['lines'][$index] ?? 0,
                    ]
                );
            }

            $reservedChapter?->update(['order_id' => $order->id]);

            if ($validated['type'] === 'book') {
                $this->createBookShipment($user, $order, $validated);
            }

            return $order->load(['items', 'editor', 'bookShipment', 'paymentMethod']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Pesanan berhasil dibuat. Selesaikan pembayaran dalam 1×24 jam.',
            'data' => $order,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Check voucher - Pratinjau potongan voucher untuk pilihan produk di
    | halaman pembayaran (tidak membuat pesanan)
    |--------------------------------------------------------------------------
    */

    public function checkVoucher(Request $request): JsonResponse
    {
        $validated = $request->validate([
            ...$this->selectionRules(),

            'voucher_code' => [
                'required',
                'string',
                'max:40',
            ],
        ]);

        $voucher = $this->vouchers->findUsable($validated['voucher_code']);

        // Item dibangun di dalam transaksi yang selalu dibatalkan: slot bab
        // dikunci/diperiksa seperti saat memesan, tapi tidak ada yang disimpan.
        DB::beginTransaction();

        try {
            $items = $this->buildItems($validated)[0];
        } finally {
            DB::rollBack();
        }

        $quote = $this->vouchers->quote($voucher, $items);

        abort_if(
            $quote['discount'] <= 0,
            422,
            'Voucher ini tidak berlaku untuk item di pesanan Anda.'
        );

        return response()->json([
            'success' => true,
            'message' => 'Voucher berlaku.',
            'data' => [
                'code' => $voucher->code,
                'name' => $voucher->name,
                'discount_percent' => $voucher->discount_percent,
                'voucher_discount' => $quote['discount'],
            ],
        ]);
    }

    /**
     * Aturan validasi pilihan produk (dipakai store dan checkVoucher).
     */
    private function selectionRules(): array
    {
        return [
            'type' => [
                'required',
                Rule::in(['package', 'custom', 'book_chapter', 'book']),
            ],

            'package_id' => [
                'required_if:type,package',
                'integer',
            ],

            'custom_item_ids' => [
                'required_if:type,custom',
                'array',
                'min:1',
            ],
            'custom_item_ids.*' => [
                'integer',
            ],

            'book_chapter_id' => [
                'required_if:type,book_chapter',
                'integer',
            ],

            'book_ids' => [
                'required_if:type,book',
                'array',
                'min:1',
            ],
            'book_ids.*' => [
                'integer',
            ],
        ];
    }

    /**
     * Bangun baris pesanan dari pilihan produk.
     *
     * @return array{0: list<array<string, mixed>>, 1: float, 2: float, 3: BookChapter|null}
     */
    private function buildItems(array $validated): array
    {
        if ($validated['type'] === 'book_chapter') {
            return $this->buildBookChapterItems($validated['book_chapter_id']);
        }

        if ($validated['type'] === 'book') {
            return [...$this->buildBookItems($validated['book_ids']), null];
        }

        return [
            ...($validated['type'] === 'package'
                ? $this->buildPackageItems($validated['package_id'])
                : $this->buildCustomItems($validated['custom_item_ids'])),
            null,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Mine - Riwayat pesanan milik user sendiri
    |--------------------------------------------------------------------------
    */

    public function mine(Request $request): JsonResponse
    {
        $orders = $request->user()
            ->orders()
            ->with(['items', 'editor', 'manuscript', 'bookShipment', 'eventRegistration', 'statusHistories', 'paymentMethod'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Riwayat pesanan berhasil diambil.',
            'data' => $orders,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Index - Admin melihat semua pesanan
    |--------------------------------------------------------------------------
    */

    // Kategori tab pesanan admin -> jenis item pesanan (semua item satu jenis).
    private const ADMIN_CATEGORIES = [
        'book' => [Book::class],
        'package' => [Package::class, CustomPackageItem::class],
        'book_chapter' => [BookChapter::class],
        'event' => [Event::class],
    ];

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?category=book|package|book_chapter|event, ?status=,
        // ?sort=time_desc|time_asc|status_asc|status_desc. meta.counts = jumlah per tab.
        $category = array_key_exists((string) $request->query('category'), self::ADMIN_CATEGORIES)
            ? (string) $request->query('category')
            : 'book';
        $inCategory = fn (string $key) => fn ($query) => $query->whereHas(
            'items',
            fn ($item) => $item->whereIn('itemable_type', self::ADMIN_CATEGORIES[$key])
        );

        $query = Order::with(['user', 'items', 'editor', 'bookShipment', 'eventRegistration', 'paymentMethod'])
            ->where($inCategory($category))
            ->when(
                in_array($request->query('status'), ['pending', 'confirmed', 'completed', 'cancelled'], true),
                fn ($q) => $q->where('status', $request->query('status'))
            );

        $statusRank = "CASE status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'completed' THEN 2 WHEN 'cancelled' THEN 3 ELSE 4 END";

        match ($request->query('sort')) {
            'time_asc' => $query->oldest()->orderBy('id'),
            'status_asc' => $query->orderByRaw("{$statusRank} ASC")->latest(),
            'status_desc' => $query->orderByRaw("{$statusRank} DESC")->latest(),
            default => $query->latest()->orderByDesc('id'),
        };

        $counts = collect(self::ADMIN_CATEGORIES)
            ->map(fn ($types, string $key) => Order::where($inCategory($key))->count());

        return $this->pageResponse(
            $query->paginate($this->perPage($request, 20)),
            'Daftar pesanan berhasil diambil.',
            meta: ['counts' => $counts]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Update Status - Admin mengubah status pesanan
    |--------------------------------------------------------------------------
    */

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(['pending', 'confirmed', 'cancelled', 'completed']),
            ],
        ]);

        $this->orderStatus->apply($order, $validated['status']);

        return response()->json([
            'success' => true,
            'message' => 'Status pesanan berhasil diperbarui.',
            'data' => $order->fresh(['items', 'editor', 'bookShipment', 'eventRegistration']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Payment Proof - Pembeli unggah bukti transfer
    |--------------------------------------------------------------------------
    */

    public function uploadPaymentProof(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 403, 'Anda tidak berwenang mengakses pesanan ini.');

        abort_unless(
            $order->status === 'pending',
            422,
            'Bukti transfer hanya bisa diunggah untuk pesanan yang masih menunggu verifikasi.'
        );

        // Lewat 1×24 jam tanpa bukti transfer: pesanan dibatalkan (penjadwal
        // biasanya sudah melakukannya; di sini untuk sela waktu sebelum itu).
        if ($order->isPaymentOverdue()) {
            $this->orderStatus->apply($order, 'cancelled', OrderStatusService::AUTO_CANCEL_NOTE);

            abort(422, 'Batas waktu pembayaran 1×24 jam sudah lewat, pesanan dibatalkan. Silakan buat pesanan baru.');
        }

        $validated = $request->validate([
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $path = $validated['file']->store('payment-proofs/'.$order->id, 'public');

        $order->update([
            'payment_proof_file' => $path,
            'payment_proof_uploaded_at' => now(),
        ]);

        $order->logStatusHistory('payment_proof_uploaded');

        return response()->json([
            'success' => true,
            'message' => 'Bukti transfer berhasil diunggah. Menunggu verifikasi admin.',
            'data' => $order->fresh(['items', 'editor', 'bookShipment', 'eventRegistration']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Verify Payment - Admin ACC atau tolak berdasarkan bukti transfer
    |--------------------------------------------------------------------------
    */

    public function verifyPayment(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note' => ['nullable', 'string', 'max:2000'],
            // Rekening yang menerima transfer (untuk saldo per rekening).
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')],
        ]);

        abort_unless($order->payment_proof_file, 422, 'Pesanan ini belum mengunggah bukti transfer.');

        abort_unless($order->status === 'pending', 422, 'Pesanan ini sudah diverifikasi sebelumnya.');

        // Rekening penerima: pilihan admin, lalu rekening pilihan pembeli di
        // invoice, lalu satu-satunya rekening aktif. Pilihan pembeli tetap
        // tersimpan bila ditolak (riwayat invoice).
        $order->update([
            'payment_verification_note' => $validated['note'] ?? null,
            'payment_method_id' => $validated['decision'] === 'approve'
                ? ($validated['payment_method_id'] ?? $order->payment_method_id ?? $this->onlyActiveAccount())
                : $order->payment_method_id,
        ]);

        $this->orderStatus->apply(
            $order,
            $validated['decision'] === 'approve' ? 'confirmed' : 'cancelled'
        );

        return response()->json([
            'success' => true,
            'message' => $validated['decision'] === 'approve'
                ? 'Pembayaran dikonfirmasi. Pesanan diterima.'
                : 'Bukti transfer ditolak. Pesanan dibatalkan.',
            'data' => $order->fresh(['items', 'editor', 'bookShipment', 'eventRegistration']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Invoice - Ringkasan tagihan pesanan (pembeli pemilik pesanan atau admin)
    |--------------------------------------------------------------------------
    */

    public function invoice(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $order->user_id === $user->id || $user->roles()->where('name', 'admin')->exists(),
            403,
            'Anda tidak berwenang melihat invoice ini.'
        );

        return response()->json([
            'success' => true,
            'message' => 'Invoice berhasil diambil.',
            'data' => InvoicePresenter::present($order),
        ]);
    }

    /**
     * Rekening tujuan transfer: wajib dipilih bila ada rekening aktif, dan
     * hanya boleh rekening yang aktif.
     *
     * @return list<mixed>
     */
    public static function paymentMethodRules(): array
    {
        return [
            PaymentMethod::where('is_active', true)->exists() ? 'required' : 'nullable',
            'integer',
            Rule::exists('payment_methods', 'id')->where('is_active', true),
        ];
    }

    /** Kalau hanya ada satu rekening aktif, itulah penerima transfernya. */
    private function onlyActiveAccount(): ?int
    {
        $ids = PaymentMethod::where('is_active', true)->limit(2)->pluck('id');

        return $ids->count() === 1 ? (int) $ids->first() : null;
    }

    /*
    |--------------------------------------------------------------------------
    | Confirm Shipment Received - Pembeli konfirmasi buku sudah sampai
    |--------------------------------------------------------------------------
    */

    public function confirmShipmentReceived(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 403, 'Anda tidak berwenang mengakses pesanan ini.');

        abort_unless(
            $order->bookShipment && $order->bookShipment->status === 'awaiting_confirmation',
            422,
            'Pesanan belum dalam status menunggu konfirmasi penerimaan.'
        );

        $order->bookShipment->markDelivered('user');

        return response()->json([
            'success' => true,
            'message' => 'Terima kasih telah mengonfirmasi. Pesanan selesai.',
            'data' => $order->fresh(['items', 'editor', 'bookShipment', 'eventRegistration']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Build order items - Paket admin
    |--------------------------------------------------------------------------
    */

    private function buildPackageItems(int $packageId): array
    {
        $package = Package::where('is_active', true)
            ->find($packageId);

        abort_unless(
            $package,
            404,
            'Paket tidak ditemukan.'
        );

        $discountTotal = round(
            $package->price * $package->discount / 100,
            2
        );

        $items = [[
            'itemable_type' => Package::class,
            'itemable_id' => $package->id,
            'name' => $package->name,
            'quantity' => 1,
            'unit_price' => $package->price,
            'subtotal' => $package->price,
            'discount' => $discountTotal,
            'target_type' => 'package',
            'target_id' => $package->id,
        ]];

        return [$items, (float) $package->price, $discountTotal];
    }

    /*
    |--------------------------------------------------------------------------
    | Build order items - Paket custom
    |--------------------------------------------------------------------------
    */

    private function buildCustomItems(array $itemIds): array
    {
        $itemIds = array_unique($itemIds);

        $customItems = CustomPackageItem::where('is_active', true)
            ->whereIn('id', $itemIds)
            ->get();

        abort_unless(
            $customItems->count() === count($itemIds),
            422,
            'Salah satu item yang dipilih tidak valid atau sudah tidak tersedia.'
        );

        $items = $customItems->map(function (CustomPackageItem $item) {
            return [
                'itemable_type' => CustomPackageItem::class,
                'itemable_id' => $item->id,
                'name' => $item->name,
                'quantity' => 1,
                'unit_price' => $item->price,
                'subtotal' => $item->price,
                'discount' => $item->discountAmount(),
                'target_type' => 'custom_item',
                'target_id' => $item->id,
            ];
        })->all();

        // Harga item disimpan sebelum diskon; diskon per item dijumlahkan ke
        // discount_total (sama seperti paket biasa).
        $subtotal = (float) $customItems->sum('price');
        $discountTotal = round(
            $customItems->sum(fn (CustomPackageItem $item) => $item->discountAmount()),
            2
        );

        return [$items, $subtotal, $discountTotal];
    }

    /*
    |--------------------------------------------------------------------------
    | Build order items - Beli buku dari katalog (bisa lebih dari 1 = keranjang)
    |--------------------------------------------------------------------------
    */

    private function buildBookItems(array $bookIds): array
    {
        $bookIds = array_unique($bookIds);

        $books = Book::where('is_active', true)
            ->whereIn('id', $bookIds)
            ->get();

        abort_unless(
            $books->count() === count($bookIds),
            422,
            'Salah satu buku yang dipilih tidak ditemukan atau sudah tidak tersedia.'
        );

        $items = $books->map(function (Book $book) {
            $unitPrice = (float) $book->price;

            return [
                'itemable_type' => Book::class,
                'itemable_id' => $book->id,
                'name' => $book->title,
                'quantity' => 1,
                'unit_price' => $unitPrice,
                'subtotal' => $unitPrice,
                'discount' => round($unitPrice * $book->discount / 100, 2),
                'target_type' => 'book',
                'target_id' => $book->id,
            ];
        })->all();

        $subtotal = (float) $books->sum('price');
        $discountTotal = (float) $books->sum(
            fn (Book $book) => round($book->price * $book->discount / 100, 2)
        );

        return [$items, $subtotal, $discountTotal];
    }

    /*
    |--------------------------------------------------------------------------
    | Buat data pengiriman untuk pesanan buku fisik
    |--------------------------------------------------------------------------
    | Alamat baru dari form dipakai kalau diisi, kalau tidak fallback ke data
    | tersimpan (nama akun + no. HP/alamat domisili di Data Pribadi).
    */

    private function createBookShipment(User $user, Order $order, array $validated): void
    {
        $personalProfile = $user->personalProfile;

        $recipientName = $validated['recipient_name'] ?? $user->name;
        $recipientPhone = $validated['recipient_phone'] ?? $personalProfile?->phone;
        $recipientAddress = $validated['recipient_address'] ?? $personalProfile?->domicile_address;

        abort_if(
            blank($recipientPhone) || blank($recipientAddress),
            422,
            'Alamat pengiriman belum lengkap. Isi alamat pengiriman baru, atau lengkapi Data Pribadi Anda terlebih dahulu.'
        );

        BookShipment::create([
            'order_id' => $order->id,
            'recipient_name' => $recipientName,
            'recipient_phone' => $recipientPhone,
            'recipient_address' => $recipientAddress,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Build order items - Slot bab Book Chapter
    |--------------------------------------------------------------------------
    */

    private function buildBookChapterItems(int $chapterId): array
    {
        $chapter = BookChapter::whereKey($chapterId)
            ->lockForUpdate()
            ->with('book')
            ->first();

        abort_unless($chapter, 404, 'Slot bab tidak ditemukan.');

        abort_if($chapter->manuscript_id, 422, 'Slot bab ini sudah terisi.');

        abort_if($chapter->order_id, 422, 'Slot bab ini sedang dipesan penulis lain.');

        abort_if(
            $chapter->book->submission_deadline && $chapter->book->submission_deadline->isPast(),
            422,
            'Batas waktu pengumpulan naskah untuk buku ini sudah lewat.'
        );

        $price = (float) ($chapter->price ?? $chapter->book->price);
        $discount = $chapter->discount ?? $chapter->book->discount;

        $discountTotal = round($price * $discount / 100, 2);

        $items = [[
            'itemable_type' => BookChapter::class,
            'itemable_id' => $chapter->id,
            'name' => $chapter->book->title.' — '.$chapter->title,
            'quantity' => 1,
            'unit_price' => $price,
            'subtotal' => $price,
            'discount' => $discountTotal,
            'target_type' => 'book',
            'target_id' => $chapter->book_id,
        ]];

        return [$items, $price, $discountTotal, $chapter];
    }
}
