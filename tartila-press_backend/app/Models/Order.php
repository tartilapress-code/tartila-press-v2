<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'user_id',
        'status',
        'subtotal',
        'discount_total',
        'editor_id',
        'editor_fee',
        'total',
        'notes',
        'payment_proof_file',
        'payment_proof_uploaded_at',
        'payment_verification_note',
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
            'total' => 'decimal:2',
            'payment_proof_uploaded_at' => 'datetime',
        ];
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

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
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

    public static function generateOrderNumber(): string
    {
        do {
            $orderNumber = 'ORD-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (static::where('order_number', $orderNumber)->exists());

        return $orderNumber;
    }
}
