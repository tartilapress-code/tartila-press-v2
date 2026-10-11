<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\HkiRecord;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Daftar karya yang memiliki layanan HKI dan pengurusannya:
 * - pesanan paket / paket custom yang sudah dibayar dan memuat HKI;
 * - proyek Book Chapter dengan HKI (semua penulis bab);
 * - buku lain bertanda HKI.
 * Sertifikat HKI yang diunggah admin muncul untuk SEMUA penulis karya itu.
 */
class HkiService
{
    private const MANUSCRIPT_STATUS = [
        'submitted' => 'Naskah direview admin',
        'revision_requested' => 'Revisi penulis',
        'pending_editor_assignment' => 'Menunggu editor',
        'in_editing' => 'Sedang diedit',
        'pending_admin_review_editor' => 'Hasil edit direview admin',
        'editor_revision_requested' => 'Revisi editor',
        'pending_penulis_review' => 'Review akhir penulis',
        'completed' => 'Naskah selesai',
        'awaiting_compilation' => 'Menunggu bab lain',
        'compiled' => 'Digabung ke naskah buku',
    ];

    public function __construct(private readonly FinanceService $finance) {}

    /**
     * Semua karya ber-HKI beserta status buku dan status HKI-nya.
     *
     * @return list<array<string, mixed>>
     */
    public function entries(): array
    {
        $records = HkiRecord::all()->keyBy(fn (HkiRecord $record) => $record->subject_type.':'.$record->subject_id);
        $overrides = $this->finance->hkiOverrides();
        $rows = collect();
        $coveredBooks = [];

        // 1. Pesanan paket / paket custom yang dibayar dan memuat HKI.
        $orders = $this->finance->paidOrders()->filter(
            fn (Order $order) => in_array($this->finance->orderType($order), ['package', 'custom_package'], true)
                && ($records->has("order:{$order->id}") || $this->finance->orderIncludesHki($order, $overrides))
        );

        EloquentCollection::make($orders->all())
            ->loadMissing(['manuscript.authorLinks.user:id,name', 'manuscript.user:id,name', 'manuscript.book']);

        foreach ($orders as $order) {
            $record = $records->get("order:{$order->id}");

            if ($order->manuscript?->book) {
                $coveredBooks[$order->manuscript->book->id] = true;
            }

            $rows->push($this->row('order', $order->id, $record, [
                'title' => $order->manuscript?->title ?? ($order->items->pluck('name')->implode(', ').' — '.$order->user?->name),
                'source' => FinanceService::ORDER_TYPES[$this->finance->orderType($order)].' · '.$order->order_number,
                'authors' => $this->orderAuthors($order),
                'book_status' => $this->orderBookStatus($order),
                'published' => (bool) $order->manuscript?->book?->isbn,
                'date' => $this->finance->paidAt($order)->toDateString(),
            ]));
        }

        // 2. Proyek Book Chapter dan buku lain bertanda HKI.
        $books = Book::with(['chapters.manuscript.authorLinks.user:id,name', 'chapters.manuscript.user:id,name', 'chapters.order', 'compilation', 'manuscript.authorLinks.user:id,name', 'manuscript.user:id,name'])
            ->where(fn ($query) => $query->where('includes_hki', true)
                ->orWhereIn('id', $records->where('subject_type', 'book')->pluck('subject_id')))
            ->get();

        foreach ($books as $book) {
            $record = $records->get("book:{$book->id}");

            if (isset($coveredBooks[$book->id]) || (! $record && ! $this->finance->bookIncludesHki($book, $overrides))) {
                continue;
            }

            $isProject = $book->is_chapter_offering || $book->is_chapter_compilation;

            $rows->push($this->row('book', $book->id, $record, [
                'title' => $book->title,
                'source' => $isProject ? 'Book Chapter' : 'Buku',
                'authors' => $this->bookAuthors($book),
                'book_status' => $this->bookStatus($book),
                'published' => (bool) $book->isbn,
                'date' => $book->created_at?->toDateString(),
            ]));
        }

        return $rows->sortByDesc('date')->values()->all();
    }

