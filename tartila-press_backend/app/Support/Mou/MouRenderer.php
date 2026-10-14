<?php

namespace App\Support\Mou;

use App\Models\IsbnLetterSetting;
use App\Models\Mou;
use App\Models\MouSignatory;
use App\Services\MouService;
use App\Support\Certificates\CertificateFonts;
use App\Support\Isbn\IsbnLetterRenderer;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * PDF MOU distribusi buku (tFPDF, A4). Satu MOU untuk satu judul: daftar
 * penulis + royalti masing-masing, lalu tanda tangan penulis (dengan waktu
 * tanda tangan) dan di bagian akhir tanda tangan, stempel dan tempat
 * meterai penerbit. $sealed = dengan tanda tangan + stempel penerbit (khusus
 * unduhan admin); meterai dibubuhkan di luar sistem.
 */
class MouRenderer
{
    private const FONT = 'crimson';

    private const LEFT = 64.0;

    private const RIGHT = 531.0;

    private const TOP = 56.0;

    private const BOTTOM = 785.0;

    private const SIZE = 11.0;

    private const LINE = 14.5;

    private \tFPDF $pdf;

    private IsbnLetterSetting $settings;

    private Mou $mou;

    /** @var array<string, mixed> */
    private array $content;

    private int $article = 0;

    /** @param  array<string, mixed>  $content  isi MOU dengan penanda yang sudah diganti */
    public function render(Mou $mou, array $content, bool $sealed): string
    {
        $this->mou = $mou;
        $this->content = $content;
        $this->settings = IsbnLetterSetting::current();

        CertificateFonts::warm([[self::FONT, ''], [self::FONT, 'B']]);

        $this->pdf = CertificateFonts::newPdf();
        $this->pdf->SetMargins(self::LEFT, self::TOP, 595.28 - self::RIGHT);
        $this->pdf->SetAutoPageBreak(true, 841.89 - self::BOTTOM);

        foreach (['', 'B'] as $style) {
            $this->pdf->AddFont(self::FONT, $style, CertificateFonts::fileName(self::FONT, $style), true);
        }

        $this->letterhead();
        $this->parties();
        $this->articles();
        $this->authorSignatures();
        $this->publisherSignature($sealed);

        return $this->pdf->Output('S');
    }

    private function letterhead(): void
    {
        $s = $this->settings;
        $this->pdf->AddPage();

        $logo = $this->imagePath($s->logo_path) ?? resource_path('isbn/logo-default.jpeg');
        $this->pdf->Image($logo, self::LEFT, 22, 56);
        $this->text($s->publisher_name, 120, 24, self::RIGHT - 120, 'C', true, 22);
        $this->text($s->publisher_address, 128, 51, self::RIGHT - 128, 'C', false, 9, 11);

        $this->pdf->SetDrawColor(90, 90, 90);
        $this->pdf->SetLineWidth(1.6);
        $this->pdf->Line(self::LEFT, 98, self::RIGHT, 98);
        $this->pdf->SetLineWidth(0.4);

        $this->text($this->content['title'], self::LEFT, 114, self::RIGHT - self::LEFT, 'C', true, 13);
        $this->text('Nomor: '.$this->mou->number, self::LEFT, $this->pdf->GetY() + 2, self::RIGHT - self::LEFT, 'C');
        $this->pdf->SetY($this->pdf->GetY() + 14);
    }

    private function parties(): void
    {
        $s = $this->settings;
        $created = self::wib($this->mou->created_at ?? now());

        $this->paragraph('Pada tanggal '.IsbnLetterRenderer::formatDate($created).', yang bertanda tangan di bawah ini:');
        $this->gap(4);

        $this->paragraph('1.  '.$s->responsible_name.', selaku Penanggung Jawab '.$s->publisher_name.', beralamat di '.$s->publisher_address.', selanjutnya disebut PIHAK PERTAMA.', 0);
        $this->gap(4);

        $signatories = $this->mou->signatories->values();
        $this->paragraph('2.  Penulis buku berikut, '.($signatories->count() > 1 ? 'bersama-sama' : '').' selanjutnya disebut PIHAK KEDUA:');

        foreach ($signatories as $index => $row) {
            $identity = $row->identity ?? [];
            $details = $row->signed_at
                ? 'NIK '.($identity['nik'] ?? '-').', alamat '.($identity['address'] ?? '-')
                : 'data diri tercantum setelah penandatanganan';
            $label = $row->is_coauthor ? ' [Co-author]' : '';
            $this->paragraph(chr(97 + ($index % 26)).'.  '.($identity['name'] ?? $row->user?->name ?? '-').$label.' ('.$details.')', 24);
        }

        $this->gap(6);
        $this->paragraph($this->content['opening']);
    }

