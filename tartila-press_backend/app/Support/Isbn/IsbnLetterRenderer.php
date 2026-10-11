<?php

namespace App\Support\Isbn;

use App\Models\IsbnApplication;
use App\Models\IsbnLetterSetting;
use App\Support\Certificates\CertificateFonts;
use Illuminate\Support\Facades\Storage;

/**
 * Surat permohonan ISBN + surat pernyataan keaslian karya sebagai PDF
 * (tFPDF). $sealed = true menambahkan tanda tangan dan stempel penanggung
 * jawab penerbit -- hanya dipakai untuk unduhan admin; penulis/editor selalu
 * menerima versi tanpa keduanya supaya tidak bisa disalahgunakan.
 */
class IsbnLetterRenderer
{
    private const FONT = 'crimson';

    private const LEFT = 64.0;

    private const RIGHT = 531.0;

    private const SIZE = 11.5;

    private const LINE = 15.0;

    private const MONTHS = [
        1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    private \tFPDF $pdf;

    private IsbnLetterSetting $settings;

    private IsbnApplication $application;

    public function render(IsbnApplication $application, bool $sealed): string
    {
        $this->application = $application;
        $this->settings = IsbnLetterSetting::current();

        CertificateFonts::warm([[self::FONT, ''], [self::FONT, 'B']]);

        $this->pdf = CertificateFonts::newPdf();

        foreach (['', 'B'] as $style) {
            $this->pdf->AddFont(self::FONT, $style, CertificateFonts::fileName(self::FONT, $style), true);
        }

        $this->applicationLetter($sealed);
        $this->statementLetter($sealed);

        return $this->pdf->Output('S');
    }

    /** Tanggal seperti "12 Oktober 2026". */
    public static function formatDate(\DateTimeInterface $date): string
    {
        return $date->format('j').' '.self::MONTHS[(int) $date->format('n')].' '.$date->format('Y');
    }

    /** Bulan dan tahun seperti "Oktober 2026". */
    public static function formatMonthYear(\DateTimeInterface $date): string
    {
        return self::MONTHS[(int) $date->format('n')].' '.$date->format('Y');
    }

    private function applicationLetter(bool $sealed): void
    {
        $s = $this->settings;
        $a = $this->application;

        $this->newPage();
        $y = 114.0;

        $y = $this->row('No.', $a->letter_number, self::LEFT, 40, $y);
        $this->text($s->city.', '.self::formatDate($a->letter_date), self::RIGHT - 150, $y - self::LINE, 150, 'R');
        $y = $this->row('Lamp.', '-', self::LEFT, 40, $y);
        $y = $this->row('Perihal', $s->subject, self::LEFT, 40, $y, 330);

        $y += 18;
        $y = $this->paragraph('Kepada :', self::LEFT, $y, 300);
        $y += 8;
        $y = $this->paragraph($s->recipient, self::LEFT, $y, 270);

        $y += 14;
        $y = $this->paragraph('Kami atas nama,', self::LEFT, $y);
        $x = self::LEFT + 36;
        $y = $this->row('Penerbit', $s->publisher_name, $x, 110, $y);
        $y = $this->row('Penanggung jawab', $s->responsible_name, $x, 110, $y);

        if (filled($s->admin_name)) {
            $y = $this->row('Admin', $s->admin_name, $x, 110, $y);
        }

        $y += 10;
        $y = $this->paragraph('Mengajukan permohonan ISBN untuk,', self::LEFT, $y);
        $y = $this->row('Judul', $a->title, $x, 130, $y, 300);
        $y = $this->row('Kepengarangan', $a->authors_text, $x, 130, $y, 300);
        $y = $this->row('Link/akses ketersediaan buku', $a->availability_link ?: '(terisi otomatis setelah buku diterbitkan)', $x, 130, $y, 300);

        $y += 22;
        $y = $this->paragraph($this->fill($s->application_body), self::LEFT, $y, self::RIGHT - self::LEFT);
        $y += 4;
        $y = $this->paragraph($this->fill($s->application_closing), self::LEFT, $y, self::RIGHT - self::LEFT);

        $centre = 420.0;
        $y += 26;
        $this->text('Hormat kami,', $centre - 90, $y, 180, 'C');
        $this->text('Pimpinan Penerbit', $centre - 90, $y + self::LINE, 180, 'C');

        $nameY = $y + 110;
        $this->publisherSeal($sealed, $centre, $nameY);
        $this->text($s->responsible_name, $centre - 120, $nameY, 240, 'C', true);
    }

    private function statementLetter(bool $sealed): void
    {
        $s = $this->settings;
        $a = $this->application;
        $data = $a->applicant_data ?? [];
        $width = self::RIGHT - self::LEFT;

        $this->newPage();
        $y = 114.0;

        $this->text('SURAT PERNYATAAN KEASLIAN KARYA', self::LEFT, $y, $width, 'C', true, 12.5);
        $y += 28;

        $y = $this->paragraph('Yang bertandatangan di bawah ini :', self::LEFT, $y);
        $y = $this->row('Nama', $data['name'] ?? '-', self::LEFT, 110, $y, 340);
        $y = $this->row('Alamat', $data['address'] ?? '-', self::LEFT, 110, $y, 340);
        $y = $this->row('NIK', $data['nik'] ?? '-', self::LEFT, 110, $y, 340);
        $y = $this->row('Tel./HP', $data['phone'] ?? '-', self::LEFT, 110, $y, 340);

        $y += 14;
        $y = $this->paragraph('Menyatakan dengan sesungguhnya, bahwa :', self::LEFT, $y);
        $y = $this->row('Judul', $a->title, self::LEFT, 110, $y, 340);
        $y = $this->row('Penulis', $a->authors_text, self::LEFT, 110, $y, 340);

        $y += 8;
        $y = $this->paragraph($this->fill($s->statement_body), self::LEFT, $y, $width);
        $y = $this->row('Penerbit', $s->publisher_name, self::LEFT, 110, $y);
        $y = $this->row('Alamat', $s->publisher_address, self::LEFT, 110, $y, 340);

        $y += 12;
        $y = $this->paragraph($this->fill($s->statement_closing), self::LEFT, $y, $width);

        $y += 26;
        $this->text($s->city.', '.self::formatDate($a->letter_date), self::LEFT, $y, 250);
        $y += 22;

        $leftCentre = self::LEFT + 95;
        $rightCentre = self::RIGHT - 95;

        $this->text('Penanggungjawab Penerbit', $leftCentre - 100, $y, 200, 'C');
        $this->text($a->signer_role, $rightCentre - 100, $y, 200, 'C');

        $nameY = $y + 100;
        $this->publisherSeal($sealed, $leftCentre, $nameY);
        $this->applicantSignature($rightCentre, $nameY);

        $this->text($s->responsible_name, $leftCentre - 100, $nameY, 200, 'C', true);
        $this->text($data['name'] ?? '-', $rightCentre - 110, $nameY, 220, 'C', true);
    }

    private function newPage(): void
    {
        $s = $this->settings;
        $this->pdf->AddPage();

        $logo = $this->imagePath($s->logo_path) ?? resource_path('isbn/logo-default.jpeg');
        $this->pdf->Image($logo, self::LEFT, 22, 56);

        $this->pdf->SetTextColor(0, 0, 0);
        $this->text($s->publisher_name, 120, 24, self::RIGHT - 120, 'C', true, 22);
        $this->text($s->publisher_address, 128, 51, self::RIGHT - 128, 'C', false, 9, 11);

        $contact = collect([
            filled($s->website) ? 'Website : '.$s->website : null,
            filled($s->email) ? 'Email : '.$s->email : null,
        ])->filter()->implode(' | ');

        if ($contact !== '') {
            $this->text($contact, 120, 68, self::RIGHT - 120, 'C', false, 9);
        }

        $this->pdf->SetDrawColor(90, 90, 90);
        $this->pdf->SetLineWidth(1.6);
        $this->pdf->Line(self::LEFT, 98, self::RIGHT, 98);
        $this->pdf->SetLineWidth(0.2);
    }

    /** Tanda tangan + stempel penanggung jawab, di atas nama pada $centreX. */
    private function publisherSeal(bool $sealed, float $centreX, float $nameY): void
    {
        if (! $sealed) {
            return;
        }

        // Stempel di bawah, tanda tangan di atasnya (digambar belakangan).
        if ($stamp = $this->imagePath($this->settings->stamp_path)) {
            $this->pdf->Image($stamp, $centreX - 80, $nameY - 80, 85);
        }

        if ($signature = $this->imagePath($this->settings->signature_path)) {
            $this->pdf->Image($signature, $centreX - 45, $nameY - 72, 100);
        }
    }

    private function applicantSignature(float $centreX, float $nameY): void
    {
        if ($path = $this->imagePath($this->application->signature_path)) {
            $this->pdf->Image($path, $centreX - 55, $nameY - 72, 110);
        }
    }

    private function imagePath(?string $path): ?string
    {
        if (! $path || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        return Storage::disk('local')->path($path);
    }

    /** Baris "Label : nilai" dengan nilai yang dibungkus; mengembalikan y berikutnya. */
    private function row(string $label, string $value, float $x, float $labelWidth, float $y, float $valueWidth = 330): float
    {
        $this->text($label, $x, $y, $labelWidth);
        $this->text(': ', $x + $labelWidth, $y, 12);

        return $this->paragraph($value, $x + $labelWidth + 10, $y, $valueWidth);
    }

    /** Paragraf yang dibungkus; mengembalikan y setelah baris terakhir. */
    private function paragraph(string $text, float $x, float $y, float $width = 400): float
    {
        $this->pdf->SetFont(self::FONT, '', self::SIZE);
        $this->pdf->SetXY($x, $y);
        $this->pdf->MultiCell($width, self::LINE, $text, 0, 'L');

        return $this->pdf->GetY();
    }

    private function text(string $text, float $x, float $y, float $width, string $align = 'L', bool $bold = false, float $size = self::SIZE, float $line = self::LINE): void
    {
        $this->pdf->SetFont(self::FONT, $bold ? 'B' : '', $size);
        $this->pdf->SetXY($x, $y);
        $this->pdf->MultiCell($width, $line, $text, 0, $align);
    }

    /** Ganti penanda {judul}, {penulis}, {penerbit}, {penandatangan}. */
    private function fill(string $text): string
    {
        return strtr($text, [
            '{judul}' => $this->application->title,
            '{penulis}' => $this->application->authors_text,
            '{penerbit}' => $this->settings->publisher_name,
            '{penandatangan}' => strtolower($this->application->signer_role),
        ]);
    }
}
