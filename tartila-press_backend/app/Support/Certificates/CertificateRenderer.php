<?php

namespace App\Support\Certificates;

use App\Models\CertificateTemplate;
use Illuminate\Support\Facades\Storage;

/**
 * Membuat PDF sertifikat: gambar templat sebagai latar satu halaman, lalu
 * tiap kolom teks digambar sebagai teks vektor (tFPDF, font TrueType
 * tertanam). Ukuran halaman mengikuti rasio gambar templat.
 */
final class CertificateRenderer
{
    /**
     * @param  array<string, string>  $values  nilai penanda ({name} => ...)
     */
    public function renderTemplate(CertificateTemplate $template, array $values, string $title): string
    {
        return $this->render(
            $template->image_path,
            (int) $template->image_width,
            (int) $template->image_height,
            $template->fields ?? [],
            $values,
            $title
        );
    }

    /**
     * Ukuran halaman (poin) dari ukuran gambar: sisi terpanjang dipetakan ke
     * config('certificates.page_long_side_pt'), sisi lainnya mengikuti rasio.
     *
     * @return array{0: float, 1: float} [lebar, tinggi]
     */
    public static function pageSize(int $imageWidth, int $imageHeight): array
    {
        $long = (float) config('certificates.page_long_side_pt');

        if ($imageWidth >= $imageHeight) {
            return [$long, round($long * $imageHeight / max(1, $imageWidth), 2)];
        }

        return [round($long * $imageWidth / max(1, $imageHeight), 2), $long];
    }

    /**
     * @param  list<array<string, mixed>>  $fields  daftar kolom (lihat TemplateFields)
     * @param  array<string, string>  $values
     */
    public function render(
        string $imagePath,
        int $imageWidth,
        int $imageHeight,
        array $fields,
        array $values,
        string $title,
    ): string {
        [$pageWidth, $pageHeight] = self::pageSize($imageWidth, $imageHeight);

        // Font yang dipakai kolom-kolom ini: [kunci, gaya].
        $used = [];
        foreach ($fields as $field) {
            $key = $this->fontKey($field);
            $used[$key.'|'.CertificateFonts::style($key, (bool) ($field['bold'] ?? false))] = [
                $key,
                CertificateFonts::style($key, (bool) ($field['bold'] ?? false)),
            ];
        }
        CertificateFonts::warm(array_values($used));

        $landscape = $pageWidth >= $pageHeight;
        $pdf = CertificateFonts::newPdf(
            $landscape ? 'L' : 'P',
            [min($pageWidth, $pageHeight), max($pageWidth, $pageHeight)]
        );
        $pdf->SetTitle($title, true);
        $pdf->SetAuthor('Tartila Press', true);
        $pdf->SetCreator('Tartila Press', true);
        $pdf->AddPage($landscape ? 'L' : 'P', [min($pageWidth, $pageHeight), max($pageWidth, $pageHeight)]);

        $pdf->Image(
            Storage::disk(config('certificates.template_image.disk'))->path($imagePath),
            0,
            0,
            $pageWidth,
            $pageHeight
        );

        foreach ($used as [$key, $style]) {
            $pdf->AddFont($key, $style, CertificateFonts::fileName($key, $style), true);
        }

        foreach ($fields as $field) {
            $this->drawField($pdf, $field, $values, $pageWidth, $pageHeight);
        }

        return $pdf->Output('S');
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $values
     */
    private function drawField(\tFPDF $pdf, array $field, array $values, float $pageWidth, float $pageHeight): void
    {
        $text = CertificateVariables::apply((string) ($field['text'] ?? ''), $values);

        if ($field['uppercase'] ?? false) {
            $text = mb_strtoupper($text);
        }

        if (trim($text) === '') {
            return;
        }

        $key = $this->fontKey($field);
        $style = CertificateFonts::style($key, (bool) ($field['bold'] ?? false));
        $metrics = CertificateFonts::metrics($key);

        // Lebar teks pada ukuran 1pt: diukur sekali di 100pt (tFPDF cuma
        // mengukur pada ukuran yang sedang aktif) lalu diskalakan.
        $pdf->SetFont($key, $style, 100);
        $measure = fn (string $string): float => $pdf->GetStringWidth($string) / 100;

        $boxX = (float) $field['x'] * $pageWidth;
        $boxY = (float) $field['y'] * $pageHeight;
        $boxWidth = (float) $field['w'] * $pageWidth;
        $boxHeight = (float) $field['h'] * $pageHeight;

        $layout = TextLayout::fit(
            $measure,
            $text,
            $boxWidth,
            $boxHeight,
            (float) $field['size'],
            (bool) ($field['autoFit'] ?? true)
        );

        $lines = TextLayout::place(
            $measure,
            $layout,
            $boxX,
            $boxY,
            $boxWidth,
            $boxHeight,
            (string) $field['align'],
            (string) $field['valign'],
            $metrics['ascent'],
            $metrics['descent']
        );

        [$red, $green, $blue] = sscanf((string) $field['color'], '#%02x%02x%02x');

        $pdf->SetFont($key, $style, $layout['size']);
        $pdf->SetTextColor($red, $green, $blue);

        foreach ($lines as $line) {
            if ($line['text'] !== '') {
                $pdf->Text($line['x'], $line['y'], $line['text']);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function fontKey(array $field): string
    {
        $key = (string) ($field['font'] ?? '');

        return CertificateFonts::has($key) ? $key : CertificateFonts::DEFAULT_FONT;
    }
}
