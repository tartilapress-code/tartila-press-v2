<?php

namespace App\Support\Certificates;

use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Event;
use App\Models\EventAttendance;
use Carbon\CarbonInterface;

/**
 * Data yang bisa diisikan otomatis ke templat sertifikat. Di teks sebuah
 * kolom, penandanya ditulis {nama_penanda}; penanda yang tidak dikenal
 * dicetak kosong.
 *
 * Untuk sertifikat event, jawaban absensi tersedia sebagai
 * {answer_<kunci kolom>} (kunci kolom tampil di halaman kelola absensi).
 */
final class CertificateVariables
{
    private const MONTHS = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    /**
     * Daftar penanda untuk editor (label + contoh isi).
     *
     * @return list<array{token: string, label: string, sample: string, sample_long: string|null, dynamic: bool}>
     */
    public static function catalogue(string $type): array
    {
        if ($type === CertificateTemplate::TYPE_SOCIAL) {
            return array_map(fn (array $row) => [
                'token' => $row[0],
                'label' => $row[1],
                'sample' => $row[2],
                'sample_long' => $row[3],
                'dynamic' => false,
            ], [
                ['judul', 'Judul buku', 'Antologi Puisi: Sisi Lain Rumah', 'Antologi Puisi: Sisi Lain Rumah — Kumpulan Puisi tentang Pulang, Luka, dan Cahaya'],
                ['penulis', 'Penulis (2 nama + dkk)', 'Rahima Tartila, S.T', 'Rahima Tartila, S.T, Ravina Sidqi, dkk'],
                ['isbn', 'Nomor ISBN', '978-634-05-2484-0', null],
                ['harga', 'Harga', 'Rp 200.000,00', null],
                ['link', 'Link buku', 'www.tartilapress.com/buku/sisi-lain-rumah', null],
                ['blurb', 'Tulisan di bawah judul (manual)', 'Kumpulan puisi mengenai perjalanan seorang anak perempuan pertama.', 'Kumpulan puisi mengenai perjalanan seorang anak perempuan pertama, dari lelah yang tak terucap, luka yang lama disimpan, hingga cahaya yang perlahan ditemukan di balik cinta yang tak pernah sempat dikatakan.'],
                ['quote', 'Tulisan bilah bawah (manual)', 'Untuk siapa pun yang pernah merasa terlalu lelah untuk bertahan.', null],
                ['cover', 'Foto cover (taruh sendirian di satu kotak)', '[ Foto cover ]', null],
            ]);
        }

        $rows = $type === CertificateTemplate::TYPE_EVENT
            ? [
                ['name', 'Nama peserta', 'Siti Nurhaliza, S.Pd.', 'Prof. Dr. Ir. Muhammad Abdurrahman Al-Fatih Wijayakusuma, M.Si., Ph.D.'],
                ['event_title', 'Judul event', 'Webinar Nasional Penulisan Karya Ilmiah', 'Webinar Nasional Strategi Penulisan dan Publikasi Karya Ilmiah Bereputasi di Era Digital'],
                ['event_date', 'Tanggal pelaksanaan', '12–14 Agustus 2026', null],
                ['event_year', 'Tahun event', '2026', null],
                ['event_category', 'Kategori event', 'Webinar', null],
                ['certificate_number', 'Nomor sertifikat', 'TP-EVT-2026-000123', null],
                ['issued_date', 'Tanggal sertifikat terbit', '14 Agustus 2026', null],
            ]
            : [
                ['name', 'Nama penulis/editor', 'Dr. Budi Santoso, M.Pd.', 'Prof. Dr. Ir. Muhammad Abdurrahman Al-Fatih Wijayakusuma, M.Si., Ph.D.'],
                ['role', 'Peran (Penulis/Editor)', 'Penulis', null],
                ['book_title', 'Judul buku', 'Pemanfaatan Teknologi Digital dalam Pendidikan Dasar', 'Pemanfaatan Teknologi Digital untuk Meningkatkan Mutu Pembelajaran dan Literasi di Sekolah Dasar Wilayah Terpencil'],
                ['isbn', 'Nomor ISBN', '978-623-5678-90-1', null],
                ['published_date', 'Tanggal terbit', '12 Agustus 2026', null],
                ['published_month_year', 'Bulan dan tahun terbit', 'Agustus 2026', null],
                ['published_year', 'Tahun terbit', '2026', null],
                ['certificate_number', 'Nomor sertifikat', 'TP-PUB-2026-000045', null],
                ['issued_date', 'Tanggal sertifikat terbit', '14 Agustus 2026', null],
            ];

        $catalogue = array_map(fn (array $row) => [
            'token' => $row[0],
            'label' => $row[1],
            'sample' => $row[2],
            'sample_long' => $row[3],
            'dynamic' => false,
        ], $rows);

        if ($type === CertificateTemplate::TYPE_EVENT) {
            $catalogue[] = [
                'token' => 'answer_',
                'label' => 'Jawaban absensi (tambahkan kunci kolom, mis. answer_institusi)',
                'sample' => 'Contoh jawaban',
                'sample_long' => null,
                'dynamic' => true,
            ];
        }

        return $catalogue;
    }

