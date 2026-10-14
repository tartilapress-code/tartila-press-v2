<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\Mou;
use App\Models\OrderItem;
use App\Models\User;
use App\Models\Voucher;
use App\Support\PartnerSplit;
use Illuminate\Support\Collection;

class BookRoyaltyService
{
    /** Paket penerbit biasa: royalti penulis 25% (dibagi rata kalau penulisnya lebih dari satu). */
    public const REGULAR_AUTHOR_POOL = 25.0;

    /** Paket Book Chapter: 25% dibagi jumlah bab, tiap penulis menerima nilai bab yang ditulisnya ... */
    public const CHAPTER_AUTHOR_POOL = 25.0;

    /** ... ditambah 5% untuk editor pemilik proyek kalau proyeknya dikelola editor. */
    public const CHAPTER_EDITOR_RATE = 5.0;

    public const PACKAGE_LABELS = [
        'regular' => 'Paket penerbit biasa',
        'chapter_editor' => 'Book Chapter oleh editor',
        'chapter_admin' => 'Book Chapter oleh admin',
    ];

    /**
     * Relasi yang harus di-eager-load sebelum memanggil authors()/shares().
     */
    public const SHARE_RELATIONS = [
        'manuscript.user',
        'manuscript.authorLinks.user',
        'chapters.manuscript.user',
        'chapters.manuscript.authorLinks.user',
        'ownerEditor',
        'manuscript.mou.signatories.user',
        'chapterMou.signatories.user',
        'partner.user',
        'partnerAuthors',
    ];

    /**
     * Jenis paket sebuah buku: regular, chapter_editor (proyek Book Chapter
     * yang dipegang editor), atau chapter_admin.
     */
    public function package(Book $book): string
    {
        if (! $book->is_chapter_compilation) {
            return 'regular';
        }

        return $book->owner_editor_id ? 'chapter_editor' : 'chapter_admin';
    }

    /**
     * Penulis buku (akun, tanpa duplikat). Buku kompilasi: penulis semua bab;
     * buku biasa: penulis naskah (co-author kalau ada, kalau tidak pemilik
     * naskah).
     *
     * @return Collection<int, User>
     */
    public function authors(Book $book): Collection
    {
        // Buku mitra: penulis = akun yang dipilih mitra.
        if ($book->isPartnerBook()) {
            return $book->partnerAuthors->values();
        }

        if ($book->is_chapter_compilation) {
            return $book->chapters
                ->map(fn ($chapter) => $chapter->manuscript)
                ->filter()
                ->flatMap(fn (Manuscript $manuscript) => $this->manuscriptAuthors($manuscript))
                ->unique('id')
                ->values();
        }

        return $book->manuscript
            ? $this->manuscriptAuthors($book->manuscript)->unique('id')->values()
            : collect();
    }

    /**
     * Pembagian royalti: satu entri per penerima (penulis / editor) dengan
     * persentasenya. Buku tanpa penulis yang terhubung ke akun tidak
     * menghasilkan royalti.
     *
     * @return list<array{user_id: int, name: string, role: string, rate: float, chapters?: int, total_chapters?: int}>
     */
    public function shares(Book $book): array
    {
        $shares = [];

        // Buku mitra: penulis 50% (dibagi rata) dan mitra 30% dari harga jual ebook; Tartila 20%.
        if ($book->isPartnerBook()) {
            $split = PartnerSplit::PURCHASE;
            $authors = $this->authors($book);

            foreach ($authors as $author) {
                $each = round($split['author'] / max(1, $authors->count()), 4);
                $shares[] = ['user_id' => $author->id, 'name' => $author->name, 'role' => 'author', 'rate' => $each, 'ebook_rate' => $each];
            }

            if ($book->partner?->user) {
                $shares[] = ['user_id' => $book->partner->user_id, 'name' => $book->partner->company_name, 'role' => 'partner', 'rate' => $split['partner'], 'ebook_rate' => $split['partner']];
            }

            return $shares;
        }

        $mou = $this->bindingMou($book);

        if ($mou) {
            // MOU yang sudah ditandatangani semua penulis: royalti buku fisik
            // dan ebook per penulis mengikuti MOU (tidak ikut aturan baru).
            foreach ($mou->signatories as $signatory) {
                $shares[] = array_filter([
                    'user_id' => $signatory->user_id,
                    'name' => $signatory->user?->name ?? ($signatory->identity['name'] ?? '-'),
                    'role' => 'author',
                    'rate' => round((float) $signatory->royalty_physical, 4),
                    'ebook_rate' => round((float) $signatory->royalty_ebook, 4),
                    'chapters' => $signatory->chapters,
                    'total_chapters' => $signatory->chapters !== null ? max(1, $book->chapters->count()) : null,
                    'mou_id' => $mou->id,
                ], fn ($value) => $value !== null);
            }
        } elseif ($book->is_chapter_compilation) {
            // Per bab: tiap bab bernilai 25% / jumlah bab buku. Penulis bab
            // (atau para co-author bab itu, dibagi rata) menerima nilainya,
            // jadi penulis yang memegang lebih banyak bab dapat lebih besar.
            $totalChapters = max(1, $book->chapters->count());
            $perChapter = self::CHAPTER_AUTHOR_POOL / $totalChapters;
            $earned = [];

            foreach ($book->chapters as $chapter) {
                if (! $chapter->manuscript) {
                    continue;
                }

                $writers = $this->manuscriptAuthors($chapter->manuscript)->unique('id');

                foreach ($writers as $writer) {
                    $earned[$writer->id]['user'] = $writer;
                    $earned[$writer->id]['rate'] = ($earned[$writer->id]['rate'] ?? 0) + $perChapter / $writers->count();
                    $earned[$writer->id]['chapters'] = ($earned[$writer->id]['chapters'] ?? 0) + 1;
                }
            }

            foreach ($earned as $row) {
                $shares[] = [
                    'user_id' => $row['user']->id,
                    'name' => $row['user']->name,
                    'role' => 'author',
                    'rate' => round($row['rate'], 4),
                    'chapters' => $row['chapters'],
                    'total_chapters' => $totalChapters,
                ];
            }
        } else {
            $authors = $this->authors($book);

            if ($authors->isNotEmpty()) {
                // Co-author (layanan co-author) mendapat jatah tetap di luar pembagian rata penulis.
                $coauthorIds = $book->manuscript?->authorLinks->where('is_coauthor', true)->pluck('user_id')->all() ?? [];
                $mainCount = $authors->reject(fn (User $author) => in_array($author->id, $coauthorIds, true))->count();
                $each = round(self::REGULAR_AUTHOR_POOL / max(1, $mainCount), 4);

                foreach ($authors as $author) {
                    $isCoauthor = in_array($author->id, $coauthorIds, true);
                    $shares[] = [
                        'user_id' => $author->id,
                        'name' => $author->name,
                        'role' => 'author',
                        'rate' => $isCoauthor ? app(ManuscriptAssignmentService::class)->royaltyPercent() : $each,
                    ];
                }
            }
        }

        if ($this->package($book) === 'chapter_editor' && $book->ownerEditor) {
            $shares[] = [
                'user_id' => $book->ownerEditor->id,
                'name' => $book->ownerEditor->name,
                'role' => 'editor',
                'rate' => self::CHAPTER_EDITOR_RATE,
            ];
        }

        // Tanpa MOU: royalti ebook sama dengan royalti buku fisik (aturan lama).
        return array_map(fn (array $share) => $share + ['ebook_rate' => $share['rate']], $shares);
    }

