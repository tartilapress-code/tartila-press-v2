<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\EventAttendance;
use App\Models\User;
use App\Support\Certificates\CertificateRenderer;
use App\Support\Certificates\CertificateVariables;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Penerbitan, daftar, dan pembuatan PDF sertifikat.
 *
 * Sertifikat event terbit saat peserta mengisi absensi (kalau event punya
 * templat). Sertifikat penulis/editor terbit otomatis untuk setiap buku aktif
 * yang sudah punya ISBN dan tanggal terbit, selama ada templat aktif untuk
 * perannya -- baris buku besarnya dibuat saat daftar "Sertifikat Saya"
 * dibuka, jadi templat yang diunggah belakangan tetap berlaku untuk buku
 * yang sudah terbit.
 */
class CertificateService
{
    public function __construct(private readonly CertificateRenderer $renderer) {}

    /**
     * Menerbitkan sertifikat untuk sebuah absensi. Null kalau event-nya
     * tidak punya templat sertifikat.
     */
    public function issueForAttendance(EventAttendance $attendance): ?Certificate
    {
        if (! $attendance->event->certificate_template_id) {
            return null;
        }

        return Certificate::firstOrCreate(
            ['event_attendance_id' => $attendance->id],
            [
                'type' => Certificate::TYPE_EVENT,
                'user_id' => $attendance->user_id,
                'issued_at' => $attendance->submitted_at,
            ]
        );
    }

    public function syncForUser(User $user): void
    {
        $this->syncEventCertificates($user);
        $this->syncPublicationCertificates($user);
    }

    /**
     * Absensi yang sudah terisi sebelum event diberi templat ikut mendapat
     * sertifikat begitu templatnya dipasang.
     */
    public function syncEventCertificates(User $user): void
    {
        EventAttendance::query()
            ->where('user_id', $user->id)
            ->whereHas('event', fn ($query) => $query->whereNotNull('certificate_template_id'))
            ->whereDoesntHave('certificate')
            ->with('event')
            ->get()
            ->each(fn (EventAttendance $attendance) => $this->issueForAttendance($attendance));
    }

    public function syncPublicationCertificates(User $user): void
    {
        $roles = [
            CertificateTemplate::ROLE_AUTHOR => fn () => Book::query()->publishedByAuthor($user->id),
            CertificateTemplate::ROLE_EDITOR => fn () => Book::query()->publishedByEditor($user->id),
        ];

        foreach ($roles as $role => $makeQuery) {
            if (! CertificateTemplate::resolveForPublication($role)) {
                continue;
            }

            $makeQuery()
                ->whereNotNull('isbn')
                ->where('isbn', '!=', '')
                ->whereNotNull('citation_publication_date')
                ->get(['id', 'citation_publication_date'])
                ->each(function (Book $book) use ($user, $role) {
                    Certificate::firstOrCreate(
                        ['book_id' => $book->id, 'user_id' => $user->id, 'role' => $role],
                        [
                            'type' => Certificate::TYPE_PUBLICATION,
                            'issued_at' => $book->citation_publication_date->copy()->startOfDay(),
                        ]
                    );
                });
        }
    }

    /**
     * Sertifikat milik user yang masih bisa diunduh: terbaru lebih dulu.
     *
     * @return Collection<int, Certificate>
     */
    public function listFor(User $user): Collection
    {
        $this->syncForUser($user);

        $activeRoles = collect(CertificateTemplate::ROLES)
            ->filter(fn (string $role) => CertificateTemplate::resolveForPublication($role) !== null)
            ->all();

        return Certificate::query()
            ->where('user_id', $user->id)
            ->where(function ($query) use ($activeRoles) {
                $query->where(function ($event) {
                    $event->where('type', Certificate::TYPE_EVENT)
                        ->whereHas('attendance.event', fn ($q) => $q->whereNotNull('certificate_template_id'));
                })->orWhere(function ($publication) use ($activeRoles) {
                    $publication->where('type', Certificate::TYPE_PUBLICATION)
                        ->whereIn('role', $activeRoles)
                        ->whereHas('book', fn ($q) => $q->where('is_active', true)
                            ->whereNotNull('isbn')->where('isbn', '!=', '')
                            ->whereNotNull('citation_publication_date'));
                });
            })
            ->with(['attendance.event.category', 'attendance.event.certificateTemplate', 'attendance.user', 'book', 'user'])
            ->latest('issued_at')
            ->latest('id')
            ->get();
    }

    /**
     * Apakah sertifikat ini masih bisa diunduh: templatnya ada, dan untuk
     * penulis/editor bukunya masih aktif dengan ISBN dan tanggal terbit.
     */
    public function isAvailable(Certificate $certificate): bool
    {
        if ($this->templateFor($certificate) === null) {
            return false;
        }

        if ($certificate->type === Certificate::TYPE_EVENT) {
            return true;
        }

        $book = $certificate->book;

        return $book !== null
            && $book->is_active
            && filled($book->isbn)
            && $book->citation_publication_date !== null;
    }

    /**
     * Templat yang dipakai sebuah sertifikat (null kalau sudah tidak ada).
     */
    public function templateFor(Certificate $certificate): ?CertificateTemplate
    {
        if ($certificate->type === Certificate::TYPE_EVENT) {
            return $certificate->attendance?->event?->certificateTemplate;
        }

        return CertificateTemplate::resolveForPublication((string) $certificate->role);
    }

    /**
     * Penanda ({name}, {book_title}, ...) untuk sertifikat ini.
     *
     * @return array<string, string>
     */
    public function valuesFor(Certificate $certificate): array
    {
        if ($certificate->type === Certificate::TYPE_EVENT) {
            $attendance = $certificate->attendance;

            return CertificateVariables::forEventCertificate($certificate, $attendance, $attendance->event);
        }

        return CertificateVariables::forPublicationCertificate($certificate);
    }

    /**
     * Judul dan keterangan singkat untuk daftar "Sertifikat Saya".
     *
     * @return array{title: string, subtitle: string}
     */
    public function describe(Certificate $certificate): array
    {
        if ($certificate->type === Certificate::TYPE_EVENT) {
            $event = $certificate->attendance->event;

            return [
                'title' => (string) $event->title,
                'subtitle' => CertificateVariables::dateRange($event->starts_at, $event->ends_at),
            ];
        }

        $book = $certificate->book;
        $values = CertificateVariables::forPublicationCertificate($certificate);

        return [
            'title' => (string) $book->title,
            'subtitle' => 'ISBN '.$book->isbn.' · Terbit '.$values['published_month_year'],
        ];
    }

    /**
     * PDF sertifikat. Null kalau templatnya sudah tidak tersedia.
     *
     * @return array{pdf: string, filename: string}|null
     */
    public function render(Certificate $certificate): ?array
    {
        $certificate->loadMissing(['attendance.event.category', 'attendance.event.certificateTemplate', 'attendance.user', 'book', 'user']);

        $template = $this->templateFor($certificate);

        if (! $template) {
            return null;
        }

        $description = $this->describe($certificate);

        $pdf = $this->renderer->renderTemplate(
            $template,
            $this->valuesFor($certificate),
            'Sertifikat - '.$description['title']
        );

        return [
            'pdf' => $pdf,
            'filename' => 'Sertifikat-'.Str::limit(Str::slug($description['title']), 60, '').'-'.$certificate->number.'.pdf',
        ];
    }
}