    private function articles(): void
    {
        $content = $this->content;
        $types = $content['royalty_types'] ?? ['physical' => true, 'ebook' => false];

        // Objek
        $this->articleHeading('Objek Perjanjian');
        $this->row('Judul buku', $this->mou->title);
        $this->row('Jenis paket', $this->mou->type === Mou::TYPE_CHAPTER ? 'Book Chapter' : 'Paket penerbitan biasa');
        $rights = $content['package_rights'] ?? null;

        if (filled($rights['package'] ?? null)) {
            $this->row('Paket yang diambil', $rights['package']);
        }

        $this->row('Layanan ISBN', ($rights['isbn_label'] ?? null) ?: collect([
            $types['physical'] ? 'Buku cetak' : null,
            $types['ebook'] ? 'Buku elektronik (ebook)' : null,
        ])->filter()->implode(' dan '));

        // Hak penulis atas fasilitas dan layanan paket
        if ($rights && (($rights['facilities'] ?? []) !== [] || ($rights['services'] ?? []) !== [])) {
            $this->articleHeading('Hak Pihak Kedua atas Fasilitas dan Layanan Paket');
            $this->paragraph('Selain royalti, Pihak Kedua berhak memperoleh fasilitas dan layanan dari paket'
                .(filled($rights['package'] ?? null) ? ' '.$rights['package'] : '').' yang diambilnya, sebagai berikut:');

            foreach (['facilities' => 'Fasilitas', 'services' => 'Layanan'] as $key => $label) {
                if (($rights[$key] ?? []) === []) {
                    continue;
                }

                $this->gap(3);
                $this->paragraph($label.':');
                $this->bullets($rights[$key]);
            }
        }

        // Hak distribusi
        $this->articleHeading('Hak Distribusi');
        $choice = (array) ($this->mou->distribution_choice ?? []);
        $options = collect($content['distribution_options'] ?? [])->filter(fn ($option) => in_array($option['key'], $choice, true))->values();

        if ($options->isEmpty()) {
            $this->paragraph('Hak distribusi dipilih Pihak Kedua pada saat penandatanganan.');
        } else {
            $this->paragraph('Pihak Kedua memberikan hak distribusi buku kepada Pihak Pertama melalui:');

            foreach ($options->values() as $index => $option) {
                $this->ensure(self::LINE * 3);
                $y = $this->pdf->GetY();
                $this->text(($index + 1).'.', self::LEFT, $y, 20);
                $this->text($option['name'], self::LEFT + 20, $y, self::RIGHT - self::LEFT - 20, 'L', true);

                // Rincian hak berupa daftar poin; teks paragraf lama tetap tampil bila belum ada poin.
                if (! empty($option['points'])) {
                    $this->bullets($option['points'], 36);
                } elseif (filled($option['description'] ?? null)) {
                    $this->paragraph($option['description'], 20);
                }
            }
        }

        // Royalti
        $this->articleHeading('Royalti');
        $this->paragraph('Pihak Pertama membayarkan royalti kepada Pihak Kedua dari harga jual buku yang terjual sesuai jenis penjualannya. '
            .($this->mou->signatories->count() > 1
                ? ($this->mou->type === Mou::TYPE_CHAPTER
                    ? 'Nilai royalti dibagi per bab yang ditulis masing-masing penulis.'
                    : 'Nilai royalti dibagi rata antar-penulis.')
                : '')
            .($this->mou->signatories->contains('is_coauthor', true)
                ? ' Co-author tercatat sebagai penulis terakhir dan menerima jatah royalti tetap yang tercantum pada tabel, di luar pembagian antar-penulis lainnya.'
                : '')
            .' Jenis royalti mengikuti layanan ISBN yang diambil.');
        $this->gap(4);
        $this->royaltyTable($types);

        // Hak & tanggung jawab
        $this->articleHeading('Hak dan Tanggung Jawab Pihak Pertama');
        $this->numbered($content['first_party_terms'] ?? []);

        $this->articleHeading('Hak dan Tanggung Jawab Pihak Kedua');
        $this->numbered($content['second_party_terms'] ?? []);

        $this->articleHeading('Perubahan, Adendum dan Penyelesaian');
        $this->numbered($content['closing_terms'] ?? []);

        $this->gap(8);
        $this->paragraph('Demikian perjanjian ini dibuat dan disepakati. Pihak Kedua menyatakan telah membaca dan menyetujui seluruh isi perjanjian, lalu menandatanganinya secara elektronik pada waktu yang tercantum di bawah. Pihak Pertama menandatangani, memberi stempel dan membubuhkan meterai.');
    }