    /**
     * Isi contoh untuk pratinjau templat.
     *
     * @return array<string, string>
     */
    public static function samples(string $type, bool $long = false, ?string $role = null): array
    {
        $values = [];

        foreach (self::catalogue($type) as $entry) {
            if ($entry['dynamic']) {
                continue;
            }

            $values[$entry['token']] = $long && $entry['sample_long'] ? $entry['sample_long'] : $entry['sample'];
        }

        if ($type === CertificateTemplate::TYPE_PUBLICATION && $role === CertificateTemplate::ROLE_EDITOR) {
            $values['role'] = 'Editor';
        }

        return $values;
    }

    /**
     * @return array<string, string>
     */
    public static function forEventCertificate(Certificate $certificate, EventAttendance $attendance, Event $event): array
    {
        $values = [
            'name' => (string) $attendance->user->name,
            'event_title' => (string) $event->title,
            'event_date' => self::dateRange($event->starts_at, $event->ends_at),
            'event_year' => $event->starts_at ? self::local($event->starts_at)->format('Y') : '',
            'event_category' => (string) ($event->category?->name ?? ''),
            'certificate_number' => (string) $certificate->number,
            'issued_date' => self::longDate($certificate->issued_at),
        ];

        foreach ($attendance->answers ?? [] as $key => $answer) {
            $values['answer_'.$key] = self::answerToText($answer);
        }

        return $values;
    }

    /**
     * @return array<string, string>
     */
    public static function forPublicationCertificate(Certificate $certificate): array
    {
        $book = $certificate->book;
        $published = $book->citation_publication_date;

        return [
            'name' => (string) $certificate->user->name,
            'role' => $certificate->role === CertificateTemplate::ROLE_EDITOR ? 'Editor' : 'Penulis',
            'book_title' => (string) $book->title,
            'isbn' => (string) $book->isbn,
            'published_date' => self::longDate($published, false),
            'published_month_year' => $published ? self::MONTHS[(int) $published->format('n')].' '.$published->format('Y') : '',
            'published_year' => $published ? $published->format('Y') : '',
            'certificate_number' => (string) $certificate->number,
            'issued_date' => self::longDate($certificate->issued_at),
        ];
    }

    /**
     * Mengganti penanda {nama} di $text dengan nilainya; penanda yang tidak
     * ada di $values menjadi string kosong.
     *
     * @param  array<string, string>  $values
     */
    public static function apply(string $text, array $values): string
    {
        return preg_replace_callback(
            '/\{([a-zA-Z0-9_]+)\}/',
            fn (array $match) => $values[$match[1]] ?? '',
            $text
        );
    }

    /**
     * Untuk pratinjau: penanda jawaban absensi (answer_xxx) yang belum
     * terdaftar diisi contoh supaya kolomnya tetap kelihatan.
     *
     * @param  list<array<string, mixed>>  $fields
     * @param  array<string, string>  $values
     * @return array<string, string>
     */
    public static function withSampleAnswers(array $fields, array $values): array
    {
        foreach ($fields as $field) {
            preg_match_all('/\{(answer_[a-zA-Z0-9_]*)\}/', (string) ($field['text'] ?? ''), $matches);

            foreach ($matches[1] as $token) {
                $values[$token] ??= 'Contoh jawaban';
            }
        }

        return $values;
    }

    public static function longDate(?CarbonInterface $date, bool $convertToLocal = true): string
    {
        if (! $date) {
            return '';
        }

        $date = $convertToLocal ? self::local($date) : $date;

        return $date->format('j').' '.self::MONTHS[(int) $date->format('n')].' '.$date->format('Y');
    }

    /**
     * Rentang tanggal pelaksanaan: "12 Agustus 2026", "12–14 Agustus 2026",
     * "30 Agustus – 2 September 2026", atau lintas tahun.
     */
    public static function dateRange(?CarbonInterface $start, ?CarbonInterface $end): string
    {
        if (! $start) {
            return '';
        }

        $start = self::local($start);
        $end = $end ? self::local($end) : null;

        if (! $end || $end->isSameDay($start)) {
            return self::longDate($start, false);
        }

        if ($start->format('Y-n') === $end->format('Y-n')) {
            return $start->format('j').'–'.$end->format('j').' '.self::MONTHS[(int) $start->format('n')].' '.$start->format('Y');
        }

        if ($start->format('Y') === $end->format('Y')) {
            return $start->format('j').' '.self::MONTHS[(int) $start->format('n')]
                .' – '.$end->format('j').' '.self::MONTHS[(int) $end->format('n')].' '.$end->format('Y');
        }

        return self::longDate($start, false).' – '.self::longDate($end, false);
    }

    private static function local(CarbonInterface $date): CarbonInterface
    {
        return $date->copy()->setTimezone(config('certificates.timezone', 'Asia/Jakarta'));
    }

    private static function answerToText(mixed $answer): string
    {
        return match (true) {
            is_bool($answer) => $answer ? 'Ya' : 'Tidak',
            is_array($answer) => implode(', ', array_map('strval', $answer)),
            default => (string) $answer,
        };
    }
}