    /**
     * Penulis karya (akun) — yang berhak melihat sertifikat HKI-nya.
     *
     * @return Collection<int, User>
     */
    public function authorsOf(HkiRecord $record): Collection
    {
        [$orders, $books] = $this->subjects(collect([$record]));

        return $this->subjectAuthors($record, $orders, $books);
    }

    /**
     * Sertifikat HKI milik user (sebagai penulis).
     *
     * @return list<array<string, mixed>>
     */
    public function certificatesFor(User $user): array
    {
        $records = HkiRecord::whereNotNull('certificate_path')->get();
        [$orders, $books] = $this->subjects($records);

        return $records
            ->filter(fn (HkiRecord $record) => $this->subjectAuthors($record, $orders, $books)->contains('id', $user->id))
            ->map(fn (HkiRecord $record) => [
                'id' => $record->id,
                'title' => $this->subjectTitle($record, $orders, $books),
                'registration_number' => $record->registration_number,
                'registered_at' => $record->registered_at?->toDateString(),
                'file_name' => $record->certificate_name,
                'is_pdf' => str_ends_with(strtolower((string) $record->certificate_path), '.pdf'),
                'uploaded_at' => $record->certificate_uploaded_at,
            ])
            ->sortByDesc('uploaded_at')
            ->values()
            ->all();
    }

    /**
     * HKI sebuah buku terbit: termasuk layanan HKI atau tidak (paket pesanan
     * naskahnya / centang HKI buku / catatan HKI yang sudah ada) dan
     * catatan pengurusannya bila ada.
     *
     * @return array{included: bool, record: ?HkiRecord}
     */
    public function forBook(Book $book): array
    {
        $book->loadMissing('manuscript');
        $orderId = $book->manuscript?->order_id;

        $record = HkiRecord::query()
            ->where(fn ($query) => $query->where('subject_type', 'book')->where('subject_id', $book->id))
            ->when($orderId, fn ($query) => $query->orWhere(
                fn ($order) => $order->where('subject_type', 'order')->where('subject_id', $orderId)
            ))
            ->orderByRaw("case when subject_type = 'book' then 0 else 1 end")
            ->first();

        if ($record) {
            return ['included' => true, 'record' => $record];
        }

        $order = $orderId ? Order::with('items.itemable')->find($orderId) : null;

        return [
            'included' => $this->finance->bookIncludesHki($book)
                || ($order !== null && $this->finance->orderIncludesHki($order)),
            'record' => null,
        ];
    }

    public function titleOf(HkiRecord $record): string
    {
        [$orders, $books] = $this->subjects(collect([$record]));

        return $this->subjectTitle($record, $orders, $books);
    }

    /** Karya ini memang ada di daftar HKI (boleh dibuatkan catatan). */
    public function exists(string $subjectType, int $subjectId): bool
    {
        return collect($this->entries())->contains(
            fn (array $row) => $row['subject_type'] === $subjectType && $row['subject_id'] === $subjectId
        );
    }

    // =====================================================================

    /**
     * Pesanan & buku yang menjadi subjek catatan HKI, dimuat sekaligus
     * beserta penulisnya (bukan satu query per catatan).
     *
     * @param  Collection<int, HkiRecord>  $records
     * @return array{0: Collection<int, Order>, 1: Collection<int, Book>}
     */
    private function subjects(Collection $records): array
    {
        $ids = fn (string $type) => $records->where('subject_type', $type)->pluck('subject_id')->unique()->values();
        $orderIds = $ids('order');
        $bookIds = $ids('book');

        return [
            $orderIds->isEmpty() ? collect() : Order::with(['manuscript.authorLinks.user', 'manuscript.user', 'user', 'items'])
                ->whereIn('id', $orderIds)->get()->keyBy('id'),
            $bookIds->isEmpty() ? collect() : Book::with(['chapters.manuscript.authorLinks.user', 'chapters.manuscript.user', 'manuscript.authorLinks.user', 'manuscript.user'])
                ->whereIn('id', $bookIds)->get()->keyBy('id'),
        ];
    }