    /** @param  array{physical: bool, ebook: bool}  $types */
    private function royaltyTable(array $types): void
    {
        $chapter = $this->mou->type === Mou::TYPE_CHAPTER;
        $columns = [['No', 26, 'C'], ['Nama penulis', $chapter ? 201 : 251, 'L']];

        if ($chapter) {
            $columns[] = ['Bab', 50, 'C'];
        }

        $columns[] = ['Royalti buku fisik', 95, 'C'];
        $columns[] = ['Royalti ebook', 95, 'C'];

        $this->ensure(22 * ($this->mou->signatories->count() + 2));
        $this->pdf->SetFont(self::FONT, 'B', 10);
        $this->pdf->SetFillColor(236, 240, 236);
        $this->pdf->SetX(self::LEFT);

        foreach ($columns as [$label, $width]) {
            $this->pdf->Cell($width, 20, $label, 1, 0, 'C', true);
        }

        $this->pdf->Ln();
        $this->pdf->SetFont(self::FONT, '', 10);
        $totals = ['physical' => 0.0, 'ebook' => 0.0];

        foreach ($this->mou->signatories->values() as $index => $row) {
            /** @var MouSignatory $row */
            $cells = [(string) ($index + 1), $this->fit($row->identity['name'] ?? $row->user?->name ?? '-', $columns[1][1] - 8)];

            if ($chapter) {
                $cells[] = (string) ($row->chapters ?? '-');
            }

            $cells[] = $types['physical'] ? self::percent($row->royalty_physical) : 'Tidak berlaku';
            $cells[] = $types['ebook'] ? self::percent($row->royalty_ebook) : 'Tidak berlaku';
            $totals['physical'] += (float) $row->royalty_physical;
            $totals['ebook'] += (float) $row->royalty_ebook;

            $this->pdf->SetX(self::LEFT);

            foreach ($columns as $i => [, $width, $align]) {
                $this->pdf->Cell($width, 20, $cells[$i], 1, 0, $align);
            }

            $this->pdf->Ln();
        }

        if ($this->mou->signatories->count() > 1) {
            $this->pdf->SetFont(self::FONT, 'B', 10);
            $this->pdf->SetX(self::LEFT);
            $labelWidth = $columns[0][1] + $columns[1][1] + ($chapter ? $columns[2][1] : 0);
            $this->pdf->Cell($labelWidth, 20, 'Total', 1, 0, 'R');
            $this->pdf->Cell(95, 20, $types['physical'] ? self::percent($totals['physical']) : '-', 1, 0, 'C');
            $this->pdf->Cell(95, 20, $types['ebook'] ? self::percent($totals['ebook']) : '-', 1, 0, 'C');
            $this->pdf->Ln();
        }

        $this->gap(4);
    }

    private function authorSignatures(): void
    {
        $this->gap(16);
        $this->ensure(40);
        $this->text('PIHAK KEDUA', self::LEFT, $this->pdf->GetY(), self::RIGHT - self::LEFT, 'C', true);
        $this->gap(6);

        $rows = $this->mou->signatories->values()->chunk(2);
        $columnWidth = (self::RIGHT - self::LEFT) / 2;

        foreach ($rows as $pair) {
            $this->ensure(122);
            $top = $this->pdf->GetY();

            foreach ($pair->values() as $i => $row) {
                /** @var MouSignatory $row */
                // Penulis tunggal pada satu baris (jumlah ganjil) tepat di tengah halaman, bukan di kolom kiri.
                $x = $pair->count() === 1
                    ? self::LEFT + $columnWidth / 2
                    : self::LEFT + $i * $columnWidth;
                $this->text('Penulis '.$row->position.($row->is_coauthor ? ' (Co-author)' : ''), $x, $top, $columnWidth, 'C', false, 10);

                if ($row->signed_at && ($path = $this->imagePath($row->signature_path))) {
                    $this->pdf->Image($path, $x + $columnWidth / 2 - 55, $top + 14, 110, 44);
                }

                $this->text($row->identity['name'] ?? $row->user?->name ?? '-', $x, $top + 62, $columnWidth, 'C', true);
                $this->text(
                    $row->signed_at ? 'Ditandatangani '.MouService::wib($row->signed_at) : 'Belum ditandatangani',
                    $x, $top + 78, $columnWidth, 'C', false, 9
                );
            }

            $this->pdf->SetY($top + 104);
        }
    }

