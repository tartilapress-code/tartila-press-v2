<?php

namespace Tests\Unit;

use App\Support\ManuscriptTemplates\DefaultTemplates;
use App\Support\ManuscriptTemplates\DocxLayout;
use App\Support\ManuscriptTemplates\TemplateSchema;
use DOMDocument;
use DOMXPath;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\DocxFixture;
use ZipArchive;

class DocxLayoutTest extends TestCase
{
    private string $source;

    /** @var array<string, string> isi part hasil layout */
    private array $parts = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->source = tempnam(sys_get_temp_dir(), 'fixture').'.docx';
        DocxFixture::make($this->source);
    }

    protected function tearDown(): void
    {
        @unlink($this->source);
        parent::tearDown();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @param  list<array{name: string, bio: string, photo?: string|null}>|null  $bios
     */
    private function layout(array $overrides = [], ?array $bios = null): DOMXPath
    {
        $config = TemplateSchema::normalize(array_replace_recursive(DefaultTemplates::embeddedSystem(), $overrides));

        $bytes = (new DocxLayout($config, [
            'title' => 'Embedded System',
            'authors' => ['Rahima Tartila, S.T', 'Penulis Dua', 'Penulis Tiga'],
            'editor' => 'Editor Uji',
            'isbn' => '978-634-05-2943-2',
            'month_year' => 'Oktober 2026',
            'publisher' => 'Tartila Press',
            'author_bio' => $bios ?? [['name' => 'Rahima Tartila, S.T', 'bio' => 'Lahir pada tahun 2000.']],
        ]))->apply($this->source);

        $out = tempnam(sys_get_temp_dir(), 'out');
        file_put_contents($out, $bytes);
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($out) === true, 'Hasil bukan zip/docx yang valid.');

        $this->parts = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            $this->parts[$name] = (string) $zip->getFromIndex($i);
        }

        $zip->close();
        @unlink($out);

        return $this->xpath($this->parts['word/document.xml']);
    }

    private function xpath(string $xml): DOMXPath
    {
        $doc = new DOMDocument;
        $this->assertTrue($doc->loadXML($xml), 'XML hasil tidak valid.');
        $xp = new DOMXPath($doc);
        $xp->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $xp->registerNamespace('wp', 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing');

        return $xp;
    }

    /** @return list<string> teks paragraf dengan gaya tertentu */
    private function textsWithStyle(DOMXPath $xp, string $style): array
    {
        $texts = [];

        foreach ($xp->query("//w:p[w:pPr/w:pStyle/@w:val='$style']") as $p) {
            $texts[] = trim(implode('', array_map(fn ($t) => $t->textContent, iterator_to_array($xp->query('.//w:t', $p)))));
        }

        return $texts;
    }

    public function test_page_size_margins_and_sections_follow_the_template(): void
    {
        $xp = $this->layout();

        $sizes = $xp->query('//w:sectPr/w:pgSz');
        $this->assertGreaterThan(5, $sizes->length);

        foreach ($sizes as $size) {
            $this->assertSame('9978', $size->getAttribute('w:w'));   // 176 mm
            $this->assertSame('14173', $size->getAttribute('w:h'));  // 250 mm
        }

        $margin = $xp->query('//w:sectPr/w:pgMar')->item(0);
        $this->assertSame('1134', $margin->getAttribute('w:top'));   // 20 mm
        $this->assertSame('1134', $margin->getAttribute('w:left'));  // 20 mm (sisi jilid)
        $this->assertSame('1077', $margin->getAttribute('w:right')); // 19 mm

        // Bagian awal romawi mulai i, isi angka mulai 1.
        $formats = array_map(fn ($n) => $n->getAttribute('w:fmt').':'.$n->getAttribute('w:start'), iterator_to_array($xp->query('//w:sectPr/w:pgNumType')));
        $this->assertContains('lowerRoman:1', $formats);
        $this->assertContains('decimal:1', $formats);
    }

    public function test_headings_are_recognised_restyled_and_numbered_like_the_template(): void
    {
        $xp = $this->layout();

        $this->assertSame(
            ['BAB 1: PENGENALAN EMBEDDED SYSTEM', 'BAB 2: Arsitektur Hardware Dasar'],
            $this->textsWithStyle($xp, 'Heading1')
        );
        $this->assertSame(['1.1 Definisi dan Karakteristik', 'Prosesor dan Mikrokontroler'], $this->textsWithStyle($xp, 'Heading2'));

        $sections = $this->textsWithStyle($xp, 'TPJudulBagian');
        foreach (['KATA PENGANTAR', 'DAFTAR ISI', 'DAFTAR GAMBAR', 'DAFTAR TABEL', 'DAFTAR PUSTAKA', 'LAMPIRAN', 'BIODATA PENULIS'] as $title) {
            $this->assertContains($title, $sections);
        }

        // Daftar isi ketik manual milik penulis diganti field daftar isi.
        $this->assertStringNotContainsString('PENGENALAN ........ 1', $this->parts['word/document.xml']);
        $this->assertStringContainsString('TOC \\o "1-2" \\h \\z \\u', $this->parts['word/document.xml']);
        $this->assertStringContainsString('TOC \\f g', $this->parts['word/document.xml']);
        $this->assertStringContainsString('TOC \\f t', $this->parts['word/document.xml']);
    }

    public function test_direct_formatting_is_replaced_by_the_template_styles(): void
    {
        $xp = $this->layout();

        // Arial dan ukuran 12 pt penulis dibuang dari teks isi; kode tetap Consolas.
        $this->assertSame(0, $xp->query("//w:rFonts[@w:ascii='Arial']")->length);
        $this->assertSame(1, $xp->query("//w:rFonts[@w:ascii='Consolas']")->length);
        $this->assertSame(0, $xp->query("//w:p[not(w:pPr/w:pStyle)]//w:spacing[@w:line='480']")->length);

        $styles = $this->xpath($this->parts['word/styles.xml']);
        $normal = $styles->query("//w:style[@w:styleId='Normal']")->item(0);
        $this->assertSame('Constantia', $styles->query('.//w:rFonts/@w:ascii', $normal)->item(0)->nodeValue);
        $this->assertSame('22', $styles->query('.//w:sz/@w:val', $normal)->item(0)->nodeValue);
        $this->assertSame('both', $styles->query('.//w:jc/@w:val', $normal)->item(0)->nodeValue);
        $this->assertSame('120', $styles->query('.//w:spacing/@w:after', $normal)->item(0)->nodeValue);

        $h1 = $styles->query("//w:style[@w:styleId='Heading1']")->item(0);
        $this->assertSame('36', $styles->query('.//w:sz/@w:val', $h1)->item(0)->nodeValue);
        $this->assertSame('2E4057', $styles->query('.//w:color/@w:val', $h1)->item(0)->nodeValue);
        $this->assertSame('center', $styles->query('.//w:jc/@w:val', $h1)->item(0)->nodeValue);
    }

    public function test_captions_tables_and_images(): void
    {
        $xp = $this->layout();

        $this->assertSame(['Tabel 1.1 Karakteristik Utama Embedded System'], array_map(fn ($t) => preg_replace('/\s+/', ' ', $t), $this->textsWithStyle($xp, 'TPKeteranganTabel')));
        $this->assertSame(['Gambar 1.1 Hubungan Hardware dan Software'], array_map(fn ($t) => preg_replace('/\s+/', ' ', $t), $this->textsWithStyle($xp, 'TPKeteranganGambar')));

        $table = $xp->query('//w:tbl')->item(0);
        $this->assertSame('TPTabel', $xp->query('./w:tblPr/w:tblStyle/@w:val', $table)->item(0)->nodeValue);
        $this->assertSame(0, $xp->query('.//w:shd', $table)->length, 'Arsiran sel lama harus dibuang.');
        $this->assertSame(1, $xp->query('./w:tr[1]/w:trPr/w:tblHeader', $table)->length);

        // Gambar 250 mm diperkecil ke lebar teks (176 - 20 - 19 = 137 mm).
        $extent = $xp->query('//wp:extent')->item(0);
        $this->assertSame((string) (137 * 36000), $extent->getAttribute('cx'));
        $this->assertSame((string) (int) round(4500000 * (137 * 36000) / 9000000), $extent->getAttribute('cy'));
    }

    public function test_generated_title_pages_footer_and_settings(): void
    {
        $xp = $this->layout();
        $document = $this->parts['word/document.xml'];

        $this->assertStringContainsString('EMBEDDED SYSTEM', $document);
        $this->assertStringContainsString('ISBN : 978-634-05-2943-2', $document);
        $this->assertStringContainsString('Cetakan Pertama, Oktober 2026', $document);
        $this->assertStringContainsString('Lahir pada tahun 2000.', $document, 'Biodata penulis ditambahkan bila naskah tidak memuatnya.');

        $footers = array_filter($this->parts, fn ($xml, $name) => str_starts_with($name, 'word/tp-footer-'), ARRAY_FILTER_USE_BOTH);
        $this->assertNotEmpty($footers);

        foreach ($footers as $xml) {
            $this->assertStringContainsString('Embedded System', $xml);
            $this->assertStringContainsString(' PAGE ', $xml);
        }

        $this->assertStringContainsString('tp-footer-', $this->parts['word/_rels/document.xml.rels']);
        $this->assertStringContainsString('/word/tp-footer-', $this->parts['[Content_Types].xml']);

        $settings = $this->parts['word/settings.xml'];
        $this->assertStringContainsString('<w:evenAndOddHeaders/>', $settings);
        $this->assertStringContainsString('<w:updateFields w:val="true"/>', $settings);
        $this->assertLessThan(strpos($settings, 'w:compat'), strpos($settings, 'w:evenAndOddHeaders'), 'Urutan elemen settings harus sesuai skema.');
        $this->assertGreaterThan(strpos($settings, 'w:defaultTabStop'), strpos($settings, 'w:evenAndOddHeaders'));
    }

    public function test_other_template_choices(): void
    {
        $xp = $this->layout([
            'margins' => ['mirror' => true],
            'heading' => ['h1' => ['number_on_own_line' => true, 'starts_on' => 'right']],
            'drop_cap' => ['enabled' => true, 'lines' => 3],
            'header' => ['enabled' => true, 'odd_left' => '{bab}', 'odd_right' => '', 'even_right' => '{penulis}'],
            'front_matter' => ['title_page' => ['enabled' => false], 'title_verso' => ['enabled' => false]],
        ]);

        $this->assertStringContainsString('<w:mirrorMargins/>', $this->parts['word/settings.xml']);
        $this->assertGreaterThan(0, $xp->query("//w:sectPr/w:type[@w:val='oddPage']")->length);
        $this->assertGreaterThan(0, $xp->query("//w:framePr[@w:dropCap='drop']")->length);

        // "BAB 1" lalu baris baru lalu judul.
        $h1 = $xp->query("//w:p[w:pPr/w:pStyle/@w:val='Heading1']")->item(0);
        $this->assertSame(1, $xp->query('.//w:br', $h1)->length);

        $headers = implode('', array_filter($this->parts, fn ($xml, $name) => str_starts_with($name, 'word/tp-header-'), ARRAY_FILTER_USE_BOTH));
        $this->assertStringContainsString('STYLEREF', $headers);
        $this->assertStringContainsString('Rahima Tartila, S.T, Penulis Dua, dkk.', $headers);

        // Tanpa halaman judul otomatis, identitas di awal naskah dipertahankan.
        $this->assertStringContainsString('Rahima Tartila, S.T', $this->parts['word/document.xml']);
    }

    /** JPEG 1x1 (progresif) untuk foto penulis. */
    private const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    public function test_author_bios_get_photo_name_text_and_one_page_each(): void
    {
        $xp = $this->layout([], [
            ['name' => 'Rahima Tartila, S.T', 'bio' => "Lahir pada tahun 2000.\nKini mengajar.", 'photo' => base64_decode(DocxFixture::PNG)],
            ['name' => 'Penulis Dua', 'bio' => 'Peneliti sistem tertanam.', 'photo' => base64_decode(self::JPEG)],
            ['name' => 'Penulis Tiga', 'bio' => 'Tanpa foto.', 'photo' => null],
        ]);
        $document = $this->parts['word/document.xml'];

        // Biografi yang diketik di naskah diganti data penulis.
        $this->assertStringNotContainsString('Biodata lama', $document);
        $this->assertSame(1, substr_count($document, 'BIODATA PENULIS'));

        foreach (['Rahima Tartila, S.T', 'Lahir pada tahun 2000.', 'Kini mengajar.', 'Penulis Dua', 'Penulis Tiga', 'Tanpa foto.'] as $text) {
            $this->assertStringContainsString($text, $document);
        }

        // Foto disimpan sebagai media + relasi + tipe konten.
        $media = array_values(array_filter(array_keys($this->parts), fn ($name) => str_starts_with($name, 'word/media/tp-foto-')));
        $this->assertCount(2, $media);
        $this->assertStringContainsString('Extension="jpeg"', $this->parts['[Content_Types].xml']);

        foreach ($media as $name) {
            $this->assertStringContainsString('Target="'.substr($name, 5).'"', $this->parts['word/_rels/document.xml.rels']);
        }

        // Foto selebar 30 mm (rasio 1:1), id gambar unik.
        $this->assertSame(2, $xp->query("//wp:extent[@cx='1080000' and @cy='1080000']")->length);
        $ids = array_map(fn ($id) => $id->nodeValue, iterator_to_array($xp->query('//wp:docPr/@id')));
        $this->assertSame(count($ids), count(array_unique($ids)));

        // Penulis kedua dan ketiga mulai di halaman baru.
        $breaks = $xp->query('//w:p[w:pPr/w:pageBreakBefore]');
        $this->assertSame(2, $breaks->length);
        $this->assertSame(1, $xp->query('.//w:drawing', $breaks->item(0))->length);
        $this->assertSame('Penulis Tiga', trim($breaks->item(1)->textContent));
    }

    public function test_author_photo_beside_text_and_all_bios_on_one_page(): void
    {
        $bios = [
            ['name' => 'Rahima Tartila, S.T', 'bio' => 'Lahir pada tahun 2000.', 'photo' => base64_decode(DocxFixture::PNG)],
            ['name' => 'Penulis Dua', 'bio' => 'Peneliti.', 'photo' => base64_decode(DocxFixture::PNG)],
        ];

        $xp = $this->layout(['back_matter' => ['author_bio' => ['photo_position' => 'left']]], $bios);

        // Tabel tanpa garis: foto di sel kiri, nama + bio di sel kanan.
        $tables = $xp->query("//w:tbl[w:tblPr/w:tblBorders/w:top/@w:val='nil']");
        $this->assertSame(2, $tables->length);
        $cells = $xp->query('./w:tr/w:tc', $tables->item(0));
        $this->assertSame(1, $xp->query('.//w:drawing', $cells->item(0))->length);
        $this->assertStringContainsString('Rahima Tartila, S.T', $cells->item(1)->textContent);
        $this->assertSame(1, $xp->query('//w:p[w:pPr/w:pageBreakBefore]')->length);

        // "Satu halaman untuk tiap penulis" dimatikan, foto disembunyikan.
        $xp = $this->layout(['back_matter' => ['author_bio' => ['each_author' => false, 'show_photo' => false]]], $bios);
        $this->assertSame(0, $xp->query('//w:p[w:pPr/w:pageBreakBefore]')->length);
        $this->assertSame([], array_filter(array_keys($this->parts), fn ($name) => str_starts_with($name, 'word/media/tp-foto-')));
        $this->assertStringContainsString('Penulis Dua', $this->parts['word/document.xml']);

        // Tanpa data biografi, biografi di naskah tetap dipakai.
        $this->layout([], []);
        $this->assertStringContainsString('Biodata lama', $this->parts['word/document.xml']);
    }

    public function test_rejects_files_that_are_not_word_documents(): void
    {
        $bad = tempnam(sys_get_temp_dir(), 'bad');
        file_put_contents($bad, 'bukan docx');

        $this->expectException(RuntimeException::class);

        try {
            (new DocxLayout(TemplateSchema::defaults(), ['title' => 'X', 'authors' => []]))->apply($bad);
        } finally {
            @unlink($bad);
        }
    }
}