    /** @return Collection<int, User> */
    private function subjectAuthors(HkiRecord $record, Collection $orders, Collection $books): Collection
    {
        if ($record->subject_type === 'order') {
            $order = $orders->get($record->subject_id);

            return $order ? collect($this->orderAuthorUsers($order)) : collect();
        }

        $book = $books->get($record->subject_id);

        return $book ? collect($this->bookAuthorUsers($book)) : collect();
    }

    private function subjectTitle(HkiRecord $record, Collection $orders, Collection $books): string
    {
        if ($record->subject_type === 'order') {
            $order = $orders->get($record->subject_id);

            return $order?->manuscript?->title ?? (string) $order?->items->pluck('name')->implode(', ');
        }

        return (string) $books->get($record->subject_id)?->title;
    }

    private function row(string $type, int $id, ?HkiRecord $record, array $data): array
    {
        return [
            'key' => "{$type}:{$id}",
            'subject_type' => $type,
            'subject_id' => $id,
            ...$data,
            'hki' => [
                'id' => $record?->id,
                'status' => $record?->status ?? 'pending',
                'status_label' => HkiRecord::STATUSES[$record?->status ?? 'pending'],
                'application_number' => $record?->application_number,
                'registration_number' => $record?->registration_number,
                'registered_at' => $record?->registered_at?->toDateString(),
                'has_certificate' => (bool) $record?->hasCertificate(),
                'certificate_name' => $record?->certificate_name,
                'certificate_uploaded_at' => $record?->certificate_uploaded_at,
                'note' => $record?->note,
            ],
        ];
    }

    /** @return list<array{id: int, name: string}> */
    private function orderAuthors(Order $order): array
    {
        return array_map(fn (User $user) => ['id' => $user->id, 'name' => $user->name], $this->orderAuthorUsers($order));
    }

    /** @return list<User> */
    private function orderAuthorUsers(Order $order): array
    {
        if ($order->manuscript) {
            return $this->manuscriptAuthors($order->manuscript);
        }

        return $order->user ? [$order->user] : [];
    }

    /** @return list<array{id: int, name: string}> */
    private function bookAuthors(Book $book): array
    {
        return array_map(fn (User $user) => ['id' => $user->id, 'name' => $user->name], $this->bookAuthorUsers($book));
    }

    /** @return list<User> Book Chapter: semua penulis bab; buku biasa: penulis naskahnya. */
    private function bookAuthorUsers(Book $book): array
    {
        $manuscripts = $book->chapters->isNotEmpty()
            ? $book->chapters->map(fn (BookChapter $chapter) => $chapter->manuscript)->filter()
            : collect([$book->manuscript])->filter();

        return $manuscripts
            ->flatMap(fn (Manuscript $manuscript) => $this->manuscriptAuthors($manuscript))
            ->unique('id')
            ->values()
            ->all();
    }

    /** @return list<User> */
    private function manuscriptAuthors(Manuscript $manuscript): array
    {
        $users = $manuscript->authorLinks->pluck('user')->filter()->values();

        return ($users->isEmpty() && $manuscript->user ? collect([$manuscript->user]) : $users)->all();
    }

    private function orderBookStatus(Order $order): string
    {
        $book = $order->manuscript?->book;

        return match (true) {
            (bool) $book?->isbn => 'Terbit (ISBN '.$book->isbn.')',
            $book !== null => 'Buku dibuat, belum ber-ISBN',
            $order->manuscript !== null => self::MANUSCRIPT_STATUS[$order->manuscript->status] ?? $order->manuscript->status,
            default => 'Naskah belum dikirim',
        };
    }

    private function bookStatus(Book $book): string
    {
        if ($book->isbn) {
            return 'Terbit (ISBN '.$book->isbn.')';
        }

        if ($book->chapters->isNotEmpty()) {
            if ($book->compilation) {
                return 'Naskah gabungan: '.(self::MANUSCRIPT_STATUS[$book->compilation->status] ?? $book->compilation->status);
            }

            $filled = $book->chapters->whereNotNull('manuscript_id')->count();

            return "Pengumpulan bab ({$filled}/{$book->chapters->count()} terisi)";
        }

        return $book->manuscript
            ? (self::MANUSCRIPT_STATUS[$book->manuscript->status] ?? $book->manuscript->status)
            : 'Belum terbit';
    }
}