    private function publisherSignature(bool $sealed): void
    {
        $s = $this->settings;
        $this->gap(10);
        $this->ensure(170);

        $top = $this->pdf->GetY();
        $centre = (self::LEFT + self::RIGHT) / 2;

        $this->text('PIHAK PERTAMA', self::LEFT, $top, self::RIGHT - self::LEFT, 'C', true);
        $this->text($s->city.', '.IsbnLetterRenderer::formatDate(self::wib($this->mou->signed_at ?? $this->mou->created_at ?? now())), self::LEFT, $top + 15, self::RIGHT - self::LEFT, 'C', false, 10);

        $nameY = $top + 128;

        // Tempat meterai (dibubuhkan di luar sistem).
        $this->pdf->SetDrawColor(150, 150, 150);
        $this->pdf->SetLineWidth(0.6);
        $this->pdf->Rect($centre - 150, $nameY - 86, 64, 48);
        $this->text('Meterai', $centre - 150, $nameY - 68, 64, 'C', false, 8);

        if ($sealed) {
            if ($stamp = $this->imagePath($s->stamp_path)) {
                $this->pdf->Image($stamp, $centre - 70, $nameY - 92, 85);
            }

            if ($signature = $this->imagePath($s->signature_path)) {
                $this->pdf->Image($signature, $centre - 40, $nameY - 84, 100);
            }
        }

        $this->text($s->responsible_name, $centre - 120, $nameY, 240, 'C', true);
        $this->text('Penanggung Jawab '.$s->publisher_name, $centre - 150, $nameY + 15, 300, 'C', false, 10);
    }

    // =====================================================================

    private function articleHeading(string $title): void
    {
        $this->article++;
        $this->gap(10);
        $this->ensure(48);
        $this->text('Pasal '.$this->article, self::LEFT, $this->pdf->GetY(), self::RIGHT - self::LEFT, 'C', true);
        $this->text($title, self::LEFT, $this->pdf->GetY(), self::RIGHT - self::LEFT, 'C', true);
        $this->gap(4);
    }

    /** @param  list<string>  $items */
    private function numbered(array $items): void
    {
        foreach (array_values($items) as $index => $item) {
            $this->ensure(self::LINE * 2);
            $y = $this->pdf->GetY();
            $this->text(($index + 1).'.', self::LEFT, $y, 20);
            $this->text($item, self::LEFT + 20, $y, self::RIGHT - self::LEFT - 20);
        }
    }

    /** @param  list<string>  $items */
    private function bullets(array $items, float $indent = 20): void
    {
        foreach (array_values($items) as $item) {
            $this->ensure(self::LINE * 2);
            $y = $this->pdf->GetY();
            $this->text('-', self::LEFT + $indent, $y, 12);
            $this->text($item, self::LEFT + $indent + 14, $y, self::RIGHT - self::LEFT - $indent - 14);
        }
    }

    private function row(string $label, string $value): void
    {
        $this->ensure(self::LINE);
        $y = $this->pdf->GetY();
        $this->text($label, self::LEFT, $y, 110);
        $this->text(':', self::LEFT + 110, $y, 10);
        $this->text($value, self::LEFT + 122, $y, self::RIGHT - self::LEFT - 122);
    }

    private function paragraph(string $text, float $indent = 0): void
    {
        $this->ensure(self::LINE * 2);
        $this->text($text, self::LEFT + $indent, $this->pdf->GetY(), self::RIGHT - self::LEFT - $indent);
    }

    private function text(string $text, float $x, float $y, float $width, string $align = 'L', bool $bold = false, float $size = self::SIZE, float $line = self::LINE): void
    {
        $this->pdf->SetFont(self::FONT, $bold ? 'B' : '', $size);
        $this->pdf->SetXY($x, $y);
        $this->pdf->MultiCell($width, $line * $size / self::SIZE, $text, 0, $align);
    }

    private function gap(float $height): void
    {
        $this->pdf->SetY($this->pdf->GetY() + $height);
    }

    /** Pindah halaman bila sisa ruang kurang dari $height. */
    private function ensure(float $height): void
    {
        if ($this->pdf->GetY() + $height > self::BOTTOM) {
            $this->pdf->AddPage();
            $this->pdf->SetY(self::TOP);
        }
    }

    private function fit(string $text, float $width): string
    {
        while ($text !== '' && $this->pdf->GetStringWidth($text) > $width) {
            $text = mb_substr($text, 0, -2).'…';
        }

        return $text;
    }

    /** Tanggal di MOU mengikuti WIB (server menyimpan UTC). */
    private static function wib(\DateTimeInterface $time): \DateTimeInterface
    {
        return Carbon::instance($time)->copy()->timezone('Asia/Jakarta');
    }

    public static function percent(?float $value): string
    {
        if ($value === null) {
            return '-';
        }

        return rtrim(rtrim(number_format($value, 2, ',', '.'), '0'), ',').'%';
    }

    private function imagePath(?string $path): ?string
    {
        if (! $path || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        return Storage::disk('local')->path($path);
    }
}