    /** MOU distribusi buku yang sudah ditandatangani semua penulis, bila ada. */
    public function bindingMou(Book $book): ?Mou
    {
        $mou = $book->is_chapter_offering || ($book->is_chapter_compilation && ! $book->manuscript_id)
            ? $book->chapterMou
            : $book->manuscript?->mou;

        return $mou?->isBinding() ? $mou : null;
    }

    /**
     * Ringkas data royalti satu buku untuk persentase $rate. Caller wajib
     * eager-load 'orderItems.order' dan 'externalSales' di $book sebelum
     * memanggil ini supaya tidak ada query tambahan per buku (penting saat
     * admin index memproses banyak buku sekaligus).
     *
     * Voucher yang dibuat penulis/editor dari royaltinya sendiri ('royalty')
     * mengurangi royalti pembuatnya sebesar potongan yang dia berikan ke
     * pembeli. $userId = royalti satu penerima; null = semua pembuat (total
     * buku). Muat juga 'orderItems.order.voucher' supaya tidak query per item.
     */
    public function summarize(Book $book, float $rate, ?int $userId = null, ?float $ebookRate = null): array
    {
        // Penjualan di sistem = buku fisik; penjualan luar per jenisnya.
        $ebookRate ??= $rate;
        $rateFor = fn ($sale) => ($sale->format ?? 'physical') === 'ebook' ? $ebookRate : $rate;

        $completedItems = $book->orderItems->filter(
            fn (OrderItem $item) => $item->order?->status === 'completed'
        );

        $completedQuantity = (int) $completedItems->sum('quantity');

        // Pakai unit_price yang tersimpan di tiap OrderItem (snapshot harga
        // saat order dibuat), bukan book->price saat ini — supaya royalti
        // transaksi yang sudah selesai tidak ikut berubah kalau harga buku
        // diubah admin belakangan.
        $systemRevenue = $completedItems->sum(
            fn (OrderItem $item) => (float) $item->unit_price * $item->quantity
        );

        $voucherDeduction = round($completedItems->sum(function (OrderItem $item) use ($userId) {
            $voucher = $item->order?->voucher;

            if (! $voucher || $voucher->source !== Voucher::SOURCE_ROYALTY) {
                return 0;
            }

            return $userId === null || $voucher->user_id === $userId ? (float) $item->voucher_discount : 0;
        }), 2);

        $systemRoyaltyAmount = max(0, round($systemRevenue * $rate / 100 - $voucherDeduction, 2));

        $externalQuantity = (int) $book->externalSales->sum('quantity_sold');
        $externalRoyaltyAmount = round(
            $book->externalSales->sum(
                fn ($sale) => (float) $sale->original_price * $rateFor($sale) / 100 * $sale->quantity_sold
            ),
            2
        );

        return [
            'total_orders_count' => $book->orderItems->count(),
            'completed_orders_count' => $completedItems->count(),
            'completed_quantity' => $completedQuantity,
            'voucher_deduction' => $voucherDeduction,
            'system_royalty_amount' => $systemRoyaltyAmount,
            'external_quantity' => $externalQuantity,
            'external_royalty_amount' => $externalRoyaltyAmount,
            'total_quantity_sold' => $completedQuantity + $externalQuantity,
            'total_royalty_amount' => round($systemRoyaltyAmount + $externalRoyaltyAmount, 2),
        ];
    }

    /**
     * @return Collection<int, User>
     */
    private function manuscriptAuthors(Manuscript $manuscript): Collection
    {
        $linked = $manuscript->authorLinks->pluck('user')->filter();

        return $linked->isNotEmpty() ? $linked : collect([$manuscript->user])->filter();
    }
}
