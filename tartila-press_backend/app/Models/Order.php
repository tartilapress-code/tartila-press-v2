<?php

namespace App\Models;

use App\Support\OrderNumber;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Order extends Model
{
    /** Batas waktu pembayaran (unggah bukti transfer) sejak pesanan dibuat. */
    public const PAYMENT_WINDOW_HOURS = 24;

    protected $fillable = [
        'order_number',
        'invoice_number',
        'payment_due_at',
        'user_id',
        'status',
        'subtotal',
        'discount_total',
        'editor_id',
        'editor_fee',
        'wants_coauthor',
        'coauthor_id',
        'coauthor_fee',
        'voucher_id',
        'voucher_code',
        'voucher_discount',
        'voucher_fee',
        'total',
        'notes',
        'payment_proof_file',
        'payment_proof_uploaded_at',
        'payment_verification_note',
        'payment_method_id',
    ];

    // Fee pembuat voucher hanya relevan untuk pembuatnya, bukan untuk pembeli.
    protected $hidden = [
        'voucher_fee',
    ];

    protected $appends = [
        'payment_proof_url',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'editor_fee' => 'decimal:2',
            'coauthor_fee' => 'decimal:2',
            'wants_coauthor' => 'boolean',
            'voucher_discount' => 'decimal:2',
            'voucher_fee' => 'decimal:2',
            'total' => 'decimal:2',
            'payment_proof_uploaded_at' => 'datetime',
            'payment_due_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Pesanan baru menunggu pembayaran: batas 1×24 jam.
        static::creating(function (Order $order) {
            if (($order->status ?? 'pending') === 'pending' && ! $order->payment_due_at) {
                $order->payment_due_at = now()->addHours(self::PAYMENT_WINDOW_HOURS);
            }
        });

        // Nomor invoice butuh id, jadi diisi setelah tersimpan.
        static::created(function (Order $order) {
            if (! $order->invoice_number) {
                $order->forceFill(['invoice_number' => self::invoiceNumberFor($order)])->saveQuietly();
            }
        });
    }

    /** INV-YYYYMMDD-000ID, mis. INV-20261007-00091. */
    public static function invoiceNumberFor(Order $order): string
    {
        return sprintf('INV-%s-%05d', ($order->created_at ?? now())->format('Ymd'), $order->id);
    }

    /** Masih menunggu bukti transfer dan batas bayarnya sudah lewat. */
    public function isPaymentOverdue(): bool
    {
        return $this->status === 'pending'
            && ! $this->payment_proof_file
            && $this->payment_due_at !== null
            && $this->payment_due_at->isPast();
    }

    protected function paymentProofUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->payment_proof_file
                ? Storage::disk('public')->url($this->payment_proof_file)
                : null,
        );
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function coauthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'coauthor_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }

    /** Rekening yang menerima pembayaran pesanan ini. */
    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function manuscript(): HasOne
    {
        return $this->hasOne(Manuscript::class);
    }

    public function bookChapterSlot(): HasOne
    {
        return $this->hasOne(BookChapter::class);
    }

    public function bookShipment(): HasOne
    {
        return $this->hasOne(BookShipment::class);
    }

    public function eventRegistration(): HasOne
    {
        return $this->hasOne(EventRegistration::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OrderMessage::class)->orderBy('created_at');
    }

    public function logStatusHistory(string $event, ?string $note = null): void
    {
        $this->statusHistories()->create([
            'event' => $event,
            'note' => $note,
        ]);
    }

    /** Nomor pesanan ORD-YYYYMMDD-NNNK (lihat OrderNumber); $code = kode jenis, bawaan paket. */
    public static function generateOrderNumber(string $code = OrderNumber::PACKAGE): string
    {
        return OrderNumber::make($code);
    }
}
