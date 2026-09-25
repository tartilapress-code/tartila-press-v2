<?php

namespace App\Http\Controllers\Api\V1\Order;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookShipment;
use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Order;
use App\Models\Package;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Store - User mengambil paket (admin atau custom)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
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

            'editor_id' => [
                'nullable',
                'integer',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

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
            $reservedChapter = null;

            if ($validated['type'] === 'book_chapter') {
                [$items, $subtotal, $discountTotal, $reservedChapter] =
                    $this->buildBookChapterItems($validated['book_chapter_id']);
            } elseif ($validated['type'] === 'book') {
                [$items, $subtotal, $discountTotal] = $this->buildBookItems($validated['book_ids']);
            } else {
                [$items, $subtotal, $discountTotal] = $validated['type'] === 'package'
                    ? $this->buildPackageItems($validated['package_id'])
                    : $this->buildCustomItems($validated['custom_item_ids']);
            }

            $order = Order::create([
                'order_number' => Order::generateOrderNumber(),
                'user_id' => $user->id,
                'status' => 'pending',
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'editor_id' => $validated['editor_id'] ?? null,
                'editor_fee' => $editorFee,
                'total' => $subtotal - $discountTotal + $editorFee,
                'notes' => $validated['notes'] ?? null,
            ]);

            $order->logStatusHistory('order_placed');

            foreach ($items as $item) {
                $order->items()->create($item);
            }

            $reservedChapter?->update(['order_id' => $order->id]);

            if ($validated['type'] === 'book') {
                $this->createBookShipment($user, $order, $validated);
            }

            return $order->load(['items', 'editor', 'bookShipment']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Pesanan berhasil dibuat.',
            'data' => $order,
        ], 201);
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
            ->with(['items', 'editor', 'manuscript', 'bookShipment', 'eventRegistration', 'statusHistories'])
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

    public function index(): JsonResponse
    {
        $orders = Order::with(['user', 'items', 'editor', 'bookShipment', 'eventRegistration'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar pesanan berhasil diambil.',
            'data' => $orders,
        ]);
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

        $this->applyStatusChange($order, $validated['status']);

        return response()->json([
            'success' => true,
            'message' => 'Status pesanan berhasil diperbarui.',
            'data' => $order->fresh(['items', 'editor', 'bookShipment', 'eventRegistration']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Terapkan efek samping perubahan status (dipakai updateStatus &
    | verifyPayment supaya sinkronisasi book_chapter/book_shipment tidak
    | terduplikasi di 2 tempat)
    |--------------------------------------------------------------------------
    */

    private function applyStatusChange(Order $order, string $status): void
    {
        $order->update(['status' => $status]);

        if ($status === 'cancelled') {
            BookChapter::where('order_id', $order->id)
                ->whereNull('manuscript_id')
                ->update(['order_id' => null]);

            $order->bookShipment?->update(['status' => 'cancelled']);

            $order->eventRegistration?->update(['status' => 'cancelled']);

            $order->logStatusHistory('order_cancelled', $order->payment_verification_note);
        }

        if ($status === 'confirmed') {
            $order->logStatusHistory('payment_confirmed');
        }

        if ($status === 'confirmed' && $order->bookShipment?->status === 'pending') {
            $order->bookShipment->update(['status' => 'confirmed']);
        }

        if ($status === 'confirmed' && $order->eventRegistration?->status === 'pending') {
            $order->eventRegistration->update(['status' => 'confirmed']);
        }

        if ($status === 'completed' && ! $order->bookShipment) {
            $order->logStatusHistory('order_completed');
        }

        if ($status === 'completed'
            && $order->bookShipment
            && $order->bookShipment->status !== 'delivered') {
            $order->bookShipment->markDelivered('admin');
        }
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
        ]);

        abort_unless($order->payment_proof_file, 422, 'Pesanan ini belum mengunggah bukti transfer.');

        abort_unless($order->status === 'pending', 422, 'Pesanan ini sudah diverifikasi sebelumnya.');

        $order->update(['payment_verification_note' => $validated['note'] ?? null]);

        $this->applyStatusChange(
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
        ]];

        return [$items, $price, $discountTotal, $chapter];
    }
}
