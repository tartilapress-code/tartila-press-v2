<?php

namespace App\Services\Reader;

use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderEntitlement;
use App\Models\Reader\ReaderOrder;
use App\Models\Reader\ReaderPlan;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pembelian buku satuan / langganan di Tartila Book: pesanan transfer
 * (batas bayar 1×24 jam), verifikasi admin, lalu hak baca.
 */
class ReaderOrderService
{
    public function __construct(private readonly Notifier $notifier) {}

    public function create(User $user, string $kind, int $targetId, ?int $paymentMethodId): ReaderOrder
    {
        if ($kind === 'book') {
            $book = ReaderBook::listed()->with('book:id,title')->find($targetId);
            abort_unless($book, 404, 'Buku tidak ditemukan.');
            abort_unless($book->price !== null && $book->price > 0, 422, 'Buku ini tidak dijual satuan.');

            $attributes = ['reader_book_id' => $book->id, 'title' => $book->book->title, 'amount' => $book->price];
        } else {
            $plan = ReaderPlan::where('is_active', true)->find($targetId);
            abort_unless($plan, 404, 'Paket langganan tidak ditemukan.');

            $attributes = ['reader_plan_id' => $plan->id, 'title' => 'Langganan '.$plan->name, 'amount' => $plan->price];
        }

        // Pesanan yang sama yang masih menunggu pembayaran dipakai lagi.
        $existing = ReaderOrder::where('user_id', $user->id)
            ->where('kind', $kind)
            ->where('status', 'pending')
            ->where(fn ($q) => $q->whereNull('payment_due_at')->orWhere('payment_due_at', '>', now())->orWhereNotNull('payment_proof_file'))
            ->where($kind === 'book' ? 'reader_book_id' : 'reader_plan_id', $targetId)
            ->first();

        if ($existing) {
            return $existing->load('paymentMethod');
        }

        return ReaderOrder::create($attributes + [
            'order_number' => 'RB-'.now('Asia/Jakarta')->format('Ymd').'-'.strtoupper(Str::random(5)),
            'user_id' => $user->id,
            'kind' => $kind,
            'status' => 'pending',
            'payment_method_id' => $paymentMethodId,
            'payment_due_at' => now()->addHours(ReaderOrder::PAYMENT_WINDOW_HOURS),
        ])->load('paymentMethod');
    }

    public function approve(ReaderOrder $order, ?string $note = null): ReaderOrder
    {
        DB::transaction(function () use ($order, $note) {
            $order->update(['status' => 'confirmed', 'confirmed_at' => now(), 'payment_verification_note' => $note]);
            $this->grant($order);
        });

        $this->notifier->guard(fn () => $this->notifier->notify(
            $order->user,
            'reader',
            'Pembayaran dikonfirmasi',
            $order->title.' — sekarang bisa dibaca.',
            $order->reader_book_id ? "/buku/{$order->reader_book_id}" : '/rak',
            ['subject_type' => 'reader_order', 'subject_id' => $order->id]
        ));

        return $order->fresh();
    }

    public function reject(ReaderOrder $order, ?string $note, bool $auto = false): ReaderOrder
    {
        $order->update(['status' => 'cancelled', 'payment_verification_note' => $note]);

        $this->notifier->guard(fn () => $this->notifier->notify(
            $order->user,
            'reader',
            $auto ? 'Pesanan dibatalkan' : 'Bukti transfer ditolak',
            $order->title.($note ? " — {$note}" : ''),
            '/pesanan',
            ['subject_type' => 'reader_order', 'subject_id' => $order->id]
        ));

        return $order->fresh();
    }

    public function cancelOverdue(): int
    {
        $count = 0;

        ReaderOrder::where('status', 'pending')
            ->whereNull('payment_proof_file')
            ->whereNotNull('payment_due_at')
            ->where('payment_due_at', '<=', now())
            ->orderBy('id')
            ->each(function (ReaderOrder $order) use (&$count) {
                $this->reject($order, ReaderOrder::AUTO_CANCEL_NOTE, auto: true);
                $count++;
            });

        return $count;
    }

    /**
     * Hak baca dari pesanan yang dikonfirmasi (sekali per pesanan).
     * Langganan baru disambung setelah langganan aktif yang masih berjalan.
     */
    private function grant(ReaderOrder $order): void
    {
        if (ReaderEntitlement::where('reader_order_id', $order->id)->exists()) {
            return;
        }

        $now = now();

        if ($order->kind === 'plan') {
            $plan = $order->plan ?? ReaderPlan::findOrFail($order->reader_plan_id);
            $latest = ReaderEntitlement::where('user_id', $order->user_id)->where('kind', 'plan')->max('ends_at');
            $start = $latest && now()->lt($latest) ? Carbon::parse($latest) : $now;

            ReaderEntitlement::create([
                'user_id' => $order->user_id,
                'kind' => 'plan',
                'reader_plan_id' => $plan->id,
                'reader_order_id' => $order->id,
                'starts_at' => $now,
                'ends_at' => $plan->endsAt($start),
            ]);

            return;
        }

        $book = ReaderBook::findOrFail($order->reader_book_id);
        $latest = ReaderEntitlement::where('user_id', $order->user_id)->where('kind', 'book')
            ->where('reader_book_id', $book->id)->orderByRaw('ends_at IS NULL DESC')->orderByDesc('ends_at')->first();

        // Sudah punya akses selamanya: tidak perlu hak baru.
        if ($latest && $latest->ends_at === null && $latest->starts_at->lte($now)) {
            return;
        }

        $start = $latest?->ends_at && now()->lt($latest->ends_at) ? $latest->ends_at : $now;

        ReaderEntitlement::create([
            'user_id' => $order->user_id,
            'kind' => 'book',
            'reader_book_id' => $book->id,
            'reader_order_id' => $order->id,
            'starts_at' => $now,
            'ends_at' => $book->access_days ? $start->copy()->addDays($book->access_days) : null,
        ]);
    }
}
