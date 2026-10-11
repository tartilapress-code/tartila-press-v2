<?php

namespace Tests\Unit;

use App\Support\ManuscriptTemplates\DefaultTemplates;
use App\Support\ManuscriptTemplates\DocxLayout;
use App\Support\ManuscriptTemplates\DocxMerger;
use App\Support\ManuscriptTemplates\TemplateSchema;
use DOMDocument;
use DOMXPath;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\DocxFixture;
use ZipArchive;

class DocxMergerTest extends TestCase
{
    /** @var list<string> */
    private array $files = [];

    /** @var array<string, string> */
    private array $parts = [];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['A' => 'Pengantar Sensor', 'B' => 'Aktuator'] as $marker => $title) {
            $path = tempnam(sys_get_temp_dir(), 'bab').'.docx';
            DocxFixture::chapter($path, $title, "Penulis $marker", $marker);
            $this->files[$marker] = $path;
        }
    }

    protected function tearDown(): void
    {
        array_map('unlink', $this->files);
        parent::tearDown();
    }

    private function merged(): string
    {
        return (new DocxMerger)->merge([
            ['path' => $this->files['A'], 'number' => 1, 'title' => 'Pengantar Sensor', 'author' => 'Penulis A'],
            ['path' => $this->files['B'], 'number' => 2, 'title' => 'Bab 2', 'author' => 'Penulis B'],
        ]);
    }

    private function open(string $bytes): DOMXPath
    {
        $file = tempnam(sys_get_temp_dir(), 'out');
        file_put_contents($file, $bytes);
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($file) === true);
        $this->parts = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $this->parts[$zip->getNameIndex($i)] = (string) $zip->getFromIndex($i);
        }

        $zip->close();
        unlink($file);

        return $this->xpath($this->parts['word/document.xml']);
    }

    private function xpath(string $xml): DOMXPath
    {
        $doc = new DOMDocument;
        $this->assertTrue($doc->loadXML($xml), 'XML tidak valid.');
        $xp = new DOMXPath($doc);
        $xp->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $xp->registerNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');

        return $xp;
    }

    /** @return list<string> */
    private function paragraphs(DOMXPath $xp): array
    {
        return array_map(fn ($p) => trim($p->textContent), iterator_to_array($xp->query('/w:document/w:body/w:p')));
    }

    public function test_chapters_are_joined_in_order_with_generated_headings(): void
    {
        $xp = $this->open($this->merged());
        $texts = $this->paragraphs($xp);

        // Judul bab dari proyek; judul generik "Bab 2" diganti judul ketikan penulis.
        $this->assertSame(['_TPBab1', '_TPBab2'], array_map(fn ($b) => $b->nodeValue, iterator_to_array($xp->query('//w:bookmarkStart[starts-with(@w:name, "_TPBab")]/@w:name'))));
        $first = array_search('BAB 1 Pengantar Sensor', $texts, true);
        $second = array_search('BAB 2 AKTUATOR', $texts, true);
        $this->assertNotFalse($first);
        $this->assertNotFalse($second);
        $this->assertGreaterThan($first, $second);
        $this->assertSame('Penulis A', $texts[$first + 1]);

        // Judul & nama yang diketik penulis tidak dobel.
        $this->assertSame(1, count(array_keys($texts, 'Penulis A', true)));
        $this->assertNotContains('BAB 1 PENGANTAR SENSOR', $texts);

        // Bab kedua mulai di halaman baru.
        $this->assertSame(1, $xp->query('//w:p[w:pPr/w:pageBreakBefore][w:bookmarkStart[@w:name="_TPBab2"]]')->length);

        // Nomor sub-bab dan caption mengikuti nomor bab.
        $this->assertContains('1.1 Pendahuluan', $texts);
        $this->assertContains('2.1 Pendahuluan', $texts);
        $this->assertContains('2.2 Pembahasan', $texts);
        $this->assertContains('Tabel 2.1 Data B', $texts);
        $this->assertContains('Gambar 2.1 Diagram B', $texts);
        $this->assertContains('Gambar 1.1 Diagram A', $texts);

        // Heading 1 di dalam bab menjadi heading 2; header penulis dibuang.
        $penutup = $xp->query('//w:p[normalize-space(.)="Penutup Bab"]/w:pPr/w:pStyle/@w:val');
        $this->assertSame(['Judul2', 'Judul2'], array_map(fn ($a) => $a->nodeValue, iterator_to_array($penutup)));
        $this->assertSame(0, $xp->query('//w:headerReference')->length);
    }

    public function test_images_links_lists_and_footnotes_of_every_chapter_are_kept(): void
    {
        $xp = $this->open($this->merged());
        $rels = $this->xpath($this->parts['word/_rels/document.xml.rels']);
        $rels->registerNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships');

        $target = fn (string $id) => $rels->query("//p:Relationship[@Id='$id']/@Target")->item(0)?->nodeValue;

        // Gambar tiap bab menunjuk berkas sendiri.
        $images = array_map(fn ($a) => $target($a->nodeValue), iterator_to_array($xp->query('//*[local-name()="blip"]/@r:embed')));
        $this->assertSame(['media/image1.png', 'media/tpb2-image1.png'], $images);
        $this->assertArrayHasKey('word/media/tpb2-image1.png', $this->parts);

        // Tautan luar.
        $links = array_map(fn ($a) => $target($a->nodeValue), iterator_to_array($xp->query('//w:hyperlink/@r:id')));
        $this->assertSame(['https://contoh.id/A', 'https://contoh.id/B'], $links);

        // Daftar bernomor: id berbeda, definisi tersedia, tanpa nsid ganda.
        $numIds = array_map(fn ($a) => $a->nodeValue, iterator_to_array($xp->query('//w:numPr/w:numId/@w:val')));
        $this->assertCount(2, array_unique($numIds));
        $numbering = $this->xpath($this->parts['word/numbering.xml']);

        foreach ($numIds as $id) {
            $this->assertSame(1, $numbering->query("//w:num[@w:numId='$id']")->length);
        }

        $this->assertSame(2, $numbering->query('//w:abstractNum')->length);
        $this->assertSame(1, $numbering->query('//w:nsid')->length);

        // Catatan kaki: id baru, isinya ikut.
        $refs = array_map(fn ($a) => $a->nodeValue, iterator_to_array($xp->query('//w:footnoteReference/@w:id')));
        $this->assertCount(2, array_unique($refs));
        $footnotes = $this->xpath($this->parts['word/footnotes.xml']);
        $this->assertSame('Catatan kaki B', trim($footnotes->query("//w:footnote[@w:id='{$refs[1]}']")->item(0)->textContent));

        // Gaya rujukan catatan kaki tersedia.
        $this->assertStringContainsString('w:styleId="RefCatatan"', $this->parts['word/styles.xml']);
    }

    public function test_auto_layout_in_compilation_mode_keeps_chapter_sections_inside_chapters(): void
    {
        $merged = tempnam(sys_get_temp_dir(), 'gab').'.docx';
        file_put_contents($merged, $this->merged());

        try {
            $config = TemplateSchema::normalize(DefaultTemplates::embeddedSystem());
            $bytes = (new DocxLayout($config, [
                'title' => 'Buku Bersama',
                'authors' => ['Penulis A', 'Penulis B'],
                'author_bio' => [['name' => 'Penulis A', 'bio' => 'Bio A.'], ['name' => 'Penulis B', 'bio' => 'Bio B.']],
                'compilation' => true,
            ]))->apply($merged);
        } finally {
            unlink($merged);
        }

        $xp = $this->open($bytes);
        $styled = function (string $style) use ($xp) {
            return array_map(fn ($p) => trim($p->textContent), iterator_to_array($xp->query("//w:p[w:pPr/w:pStyle/@w:val='$style']")));
        };

        $this->assertSame(['BAB 1: Pengantar Sensor', 'BAB 2: AKTUATOR'], $styled('Heading1'));
        $this->assertSame(['Penulis A', 'Penulis B'], $styled('TPPenulisBab'));

        // Daftar pustaka tiap bab tetap di babnya (bukan bagian penutup buku).
        $this->assertSame(['DAFTAR PUSTAKA', 'DAFTAR PUSTAKA'], $styled('TPJudulSubBagian'));
        $this->assertSame(['[1] Referensi A, 2024.', '[1] Referensi B, 2024.'], $styled('TPPustaka'));
        $this->assertNotContains('DAFTAR PUSTAKA', $styled('TPJudulBagian'));
        $this->assertContains('BIODATA PENULIS', $styled('TPJudulBagian'));

        // "Penutup Bab" (heading 1 di naskah) tidak menjadi bab baru.
        $this->assertContains('Penutup Bab', $styled('Heading2'));

        // Gaya Word bahasa Indonesia ("Judul1" = heading 1) disatukan ke gaya
        // template: hanya satu gaya bernama "heading 1", tanpa rujukan lama.
        $this->assertSame(1, substr_count($this->parts['word/styles.xml'], '<w:name w:val="heading 1"/>'));
        $this->assertStringNotContainsString('w:styleId="Judul1"', $this->parts['word/styles.xml']);
        $this->assertSame(0, $xp->query("//w:pStyle[@w:val='Judul1' or @w:val='Judul2']")->length);
    }

    public function test_rejects_a_chapter_that_is_not_a_word_document(): void
    {
        $bad = tempnam(sys_get_temp_dir(), 'bad');
        file_put_contents($bad, 'bukan docx');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('BAB 2');

        try {
            (new DocxMerger)->merge([
                ['path' => $this->files['A'], 'number' => 1, 'title' => 'A', 'author' => 'A'],
                ['path' => $bad, 'number' => 2, 'title' => 'B', 'author' => 'B'],
            ]);
        } finally {
            unlink($bad);
        }
    }
}
