<?php

namespace App\Services\Reader;

use App\Models\Book;
use App\Models\Reader\ReaderAccessRule;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderEntitlement;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Siapa yang boleh membaca sebuah buku di Tartila Book.
 *
 * Urutan: penulis buku (gratis) → langganan aktif (semua buku) → pembelian
 * aktif buku itu → jadwal "dibuka" (baca gratis). Selain itu buku terkunci.
 * Jadwal "dikunci" mematikan baca gratis (mis. semua buku dibuka akhir pekan
 * kecuali buku tertentu), tapi tidak mencabut hak penulis, langganan atau
 * pembelian.
 */
class ReaderAccessService
{
    /**
     * @return array{allowed: bool, reason: string, expires_at: ?string}
     *                                                                   reason: author | subscription | purchase | free | locked
     */
    public function evaluate(?User $user, ReaderBook $readerBook): array
    {
        if ($user) {
            if ($this->isAuthor($user, $readerBook)) {
                return $this->result(true, 'author');
            }

            $subscription = $this->activeSubscription($user);

            if ($subscription) {
                return $this->result(true, 'subscription', $subscription->ends_at?->toIso8601String());
            }

            $purchase = ReaderEntitlement::active()
                ->where('user_id', $user->id)
                ->where('kind', 'book')
                ->where('reader_book_id', $readerBook->id)
                ->orderByRaw('ends_at IS NULL DESC')
                ->orderByDesc('ends_at')
                ->first();

            if ($purchase) {
                return $this->result(true, 'purchase', $purchase->ends_at?->toIso8601String());
            }
        }

        $rule = $this->activeRule($readerBook);

        if ($rule?->action === 'open') {
            return $this->result(true, 'free', $rule->ends_at?->toIso8601String());
        }

        return $this->result(false, 'locked');
    }

    /** Baca gratis saat ini (jadwal dibuka berlaku), untuk label katalog. */
    public function isFreeNow(ReaderBook $readerBook): bool
    {
        return $this->activeRule($readerBook)?->action === 'open';
    }

    /**
     * Status baca gratis banyak buku sekaligus (satu query aturan), untuk daftar katalog.
     *
     * @param  Collection<int, ReaderBook>  $books
     * @return array<int, bool> id buku => gratis sekarang
     */
    public function freeNowMap(Collection $books): array
    {
        $rules = ReaderAccessRule::active()->get();

        return $books->mapWithKeys(fn (ReaderBook $book) => [
            $book->id => $this->pickRule($rules, $book->id)?->action === 'open',
        ])->all();
    }

    public function activeSubscription(User $user): ?ReaderEntitlement
    {
        return ReaderEntitlement::active()
            ->where('user_id', $user->id)
            ->where('kind', 'plan')
            ->orderByRaw('ends_at IS NULL DESC')
            ->orderByDesc('ends_at')
            ->first();
    }

    public function isAuthor(User $user, ReaderBook $readerBook): bool
    {
        return Book::publishedByAuthor($user->id)->whereKey($readerBook->book_id)->exists();
    }

    private function activeRule(ReaderBook $readerBook): ?ReaderAccessRule
    {
        return $this->pickRule(
            ReaderAccessRule::active()->where(fn ($q) => $q->whereNull('reader_book_id')->orWhere('reader_book_id', $readerBook->id))->get(),
            $readerBook->id
        );
    }

    /**
     * Aturan yang menang: khusus buku mengalahkan "semua buku", lalu yang
     * paling baru dimulai.
     *
     * @param  Collection<int, ReaderAccessRule>  $rules
     */
    private function pickRule(Collection $rules, int $readerBookId): ?ReaderAccessRule
    {
        return $rules
            ->filter(fn (ReaderAccessRule $rule) => $rule->reader_book_id === null || $rule->reader_book_id === $readerBookId)
            ->sortBy([
                fn (ReaderAccessRule $a, ReaderAccessRule $b) => ($b->reader_book_id !== null) <=> ($a->reader_book_id !== null),
                fn (ReaderAccessRule $a, ReaderAccessRule $b) => $b->starts_at <=> $a->starts_at,
                fn (ReaderAccessRule $a, ReaderAccessRule $b) => $b->id <=> $a->id,
            ])
            ->first();
    }

    /** @return array{allowed: bool, reason: string, expires_at: ?string} */
    private function result(bool $allowed, string $reason, ?string $expiresAt = null): array
    {
        return ['allowed' => $allowed, 'reason' => $reason, 'expires_at' => $expiresAt];
    }
}
