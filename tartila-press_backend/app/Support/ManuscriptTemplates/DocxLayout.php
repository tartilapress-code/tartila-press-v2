<?php

namespace App\Support\ManuscriptTemplates;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use RuntimeException;
use ZipArchive;

/**
 * Auto layout naskah Word (.docx) menurut template naskah.
 *
 * Isi tulisan penulis tidak diketik ulang: dokumen aslinya dirapikan
 * langsung di XML-nya. Format langsung (font, ukuran, spasi, perataan)
 * dibuang lalu diganti gaya dari template; heading, caption, tabel, gambar,
 * daftar pustaka dikenali dari gaya Word atau dari teksnya ("BAB 1", "1.1",
 * "Gambar 1.1", "DAFTAR PUSTAKA", ...); halaman judul, balik halaman judul,
 * daftar isi/gambar/tabel (field Word), header/footer, nomor halaman dan
 * pembagian section (romawi untuk bagian awal, angka untuk isi) dibuat
 * otomatis. Hasilnya tetap dokumen Word yang bisa disunting editor.
 */
final class DocxLayout
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    private const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

    private const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';

    private const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';

    private const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

    private const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

    private const IMAGE_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

    private const HEADER_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header';

    private const FOOTER_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';

    /** Judul bagian awal/penutup yang dikenali dari teksnya. */
    private const FRONT_TITLES = [
        'preface' => ['KATA PENGANTAR', 'PRAKATA', 'PENGANTAR', 'KATA SAMBUTAN'],
        'toc' => ['DAFTAR ISI'],
        'list_of_figures' => ['DAFTAR GAMBAR'],
        'list_of_tables' => ['DAFTAR TABEL'],
    ];

    private const BACK_TITLES = [
        'bibliography' => ['DAFTAR PUSTAKA', 'DAFTAR REFERENSI', 'REFERENSI', 'BIBLIOGRAFI', 'RUJUKAN', 'DAFTAR RUJUKAN'],
        'appendix' => ['LAMPIRAN', 'LAMPIRAN-LAMPIRAN'],
        'glossary' => ['GLOSARIUM', 'GLOSARI', 'DAFTAR ISTILAH'],
        'index' => ['INDEKS', 'INDEX'],
        'author_bio' => ['BIODATA PENULIS', 'BIOGRAFI PENULIS', 'TENTANG PENULIS', 'PROFIL PENULIS', 'BIODATA'],
    ];

    private const MONO_FONTS = ['consolas', 'courier', 'courier new', 'lucida console', 'source code pro', 'menlo', 'monaco', 'jetbrains mono', 'fira code', 'roboto mono'];

    private DOMDocument $doc;

    private DOMXPath $xp;

    /** @var array<string, string> styleId => nama gaya (huruf kecil) */
    private array $styleNames = [];

    /** @var array<string, int> styleId => level outline */
    private array $styleOutline = [];

    /** @var array<string, array{numId: string, ilvl: string}> penomoran otomatis yang melekat di gaya penulis */
    private array $styleNumbering = [];

    /** @var array<string, string> path part => isi baru */
    private array $parts = [];

    private int $relCounter = 0;

    /** @var array<string, string> id gaya penulis => id gaya template bernama sama */
    private array $styleRenames = [];

    /** id gambar (wp:docPr) terakhir; harus unik di seluruh dokumen. */
    private int $drawingId = 0;

    /**
     * @param  array<string, mixed>  $config  config template (sudah dinormalisasi)
     * @param  array{title: string, authors: list<string>, editor?: string|null, isbn?: string|null, month_year?: string|null, publisher?: string|null, author_bio?: list<array{name: string, bio: string}>}  $data
     */
    public function __construct(private readonly array $config, private readonly array $data) {}

    /** Terapkan template ke berkas .docx $source; mengembalikan isi .docx baru. */
    public function apply(string $source): string
    {
        $work = tempnam(sys_get_temp_dir(), 'tpdocx');

        if ($work === false || ! copy($source, $work)) {
            throw new RuntimeException('Berkas naskah tidak bisa disalin.');
        }

        $zip = new ZipArchive;

        if ($zip->open($work) !== true || $zip->locateName('word/document.xml') === false) {
            @unlink($work);

            throw new RuntimeException('Berkas bukan dokumen Word (.docx) yang valid.');
        }

        try {
            DocxPackage::assertSafeSize($zip);
            $this->doc = $this->load((string) $zip->getFromName('word/document.xml'));
            $this->xp = $this->xpath($this->doc);
            $this->readStyles((string) $zip->getFromName('word/styles.xml'));

            $headerFooter = $this->buildHeadersFooters($zip);
            $this->layoutBody($headerFooter);

            // Gaya bernama sama dengan id lain (Word bahasa Indonesia: "Judul1"
            // = heading 1) disatukan ke gaya template supaya tidak bentrok.
            $this->styleRenames = $this->styleRenames((string) $zip->getFromName('word/styles.xml'));
            $this->renameStyleReferences($this->doc);

            foreach (['word/numbering.xml', 'word/footnotes.xml', 'word/endnotes.xml'] as $part) {
                $xml = $this->styleRenames === [] ? false : $zip->getFromName($part);

                if ($xml) {
                    $partDoc = $this->load($xml);
                    $this->renameStyleReferences($partDoc);
                    $zip->addFromString($part, $partDoc->saveXML());
                }
            }

            $zip->addFromString('word/document.xml', $this->doc->saveXML());
            $zip->addFromString('word/styles.xml', $this->buildStyles((string) $zip->getFromName('word/styles.xml')));
            $zip->addFromString('word/settings.xml', $this->buildSettings($zip->getFromName('word/settings.xml') ?: null, $zip));

            foreach ($this->parts as $path => $xml) {
                $zip->addFromString($path, $xml);
            }

            $zip->close();
            $closed = true;
            DocxPackage::sanitizeFile($work);
            $bytes = (string) file_get_contents($work);
        } finally {
            if (! isset($closed)) {
                // Berkas harus tertutup sebelum dihapus (Windows).
                $zip->unchangeAll();
                $zip->close();
            }

            @unlink($work);
        }

        return $bytes;
    }

    // =====================================================================
    // Badan dokumen
    // =====================================================================

    /**
     * @param  array<string, array<string, string>>  $hf  set header/footer: main|plain => [type => rId]
     */
    private function layoutBody(array $hf): void
    {
        $body = $this->xp->query('/w:document/w:body')->item(0);

        if (! $body instanceof DOMElement) {
            throw new RuntimeException('Dokumen Word tidak punya isi.');
        }

        foreach ($this->xp->query('//wp:docPr/@id') as $id) {
            $this->drawingId = max($this->drawingId, (int) $id->nodeValue);
        }

        // Section lama dan pemisah halaman manual dibuang: section dibangun ulang.
        foreach (iterator_to_array($this->xp->query('//w:pPr/w:sectPr | //w:br[@w:type="page"] | //w:lastRenderedPageBreak | //w:pPr/w:pageBreakBefore')) as $node) {
            $node->parentNode?->removeChild($node);
        }

        $elements = [];

        foreach (iterator_to_array($body->childNodes) as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            if ($child->localName === 'sectPr') {
                $body->removeChild($child);

                continue;
            }

            $elements[] = $child;
        }

        // ---------------------------------------------------- kenali isi
        $items = array_map(fn (DOMElement $node) => $this->classify($node), $elements);

        $pre = [];
        $front = [];
        $chapters = [];
        $back = [];
        $state = 'pre';

        foreach ($items as $item) {
            // Book Chapter: Daftar Pustaka/Lampiran milik bab tetap di babnya.
            if ($this->isCompilation() && $chapters !== [] && preg_match('/^(front|back):(.+)$/', $item['role'], $m)) {
                // Daftar isi/gambar/tabel milik naskah bab tidak dipakai:
                // buku punya satu daftar isi.
                if (in_array($m[2], ['toc', 'list_of_figures', 'list_of_tables'], true)) {
                    continue;
                }

                $item['role'] = 'subsection:'.$m[2];
            }

            if ($this->isCompilation() && $item['role'] === 'toc_line') {
                continue;
            }

            $role = $item['role'];

            if ($role === 'h1') {
                $state = 'body';
                $chapters[] = [$item];

                continue;
            }

            if (str_starts_with($role, 'front:') && $chapters === []) {
                $state = 'front';
                $front[] = ['key' => substr($role, 6), 'items' => [$item]];

                continue;
            }

            if (str_starts_with($role, 'back:') && ($chapters !== [] || $front !== [])) {
                $state = 'back';
                $back[] = ['key' => substr($role, 5), 'items' => [$item]];

                continue;
            }

            match ($state) {
                'pre' => $pre[] = $item,
                'front' => $front[array_key_last($front)]['items'][] = $item,
                'body' => $chapters[array_key_last($chapters)][] = $item,
                default => $back[array_key_last($back)]['items'][] = $item,
            };
        }

        // Naskah tanpa "BAB": semua isi setelah bagian awal dianggap isi.
        if ($chapters === [] && $pre !== [] && $front === []) {
            $chapters[] = $pre;
            $pre = [];
        }

        // ---------------------------------------------------- rapikan gaya
        $counts = ['figure' => 0, 'table' => 0];

        foreach ($items as $item) {
            if ($item['role'] === 'caption_figure' || $item['role'] === 'caption_chart') {
                $counts['figure']++;
            }

            if ($item['role'] === 'caption_table') {
                $counts['table']++;
            }
        }

        foreach ([$pre, ...array_column($front, 'items'), ...$chapters, ...array_column($back, 'items')] as $group) {
            $previousRole = null;

            foreach ($group as $index => $item) {
                $this->restyle($item, $previousRole, $group[$index + 1] ?? null);
                $previousRole = $item['role'];
            }
        }

        // Daftar pustaka di dalam bab (Book Chapter) sampai heading berikutnya.
        foreach ($chapters as $chapter) {
            $inBibliography = false;

            foreach ($chapter as $item) {
                if (str_starts_with($item['role'], 'subsection:') || in_array($item['role'], ['h1', 'h2', 'h3'], true)) {
                    $inBibliography = $item['role'] === 'subsection:bibliography';

                    continue;
                }

                if ($inBibliography && $item['node']->localName === 'p' && $item['role'] === 'body') {
                    $this->setStyle($item['node'], 'TPPustaka');
                }
            }
        }

        foreach ($back as $block) {
            if ($block['key'] === 'bibliography') {
                foreach (array_slice($block['items'], 1) as $item) {
                    if ($item['node']->localName === 'p' && $item['role'] === 'body') {
                        $this->setStyle($item['node'], 'TPPustaka');
                    }
                }
            }
        }

        $this->applyDropCaps($chapters);
        $this->scaleImages();

        // ---------------------------------------------------- susun ulang
        foreach ($elements as $element) {
            $element->parentNode?->removeChild($element);
        }

        $sections = [];

        // Halaman judul + balik halaman judul (tanpa nomor).
        $titleNodes = [];

        if ($this->cfg('front_matter.title_page.enabled')) {
            array_push($titleNodes, ...$this->titlePage());
        }

        if ($this->cfg('front_matter.title_verso.enabled')) {
            if ($titleNodes !== []) {
                $titleNodes[] = $this->pageBreakParagraph();
            }

            array_push($titleNodes, ...$this->versoPage());
        }

        // Bahan pembuka penulis (judul/identitas di awal naskah) tidak dipakai
        // kalau halaman judul dibuat otomatis dan isinya hanya teks pendek.
        $preText = implode(' ', array_column($pre, 'text'));
        $preHasMedia = array_filter($pre, fn ($item) => $item['has_media'] || $item['node']->localName === 'tbl') !== [];

        if ($pre !== [] && ! ($this->cfg('front_matter.title_page.enabled') && mb_strlen($preText) < 400 && ! $preHasMedia)) {
            $sections[] = ['nodes' => array_column($pre, 'node'), 'set' => 'plain', 'type' => 'nextPage', 'numbering' => 'front'];
        }

        // Bagian awal menurut urutan template.
        $frontByKey = [];

        foreach ($front as $block) {
            $frontByKey[$block['key']][] = $block;
        }

        foreach ((array) $this->cfg('front_matter.order') as $key) {
            if (in_array($key, ['cover', 'title_page', 'title_verso'], true)) {
                continue;
            }

            $enabled = (bool) $this->cfg("front_matter.$key.enabled");
            $startsOn = $this->cfg("front_matter.$key.starts_on") === 'right' ? 'oddPage' : 'nextPage';
            $blocks = $frontByKey[$key] ?? [];

            if (in_array($key, ['toc', 'list_of_figures', 'list_of_tables'], true) && $enabled) {
                $kind = ['toc' => null, 'list_of_figures' => 'figure', 'list_of_tables' => 'table'][$key];

                if ($kind !== null && $counts[$kind] === 0 && $this->cfg("front_matter.$key.skip_if_empty")) {
                    continue;
                }

                $sections[] = ['nodes' => $this->fieldList($key), 'set' => 'plain', 'type' => $startsOn, 'numbering' => 'front'];

                continue;
            }

            foreach ($blocks as $block) {
                if ($key === 'preface') {
                    $this->replaceHeadingText($block['items'][0]['node'], (string) $this->cfg('front_matter.preface.heading'));
                    $this->alignNode($block['items'][0]['node'], (string) $this->cfg('front_matter.preface.heading_align'));
                }

                $sections[] = ['nodes' => array_column($block['items'], 'node'), 'set' => 'plain', 'type' => $startsOn, 'numbering' => 'front'];
            }
        }

        // Isi: satu section per bab.
        $chapterStart = $this->cfg('heading.h1.starts_on') === 'right' ? 'oddPage' : 'nextPage';

        foreach ($chapters as $chapter) {
            $sections[] = ['nodes' => array_column($chapter, 'node'), 'set' => 'main', 'type' => $chapterStart, 'numbering' => 'body', 'opening' => true];
        }

        // Bagian penutup menurut urutan template; yang tidak dikenali tetap di akhir.
        $backByKey = [];

        foreach ($back as $block) {
            $backByKey[$block['key']][] = $block;
        }

        foreach ((array) $this->cfg('back_matter.order') as $key) {
            $startsOn = $this->cfg("back_matter.$key.starts_on") === 'right' ? 'oddPage' : 'nextPage';

            // Biografi dibuat dari data penulis (Profil Publik / isian saat
            // upload) dan menggantikan biografi yang diketik di naskah.
            if ($key === 'author_bio' && $this->cfg('back_matter.author_bio.enabled')) {
                $bio = $this->authorBioNodes();

                if ($bio !== []) {
                    $sections[] = ['nodes' => $bio, 'set' => 'plain', 'type' => $startsOn, 'numbering' => 'back'];

                    continue;
                }
            }

            foreach ($backByKey[$key] ?? [] as $block) {
                $heading = (string) $this->cfg("back_matter.$key.heading");
                $this->replaceHeadingText($block['items'][0]['node'], $heading);
                $this->alignNode($block['items'][0]['node'], (string) $this->cfg("back_matter.$key.heading_align"));
                $sections[] = ['nodes' => array_column($block['items'], 'node'), 'set' => 'plain', 'type' => $startsOn, 'numbering' => 'back'];
            }
        }

        if ($titleNodes !== []) {
            array_unshift($sections, ['nodes' => $titleNodes, 'set' => 'none', 'type' => 'nextPage', 'numbering' => 'none']);
        }

        if ($sections === []) {
            $sections[] = ['nodes' => [$this->paragraph([])], 'set' => 'main', 'type' => 'nextPage', 'numbering' => 'body'];
        }

        // ---------------------------------------------------- tulis section
        $started = ['front' => false, 'body' => false, 'back' => false];
        $last = count($sections) - 1;

        foreach ($sections as $index => $section) {
            $numbering = $section['numbering'];
            $restart = null;

            if ($numbering !== 'none' && ! $started[$numbering]) {
                $started[$numbering] = true;
                $restart = match ($numbering) {
                    'front' => 1,
                    'body' => (int) $this->cfg('pagination.body_start'),
                    default => $this->cfg('pagination.continue_back') ? null : 1,
                };
            }

            $sectPr = $this->sectPr($section, $hf, $restart);
            $nodes = $section['nodes'];

            foreach ($nodes as $node) {
                $body->appendChild($node);
            }

            if ($index === $last) {
                $body->appendChild($sectPr);

                continue;
            }

            // Pemisah section di paragraf kosong tersendiri: paragraf rata
            // kiri-kanan yang diakhiri pemisah section akan diratakan baris
            // terakhirnya oleh Word.
            $holder = $this->el('w:p');
            $holderPr = $this->el('w:pPr');
            $holderPr->appendChild($this->el('w:spacing', ['w:before' => '0', 'w:after' => '0', 'w:line' => '20', 'w:lineRule' => 'exact']));
            $holderPr->appendChild($this->el('w:ind', ['w:firstLine' => '0']));
            $mark = $this->el('w:rPr');
            $mark->appendChild($this->el('w:sz', ['w:val' => '2']));
            $holderPr->appendChild($mark);
            $holderPr->appendChild($sectPr);
            $holder->appendChild($holderPr);
            $body->appendChild($holder);
        }
    }

    // =====================================================================
    // Pengenalan peran tiap elemen
    // =====================================================================

    /**
     * @return array{node: DOMElement, role: string, text: string, has_media: bool}
     */
    private function classify(DOMElement $node): array
    {
        $item = ['node' => $node, 'role' => 'other', 'text' => '', 'has_media' => false];

        if ($node->localName === 'tbl') {
            $item['role'] = 'table';
            $item['text'] = $this->text($node);

            return $item;
        }

        if ($node->localName === 'sdt') {
            $gallery = $this->xp->query('.//w:docPartGallery/@w:val', $node)->item(0)?->nodeValue;
            $item['text'] = $this->text($node);
            $item['role'] = $gallery && stripos($gallery, 'Table of Contents') !== false ? 'front:toc' : 'other';

            return $item;
        }

        if ($node->localName !== 'p') {
            return $item;
        }

        $text = trim(preg_replace('/\s+/u', ' ', $this->text($node)) ?? '');
        $item['text'] = $text;
        $item['has_media'] = $this->xp->query('.//w:drawing | .//w:pict | .//w:object', $node)->length > 0;

        if ($item['has_media'] && mb_strlen($text) < 5) {
            $item['role'] = 'image';

            return $item;
        }

        if ($text === '') {
            $item['role'] = 'empty';

            return $item;
        }

        // Naskah gabungan Book Chapter: batas bab ditandai DocxMerger.
        if ($this->isCompilation()) {
            if ($this->xp->query('./w:bookmarkStart[starts-with(@w:name, "_TPBab")]', $node)->length > 0) {
                $item['role'] = 'h1';

                return $item;
            }

            if ($this->xp->query('./w:bookmarkStart[starts-with(@w:name, "_TPPenulis")]', $node)->length > 0) {
                $item['role'] = 'chapter_author';

                return $item;
            }
        }

        $styleId = $this->xp->query('./w:pPr/w:pStyle/@w:val', $node)->item(0)?->nodeValue ?? '';
        $styleName = $this->styleNames[$styleId] ?? strtolower($styleId);
        $outline = $this->xp->query('./w:pPr/w:outlineLvl/@w:val', $node)->item(0)?->nodeValue;
        $level = $outline !== null ? (int) $outline + 1 : ($this->styleOutline[$styleId] ?? null);

        if ($level === null && preg_match('/^(heading|judul)\s*([1-3])$/', $styleName, $m)) {
            $level = (int) $m[2];
        }

        $plain = mb_strtoupper(trim(preg_replace('/[^\p{L}\s-]/u', ' ', $text) ?? ''));
        $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?? '');
        $short = mb_strlen($text) <= 60;

        if ($short) {
            foreach (self::FRONT_TITLES as $key => $titles) {
                if (in_array($plain, $titles, true)) {
                    $item['role'] = $key === 'toc' ? 'front:toc' : 'front:'.$key;

                    return $item;
                }
            }

            foreach (self::BACK_TITLES as $key => $titles) {
                if (in_array($plain, $titles, true) || ($key === 'appendix' && $plain === 'LAMPIRAN')) {
                    $item['role'] = 'back:'.$key;

                    return $item;
                }
            }
        }

        // Baris daftar isi/gambar/tabel yang diketik manual: "BAB 1 ...... 1".
        if (preg_match('/(\.{4,}|…{2,}|_{4,})\s*[0-9ivxlcdm]+\s*$/iu', $text) || preg_match('/\t\s*[0-9ivxlcdm]+\s*$/iu', $this->text($node))) {
            $item['role'] = 'toc_line';

            return $item;
        }

        if (preg_match('/^(gambar|tabel|grafik|diagram|ilustrasi)\s+\d+([\s.\-]*\d+)*\b/iu', $text, $m) && mb_strlen($text) <= 300) {
            $word = mb_strtolower($m[1]);
            $item['role'] = $word === 'tabel' ? 'caption_table' : ($word === 'gambar' ? 'caption_figure' : 'caption_chart');

            return $item;
        }

        if ($this->isMonospace($node)) {
            $item['role'] = 'code';

            return $item;
        }

        $length = mb_strlen($text);
        $endsWithStop = (bool) preg_match('/[.;,]$/u', $text);

        if ($level === 1 || (preg_match('/^bab\s+([0-9]+|[ivxlcdm]+)\b/iu', $text) && $length <= 140)) {
            // Di naskah gabungan hanya judul bab buatan DocxMerger yang heading 1.
            $item['role'] = $this->isCompilation() ? 'h2' : 'h1';

            return $item;
        }

        if ($level === 2 || (preg_match('/^\d+\.\d+\.?\s+\S/u', $text) && $length <= 140 && ! $endsWithStop)) {
            $item['role'] = 'h2';

            return $item;
        }

        if ($level === 3 || (preg_match('/^\d+\.\d+\.\d+\.?\s+\S/u', $text) && $length <= 160 && ! $endsWithStop)) {
            $item['role'] = 'h3';

            return $item;
        }

        $item['role'] = $this->xp->query('./w:pPr/w:numPr', $node)->length > 0 ? 'list' : 'body';

        return $item;
    }

    // =====================================================================
    // Penataan ulang gaya tiap elemen
    // =====================================================================

    /**
     * @param  array{node: DOMElement, role: string, text: string, has_media: bool}  $item
     * @param  array{node: DOMElement, role: string, text: string, has_media: bool}|null  $next
     */
    private function restyle(array $item, ?string $previousRole, ?array $next): void
    {
        $node = $item['node'];
        $role = $item['role'];

        if ($role === 'table') {
            $this->restyleTable($node);

            return;
        }

        if ($node->localName !== 'p') {
            return;
        }

        switch (true) {
            case in_array($role, ['h1', 'h2', 'h3'], true):
                $this->inheritStyleNumbering($node);
                $this->stripParagraph($node, keepNumbering: true);
                $this->stripRuns($node, heading: true);
                $this->setStyle($node, ['h1' => 'Heading1', 'h2' => 'Heading2', 'h3' => 'Heading3'][$role]);

                if ($role === 'h1') {
                    $this->rebuildChapterHeading($node, $item['text']);
                }

                return;

            case str_starts_with($role, 'front:') || str_starts_with($role, 'back:'):
                $this->stripParagraph($node, keepNumbering: false);
                $this->stripRuns($node, heading: true);
                $this->setStyle($node, 'TPJudulBagian');

                return;

            case str_starts_with($role, 'subsection:'):
                $this->stripParagraph($node, keepNumbering: false);
                $this->stripRuns($node, heading: true);
                $this->setStyle($node, 'TPJudulSubBagian');

                return;

            case $role === 'chapter_author':
                $this->stripParagraph($node, keepNumbering: false);
                $this->stripRuns($node, heading: true);
                $this->setStyle($node, 'TPPenulisBab');

                return;

            case str_starts_with($role, 'caption_'):
                $this->stripParagraph($node, keepNumbering: false);
                $kind = $role === 'caption_table' ? 'tables' : 'figures';
                $this->setStyle($node, $kind === 'tables' ? 'TPKeteranganTabel' : 'TPKeteranganGambar');
                $this->rebuildCaption($node, $item['text'], $kind, $role === 'caption_chart');

                return;

            case $role === 'image':
                $this->stripParagraph($node, keepNumbering: false);
                $this->setStyle($node, 'TPGambar');

                if ($next !== null && str_starts_with($next['role'], 'caption_') && $this->cfg('figures.keep_with_caption')) {
                    $this->setChild($this->pPr($node), 'w:keepNext', []);
                }

                return;

            case $role === 'code':
                $this->pPrRemove($node, ['w:jc', 'w:pageBreakBefore']);
                $this->setChild($this->pPr($node), 'w:ind', ['w:firstLine' => '0']);
                $this->setChild($this->pPr($node), 'w:jc', ['w:val' => 'left']);
                // Kode program rapat: satu spasi, tanpa jarak antarbaris kode.
                $this->setChild($this->pPr($node), 'w:spacing', ['w:before' => '0', 'w:after' => '0', 'w:line' => '240', 'w:lineRule' => 'auto']);

                return;

            case $role === 'list':
                $this->pPrRemove($node, ['w:spacing', 'w:jc', 'w:keepNext', 'w:rPr']);
                $this->stripRuns($node, heading: false);

                return;

            case $role === 'body':
                $this->stripParagraph($node, keepNumbering: true);
                $this->stripRuns($node, heading: false);
                $this->setStyle($node, null);

                // Alenia pertama setelah heading tanpa indentasi.
                $afterHeading = in_array($previousRole, ['h1', 'h2', 'h3', 'chapter_author'], true)
                    || str_starts_with((string) $previousRole, 'subsection:')
                    || str_starts_with((string) $previousRole, 'front:')
                    || str_starts_with((string) $previousRole, 'back:');

                if ($afterHeading && $this->cfg('paragraph.no_indent_after_heading')) {
                    $this->setChild($this->pPr($node), 'w:ind', ['w:firstLine' => '0']);
                }

                return;
        }
    }

    private function restyleTable(DOMElement $table): void
    {
        $tblPr = $this->xp->query('./w:tblPr', $table)->item(0);

        if (! $tblPr instanceof DOMElement) {
            $tblPr = $this->el('w:tblPr');
            $table->insertBefore($tblPr, $table->firstChild);
        }

        foreach (['w:tblStyle', 'w:tblBorders', 'w:jc', 'w:tblCellMar', 'w:shd'] as $name) {
            foreach (iterator_to_array($this->xp->query('./'.$name, $tblPr)) as $old) {
                $tblPr->removeChild($old);
            }
        }

        $this->setChild($tblPr, 'w:tblStyle', ['w:val' => 'TPTabel']);
        $this->setChild($tblPr, 'w:jc', ['w:val' => $this->cfg('tables.align') === 'left' ? 'left' : ($this->cfg('tables.align') === 'right' ? 'right' : 'center')]);

        $look = $this->xp->query('./w:tblLook', $tblPr)->item(0);

        if ($look instanceof DOMElement) {
            $tblPr->removeChild($look);
        }

        $this->insertOrdered($tblPr, $this->el('w:tblLook', [
            'w:val' => '04A0', 'w:firstRow' => '1', 'w:lastRow' => '0', 'w:firstColumn' => '0',
            'w:lastColumn' => '0', 'w:noHBand' => $this->cfg('tables.zebra') ? '0' : '1', 'w:noVBand' => '1',
        ]));

        // Batas dan arsiran per sel diserahkan ke gaya tabel.
        foreach (iterator_to_array($this->xp->query('.//w:tcPr/w:tcBorders | .//w:tcPr/w:shd', $table)) as $old) {
            $old->parentNode?->removeChild($old);
        }

        $firstRow = $this->xp->query('./w:tr', $table)->item(0);

        if ($firstRow instanceof DOMElement && $this->cfg('tables.repeat_header')) {
            $trPr = $this->xp->query('./w:trPr', $firstRow)->item(0);

            if (! $trPr instanceof DOMElement) {
                $trPr = $this->el('w:trPr');
                $firstRow->insertBefore($trPr, $firstRow->firstChild);
            }

            $this->setChild($trPr, 'w:tblHeader', []);
        }

        foreach (iterator_to_array($this->xp->query('.//w:tc//w:p', $table)) as $paragraph) {
            if ($this->isMonospace($paragraph)) {
                continue;
            }

            $this->stripParagraph($paragraph, keepNumbering: true);
            $this->stripRuns($paragraph, heading: false);
            $this->setStyle($paragraph, 'TPIsiTabel');
        }
    }

    /** "BAB 1: PENGANTAR" / "Bab I Pengantar" -> label + nomor + pemisah + judul menurut template. */
    private function rebuildChapterHeading(DOMElement $p, string $text): void
    {
        if (! preg_match('/^bab\s+([0-9]+|[ivxlcdm]+)\s*[:.\-–—]?\s*(.*)$/iu', $text, $m)) {
            return;
        }

        $number = $m[1];
        $title = trim($m[2]);
        $label = trim((string) $this->cfg('heading.h1.label'));
        $numbering = (string) $this->cfg('heading.h1.numbering');

        if ($numbering === 'none') {
            $this->replaceRuns($p, [['text' => $title !== '' ? $title : $text]]);

            return;
        }

        $prefix = ($label !== '' && $numbering === 'bab' ? $label.' ' : '').$number;

        if ($title === '') {
            $this->replaceRuns($p, [['text' => $prefix]]);

            return;
        }

        if ($this->cfg('heading.h1.number_on_own_line')) {
            $this->replaceRuns($p, [['text' => $prefix], ['break' => true], ['text' => $title]]);

            return;
        }

        $this->replaceRuns($p, [['text' => $prefix.(string) $this->cfg('heading.h1.number_separator').$title]]);
    }

    /** "Gambar 1. 1 Hubungan ..." -> "Gambar 1.1. Hubungan ..." dengan label tebal opsional. */
    private function rebuildCaption(DOMElement $p, string $text, string $kind, bool $chart): void
    {
        if (! preg_match('/^(\p{L}+)\s+(\d+(?:[\s.\-]*\d+)*)\s*[.:\-–—]?\s*(.*)$/u', $text, $m)) {
            return;
        }

        $configured = trim((string) $this->cfg("$kind.caption.label"));
        $label = $chart ? (string) $this->cfg('figures.chart_label') : ($configured !== '' ? $configured : $m[1]);
        $number = preg_replace('/[\s]+/', '', str_replace('-', '.', $m[2])) ?? $m[2];
        $rest = trim($m[3]);
        $separator = (string) $this->cfg("$kind.caption.separator");

        $runs = [['text' => $label.' '.$number, 'bold' => (bool) $this->cfg("$kind.caption.bold_label")]];

        if ($rest !== '') {
            $runs[] = ['text' => rtrim($separator).' '.$rest, 'italic' => (bool) $this->cfg("$kind.caption.italic")];
        }

        $this->replaceRuns($p, $runs);

        // Entri untuk daftar gambar (\f g) / daftar tabel (\f t).
        $entry = trim($label.' '.$number.rtrim($separator).' '.$rest);
        $identifier = $kind === 'tables' ? 't' : 'g';

        foreach ([['begin'], ['instr', sprintf(' TC "%s" \\f %s \\l 1 ', str_replace('"', "'", $entry), $identifier)], ['end']] as $part) {
            $run = $this->el('w:r');

            if ($part[0] === 'instr') {
                $instr = $this->el('w:instrText', ['xml:space' => 'preserve']);
                $instr->textContent = $part[1];
                $run->appendChild($instr);
            } else {
                $run->appendChild($this->el('w:fldChar', ['w:fldCharType' => $part[0]]));
            }

            $p->appendChild($run);
        }
    }

    /**
     * @param  list<list<array{node: DOMElement, role: string, text: string, has_media: bool}>>  $chapters
     */
    private function applyDropCaps(array $chapters): void
    {
        if (! $this->cfg('drop_cap.enabled')) {
            return;
        }

        $sectionsToo = $this->cfg('drop_cap.apply_to') === 'section_first';

        foreach ($chapters as $chapter) {
            $armed = false;

            foreach ($chapter as $item) {
                if ($item['role'] === 'h1' || ($sectionsToo && in_array($item['role'], ['h2', 'h3'], true))) {
                    $armed = true;

                    continue;
                }

                if ($armed && $item['role'] === 'body' && mb_strlen($item['text']) > 40) {
                    $this->dropCap($item['node']);
                    $armed = false;
                }
            }
        }
    }

    private function dropCap(DOMElement $p): void
    {
        $first = $this->xp->query('.//w:r/w:t[string-length(normalize-space(.)) > 0]', $p)->item(0);

        if (! $first instanceof DOMElement) {
            return;
        }

        $value = ltrim($first->textContent);
        $letter = mb_substr($value, 0, 1);
        $first->textContent = mb_substr($value, 1);
        $first->setAttribute('xml:space', 'preserve');

        $lines = (int) $this->cfg('drop_cap.lines');
        $lineTwips = (int) round((float) $this->cfg('typography.body.size_pt') * (float) $this->cfg('paragraph.line_spacing') * 1.17 * 20);
        $font = (string) $this->cfg('drop_cap.font');

        $frame = $this->el('w:p');
        $pPr = $this->el('w:pPr');
        $pPr->appendChild($this->el('w:keepNext'));
        $pPr->appendChild($this->el('w:framePr', [
            'w:dropCap' => 'drop', 'w:lines' => (string) $lines, 'w:wrap' => 'around',
            'w:vAnchor' => 'text', 'w:hAnchor' => 'text', 'w:hSpace' => (string) $this->twips((float) $this->cfg('drop_cap.padding_mm')),
        ]));
        $pPr->appendChild($this->el('w:spacing', ['w:before' => '0', 'w:after' => '0', 'w:line' => (string) ($lineTwips * $lines), 'w:lineRule' => 'exact']));
        $pPr->appendChild($this->el('w:ind', ['w:firstLine' => '0']));
        $pPr->appendChild($this->el('w:textAlignment', ['w:val' => 'baseline']));
        $frame->appendChild($pPr);

        $run = $this->el('w:r');
        $rPr = $this->el('w:rPr');
        $rPr->appendChild($this->el('w:rFonts', ['w:ascii' => $font, 'w:hAnsi' => $font, 'w:cs' => $font]));

        if ($this->cfg('drop_cap.bold')) {
            $rPr->appendChild($this->el('w:b'));
        }

        $rPr->appendChild($this->el('w:color', ['w:val' => $this->hex('drop_cap.color')]));
        $rPr->appendChild($this->el('w:position', ['w:val' => '-'.(int) round($lineTwips / 10)]));
        $rPr->appendChild($this->el('w:sz', ['w:val' => (string) (int) round($lineTwips * $lines / 10 * 0.9)]));
        $run->appendChild($rPr);
        $t = $this->el('w:t');
        $t->textContent = $letter;
        $run->appendChild($t);
        $frame->appendChild($run);

        $p->parentNode?->insertBefore($frame, $p);
        $this->setChild($this->pPr($p), 'w:ind', ['w:firstLine' => '0']);
    }

    /** Gambar yang lebih lebar dari batas template diperkecil (rasio tetap). */
    private function scaleImages(): void
    {
        $limit = (int) round($this->textWidthMm() * 36000 * (float) $this->cfg('figures.max_width_percent') / 100);

        foreach (iterator_to_array($this->xp->query('//w:drawing/*[local-name()="inline" or local-name()="anchor"]')) as $holder) {
            $extent = $this->xp->query('./wp:extent', $holder)->item(0);

            if (! $extent instanceof DOMElement) {
                continue;
            }

            $cx = (int) $extent->getAttribute('cx');
            $cy = (int) $extent->getAttribute('cy');

            if ($cx <= $limit || $cx <= 0) {
                continue;
            }

            $factor = $limit / $cx;
            $extent->setAttribute('cx', (string) $limit);
            $extent->setAttribute('cy', (string) (int) round($cy * $factor));

            foreach (iterator_to_array($this->xp->query('.//a:xfrm/a:ext', $holder)) as $ext) {
                /** @var DOMElement $ext */
                $ext->setAttribute('cx', (string) (int) round((int) $ext->getAttribute('cx') * $factor));
                $ext->setAttribute('cy', (string) (int) round((int) $ext->getAttribute('cy') * $factor));
            }
        }
    }

    // =====================================================================
    // Halaman yang dibuat otomatis
    // =====================================================================

    /** @return list<DOMElement> */
    private function titlePage(): array
    {
        $font = (string) $this->cfg('front_matter.title_page.font');
        $align = (string) $this->cfg('front_matter.title_page.align');
        $title = mb_strtoupper($this->data['title']);
        $nodes = [];

        $top = (float) $this->cfg('front_matter.title_page.top_offset_mm');

        $nodes[] = $this->paragraph([['text' => $title, 'bold' => true, 'size' => $this->cfg('front_matter.title_page.title_size_pt'), 'font' => $font]], [
            'jc' => $align, 'before' => $this->twips($top), 'after' => 480,
        ]);

        $authorSize = $this->cfg('front_matter.title_page.author_size_pt');
        $nodes[] = $this->paragraph([['text' => 'Penulis', 'bold' => true, 'size' => $authorSize, 'font' => $font]], ['jc' => $align, 'after' => 60]);

        foreach ($this->data['authors'] as $author) {
            $nodes[] = $this->paragraph([['text' => $author, 'bold' => true, 'size' => $authorSize, 'font' => $font]], ['jc' => $align, 'after' => 60]);
        }

        if (! empty($this->data['editor'])) {
            $nodes[] = $this->paragraph([['text' => 'Editor', 'bold' => true, 'size' => $authorSize, 'font' => $font]], ['jc' => $align, 'before' => 360, 'after' => 60]);
            $nodes[] = $this->paragraph([['text' => (string) $this->data['editor'], 'bold' => true, 'size' => max(8, (float) $authorSize - 2), 'font' => $font]], ['jc' => $align]);
        }

        if ($this->cfg('front_matter.title_page.show_publisher')) {
            $nodes[] = $this->paragraph([['text' => (string) $this->cfg('front_matter.title_page.publisher_text'), 'bold' => true, 'size' => max((float) $authorSize, 18), 'font' => $font]], [
                'jc' => $align, 'before' => 2400,
            ]);
        }

        return $nodes;
    }

    /** @return list<DOMElement> */
    private function versoPage(): array
    {
        $text = strtr((string) $this->cfg('front_matter.title_verso.text'), [
            '{judul}' => $this->data['title'],
            '{penulis}' => implode(', ', $this->data['authors']),
            '{editor}' => (string) ($this->data['editor'] ?? '-'),
            '{isbn}' => (string) ($this->data['isbn'] ?? '-'),
            '{bulan_tahun}' => (string) ($this->data['month_year'] ?? ''),
        ]);

        $size = $this->cfg('front_matter.title_verso.size_pt');
        $align = (string) $this->cfg('front_matter.title_verso.align');
        $vertical = (string) $this->cfg('front_matter.title_verso.vertical');
        $nodes = [];

        $lines = preg_split('/\R/u', $text) ?: [];
        $usable = $this->pageHeightMm() - (float) $this->cfg('margins.top_mm') - (float) $this->cfg('margins.bottom_mm');
        $lineMm = (float) $size * 1.3 * 0.3528;
        $free = max(0, $usable - count($lines) * $lineMm - 10);
        $before = match ($vertical) {
            'center' => $free / 2,
            'bottom' => $free,
            default => 0,
        };

        foreach ($lines as $index => $line) {
            $nodes[] = $this->paragraph([['text' => $line, 'size' => $size]], [
                'jc' => $align, 'after' => 0, 'before' => $index === 0 ? $this->twips($before) : 0, 'line' => 276,
            ]);
        }

        return $nodes;
    }

    /** Daftar isi / gambar / tabel sebagai field Word (diperbarui saat dibuka di Word). */
    private function fieldList(string $key): array
    {
        $heading = (string) $this->cfg("front_matter.$key.heading");
        $titleNode = $this->paragraph([['text' => $heading]], ['style' => 'TPJudulBagian', 'jc' => (string) $this->cfg("front_matter.$key.heading_align")]);

        if ($key === 'toc') {
            $depth = (int) $this->cfg('front_matter.toc.depth');
            $levels = 0;

            for ($level = 1; $level <= $depth; $level++) {
                if ($this->cfg("heading.h$level.in_toc")) {
                    $levels = $level;
                }
            }

            $instruction = sprintf(' TOC \\o "1-%d" \\h \\z \\u ', max(1, $levels));
        } else {
            // Field TC di tiap caption (tidak tergantung bahasa/setelan Word).
            $instruction = sprintf(' TOC \\f %s \\h \\z ', $key === 'list_of_figures' ? 'g' : 't');
        }

        $field = $this->el('w:p');
        $pPr = $this->el('w:pPr');
        $pPr->appendChild($this->el('w:pStyle', ['w:val' => 'TOC1']));
        $field->appendChild($pPr);

        foreach ([['begin'], ['instr', $instruction], ['separate'], ['text', 'Klik kanan lalu pilih "Update Field" untuk memperbarui daftar ini.'], ['end']] as $part) {
            $run = $this->el('w:r');

            if ($part[0] === 'instr') {
                $instr = $this->el('w:instrText', ['xml:space' => 'preserve']);
                $instr->textContent = $part[1];
                $run->appendChild($instr);
            } elseif ($part[0] === 'text') {
                $t = $this->el('w:t');
                $t->textContent = $part[1];
                $run->appendChild($t);
            } else {
                $run->appendChild($this->el('w:fldChar', ['w:fldCharType' => $part[0], ...($part[0] === 'begin' ? ['w:dirty' => 'true'] : [])]));
            }

            $field->appendChild($run);
        }

        return [$titleNode, $field];
    }

    /**
     * Biografi penulis: nama, foto, bio. Lebih dari satu penulis → tiap
     * penulis di halaman sendiri (kecuali template mematikan "each_author").
     *
     * @return list<DOMElement>
     */
    private function authorBioNodes(): array
    {
        $bios = array_values(array_filter(
            $this->data['author_bio'] ?? [],
            fn ($bio) => trim((string) ($bio['bio'] ?? '')) !== '' || ! empty($bio['photo'])
        ));

        if ($bios === []) {
            return [];
        }

        $nodes = [$this->paragraph([['text' => (string) $this->cfg('back_matter.author_bio.heading')]], [
            'style' => 'TPJudulBagian', 'jc' => (string) $this->cfg('back_matter.author_bio.heading_align'),
        ])];

        $perPage = (bool) $this->cfg('back_matter.author_bio.each_author');
        $position = (string) $this->cfg('back_matter.author_bio.photo_position');
        $size = (float) $this->cfg('back_matter.author_bio.size_pt');
        $align = (string) $this->cfg('back_matter.author_bio.alignment');
        $photoMm = (float) $this->cfg('back_matter.author_bio.photo_width_mm');

        foreach ($bios as $index => $bio) {
            $newPage = $index > 0 && $perPage;
            $photo = $this->cfg('back_matter.author_bio.show_photo') && ! empty($bio['photo'])
                ? $this->photoRun((string) $bio['photo'], $photoMm, $bio['name'])
                : null;

            $name = $this->paragraph([['text' => $bio['name'], 'bold' => true, 'size' => $size + 1]], [
                'jc' => $photo !== null && $position !== 'top' ? 'left' : 'center',
                'before' => $index > 0 && ! $newPage ? 360 : 120, 'after' => 120, 'keep_next' => true,
            ]);
            $text = array_map(
                fn (string $line) => $this->paragraph([['text' => $line, 'size' => $size]], ['jc' => $align, 'after' => 120]),
                array_values(array_filter(array_map('trim', preg_split('/\R+/', (string) $bio['bio'])), fn ($line) => $line !== ''))
            );

            if ($photo === null || $position === 'top') {
                $block = [];

                if ($photo !== null) {
                    $holder = $this->paragraph([], ['jc' => 'center', 'before' => 120, 'after' => 0, 'keep_next' => true]);
                    $holder->appendChild($photo);
                    $block[] = $holder;
                }

                $block[] = $name;
                array_push($block, ...$text);

                if ($newPage) {
                    $this->setChild($this->pPr($block[0]), 'w:pageBreakBefore', []);
                }

                array_push($nodes, ...$block);

                continue;
            }

            // Foto di kiri/kanan teks: tabel tanpa garis dua kolom.
            if ($newPage) {
                $nodes[] = $this->paragraph([], ['page_break' => true, 'before' => 0, 'after' => 0, 'line' => 20]);
            } elseif ($index > 0) {
                $nodes[] = $this->paragraph([], ['before' => 240, 'after' => 0]);
            }

            $nodes[] = $this->bioTable($photo, [$name, ...$text], $photoMm, $position === 'right');
        }

        return $nodes;
    }

    /** @param  list<DOMElement>  $textNodes */
    private function bioTable(DOMElement $photo, array $textNodes, float $photoMm, bool $photoRight): DOMElement
    {
        $total = $this->twips($this->textWidthMm());
        $photoCol = min($this->twips($photoMm + 5), (int) ($total * 0.6));
        $textCol = $total - $photoCol;

        $table = $this->el('w:tbl');
        $tblPr = $this->el('w:tblPr');
        $tblPr->appendChild($this->el('w:tblW', ['w:w' => (string) $total, 'w:type' => 'dxa']));
        $borders = $this->el('w:tblBorders');

        foreach (['top', 'left', 'bottom', 'right', 'insideH', 'insideV'] as $side) {
            $borders->appendChild($this->el("w:$side", ['w:val' => 'nil']));
        }

        $tblPr->appendChild($borders);
        $tblPr->appendChild($this->el('w:tblLayout', ['w:type' => 'fixed']));
        $margins = $this->el('w:tblCellMar');
        $margins->appendChild($this->el('w:left', ['w:w' => '0', 'w:type' => 'dxa']));
        $margins->appendChild($this->el('w:right', ['w:w' => '0', 'w:type' => 'dxa']));
        $tblPr->appendChild($margins);
        $tblPr->appendChild($this->el('w:tblLook', ['w:val' => '0000', 'w:firstRow' => '0', 'w:lastRow' => '0', 'w:firstColumn' => '0', 'w:lastColumn' => '0', 'w:noHBand' => '1', 'w:noVBand' => '1']));
        $table->appendChild($tblPr);

        $grid = $this->el('w:tblGrid');
        $widths = $photoRight ? [$textCol, $photoCol] : [$photoCol, $textCol];

        foreach ($widths as $width) {
            $grid->appendChild($this->el('w:gridCol', ['w:w' => (string) $width]));
        }

        $table->appendChild($grid);

        $row = $this->el('w:tr');
        $trPr = $this->el('w:trPr');
        $trPr->appendChild($this->el('w:cantSplit'));
        $row->appendChild($trPr);

        $holder = $this->paragraph([], ['jc' => $photoRight ? 'right' : 'left', 'before' => 120, 'after' => 0]);
        $holder->appendChild($photo);

        $cells = $photoRight ? [[$textNodes, $textCol], [[$holder], $photoCol]] : [[[$holder], $photoCol], [$textNodes, $textCol]];

        foreach ($cells as [$content, $width]) {
            $cell = $this->el('w:tc');
            $tcPr = $this->el('w:tcPr');
            $tcPr->appendChild($this->el('w:tcW', ['w:w' => (string) $width, 'w:type' => 'dxa']));
            $cell->appendChild($tcPr);

            foreach ($content as $node) {
                $cell->appendChild($node);
            }

            $row->appendChild($cell);
        }

        $table->appendChild($row);

        return $table;
    }

    /**
     * Foto (JPEG/PNG/GIF) sebagai gambar inline selebar $widthMm; tingginya
     * mengikuti rasio foto, dibatasi setengah tinggi area teks.
     */
    private function photoRun(string $bytes, float $widthMm, string $name): ?DOMElement
    {
        $info = @getimagesizefromstring($bytes);
        $extension = match ($info[2] ?? null) {
            IMAGETYPE_JPEG => 'jpeg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_GIF => 'gif',
            default => null,
        };

        if ($extension === null || $info[0] <= 0 || $info[1] <= 0) {
            return null;
        }

        $cx = (int) round($widthMm * 36000);
        $cy = (int) round($cx * $info[1] / $info[0]);
        $maxCy = (int) round(($this->pageHeightMm() - (float) $this->cfg('page.margin_top') - (float) $this->cfg('page.margin_bottom')) * 36000 / 2);

        if ($cy > $maxCy) {
            $cx = (int) round($cx * $maxCy / $cy);
            $cy = $maxCy;
        }

        $rid = $this->addMedia($bytes, $extension);
        $id = ++$this->drawingId;
        $title = htmlspecialchars('Foto '.$name, ENT_XML1 | ENT_QUOTES);

        $xml = '<w:r xmlns:w="'.self::W.'" xmlns:r="'.self::R.'" xmlns:wp="'.self::WP.'" xmlns:a="'.self::A.'" xmlns:pic="'.self::PIC.'"><w:drawing>'
            .'<wp:inline distT="0" distB="0" distL="0" distR="0">'
            ."<wp:extent cx=\"$cx\" cy=\"$cy\"/><wp:effectExtent l=\"0\" t=\"0\" r=\"0\" b=\"0\"/>"
            ."<wp:docPr id=\"$id\" name=\"$title\"/>"
            .'<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            .'<a:graphic><a:graphicData uri="'.self::PIC.'"><pic:pic>'
            ."<pic:nvPicPr><pic:cNvPr id=\"$id\" name=\"$title\"/><pic:cNvPicPr/></pic:nvPicPr>"
            ."<pic:blipFill><a:blip r:embed=\"$rid\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
            ."<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"$cx\" cy=\"$cy\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr>"
            .'</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';

        $fragment = $this->load($xml);
        $run = $this->doc->importNode($fragment->documentElement, true);

        return $run instanceof DOMElement ? $run : null;
    }

    /** Simpan gambar ke word/media + relasi + tipe konten; mengembalikan rId. */
    private function addMedia(string $bytes, string $extension): string
    {
        $relsPath = 'word/_rels/document.xml.rels';
        $rels = $this->load($this->parts[$relsPath] ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="'.self::PKG_REL.'"/>');
        $types = $this->load((string) ($this->parts['[Content_Types].xml'] ?? ''));

        $ids = [];

        foreach ($rels->documentElement->childNodes as $rel) {
            if ($rel instanceof DOMElement) {
                $ids[] = $rel->getAttribute('Id');
            }
        }

        do {
            $this->relCounter++;
            $rid = 'rIdTp'.$this->relCounter;
        } while (in_array($rid, $ids, true));

        $name = 'media/tp-foto-'.$this->relCounter.'.'.$extension;
        $this->parts['word/'.$name] = $bytes;

        $rel = $rels->createElementNS(self::PKG_REL, 'Relationship');
        $rel->setAttribute('Id', $rid);
        $rel->setAttribute('Type', self::IMAGE_TYPE);
        $rel->setAttribute('Target', $name);
        $rels->documentElement->appendChild($rel);
        $this->parts[$relsPath] = $rels->saveXML();

        $known = false;

        foreach ($types->documentElement->childNodes as $type) {
            if ($type instanceof DOMElement && $type->localName === 'Default' && strtolower($type->getAttribute('Extension')) === $extension) {
                $known = true;
            }
        }

        if (! $known) {
            $default = $types->createElementNS(self::CT, 'Default');
            $default->setAttribute('Extension', $extension);
            $default->setAttribute('ContentType', 'image/'.$extension);
            $types->documentElement->insertBefore($default, $types->documentElement->firstChild);
            $this->parts['[Content_Types].xml'] = $types->saveXML();
        }

        return $rid;
    }

    // =====================================================================
    // Section, header & footer
    // =====================================================================

    /**
     * @param  array<string, mixed>  $section
     * @param  array<string, array<string, string>>  $hf
     */
    private function sectPr(array $section, array $hf, ?int $restart): DOMElement
    {
        $sectPr = $this->el('w:sectPr');
        $set = $hf[$section['set']] ?? [];
        $opening = ! empty($section['opening']);

        foreach (['header', 'footer'] as $kind) {
            foreach (['default', 'even', 'first'] as $type) {
                $rid = $set["$kind:$type"] ?? null;

                if ($rid === null || ($type === 'first' && ! $opening)) {
                    continue;
                }

                $sectPr->appendChild($this->el("w:{$kind}Reference", ['w:type' => $type, 'r:id' => $rid]));
            }
        }

        $sectPr->appendChild($this->el('w:type', ['w:val' => $section['type']]));
        $sectPr->appendChild($this->el('w:pgSz', ['w:w' => (string) $this->twips($this->pageWidthMm()), 'w:h' => (string) $this->twips($this->pageHeightMm())]));

        $gutterPosition = (string) $this->cfg('gutter.position');
        $sectPr->appendChild($this->el('w:pgMar', [
            'w:top' => (string) $this->twips((float) $this->cfg('margins.top_mm')),
            'w:right' => (string) $this->twips((float) $this->cfg('margins.outer_mm')),
            'w:bottom' => (string) $this->twips((float) $this->cfg('margins.bottom_mm')),
            'w:left' => (string) $this->twips((float) $this->cfg('margins.inner_mm')),
            'w:header' => (string) $this->twips((float) $this->cfg('header.distance_mm')),
            'w:footer' => (string) $this->twips((float) $this->cfg('footer.distance_mm')),
            'w:gutter' => (string) ($gutterPosition === 'top' || $gutterPosition === 'inner' || $gutterPosition === 'left' ? $this->twips((float) $this->cfg('gutter.width_mm')) : 0),
        ]));

        $style = match ($section['numbering']) {
            'front' => (string) $this->cfg('pagination.front_style'),
            'back' => (string) $this->cfg('pagination.back_style'),
            default => (string) $this->cfg('pagination.body_style'),
        };
        $pgNum = ['w:fmt' => ['roman_lower' => 'lowerRoman', 'roman_upper' => 'upperRoman', 'none' => 'decimal'][$style] ?? 'decimal'];

        if ($restart !== null) {
            $pgNum['w:start'] = (string) $restart;
        }

        $sectPr->appendChild($this->el('w:pgNumType', $pgNum));

        if ((int) $this->cfg('body.columns') === 2 && $section['numbering'] === 'body') {
            $sectPr->appendChild($this->el('w:cols', ['w:num' => '2', 'w:space' => (string) $this->twips((float) $this->cfg('body.column_gap_mm'))]));
        }

        if ($opening && isset($set['header:first'])) {
            $sectPr->appendChild($this->el('w:titlePg'));
        }

        return $sectPr;
    }

    /**
     * Membuat part header/footer dan relasinya. Set "main" untuk isi (boleh
     * memakai {bab}/{sub_bab}), "plain" untuk bagian awal/penutup.
     *
     * @return array<string, array<string, string>>
     */
    private function buildHeadersFooters(ZipArchive $zip): array
    {
        $relsPath = 'word/_rels/document.xml.rels';
        $rels = $this->load($zip->getFromName($relsPath) ?: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="'.self::PKG_REL.'"/>');
        $types = $this->load((string) $zip->getFromName('[Content_Types].xml'));

        $existingIds = [];

        foreach ($rels->documentElement->childNodes as $rel) {
            if ($rel instanceof DOMElement) {
                $existingIds[] = $rel->getAttribute('Id');
            }
        }

        $needsFirst = ($this->cfg('header.enabled') && $this->cfg('header.hide_on_chapter_opening'))
            || ($this->cfg('footer.enabled') && $this->cfg('footer.hide_on_chapter_opening'))
            || $this->cfg('pagination.hide_on_chapter_opening');
        $even = ($this->cfg('header.enabled') && $this->cfg('header.different_odd_even'))
            || ($this->cfg('footer.enabled') && $this->cfg('footer.different_odd_even'))
            || in_array($this->cfg('pagination.align'), ['outer', 'inner'], true);

        $sets = [];
        $partNo = 0;

        foreach (['main' => false, 'plain' => true] as $set => $plain) {
            foreach (['header', 'footer'] as $kind) {
                $variants = ['default' => 'odd'];

                if ($even) {
                    $variants['even'] = 'even';
                }

                if ($needsFirst && $set === 'main') {
                    $variants['first'] = 'first';
                }

                foreach ($variants as $type => $variant) {
                    $partNo++;
                    $name = "tp-$kind-$partNo.xml";

                    do {
                        $this->relCounter++;
                        $rid = 'rIdTp'.$this->relCounter;
                    } while (in_array($rid, $existingIds, true));

                    $this->parts['word/'.$name] = $this->headerFooterXml($kind, $variant, $plain);

                    $rel = $rels->createElementNS(self::PKG_REL, 'Relationship');
                    $rel->setAttribute('Id', $rid);
                    $rel->setAttribute('Type', $kind === 'header' ? self::HEADER_TYPE : self::FOOTER_TYPE);
                    $rel->setAttribute('Target', $name);
                    $rels->documentElement->appendChild($rel);

                    $override = $types->createElementNS(self::CT, 'Override');
                    $override->setAttribute('PartName', '/word/'.$name);
                    $override->setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.'.$kind.'+xml');
                    $types->documentElement->appendChild($override);

                    $sets[$set]["$kind:$type"] = $rid;
                }
            }
        }

        $this->parts[$relsPath] = $rels->saveXML();
        $this->parts['[Content_Types].xml'] = $types->saveXML();

        return $sets;
    }

    private function headerFooterXml(string $kind, string $variant, bool $plain): string
    {
        $cfgKind = $kind;
        $enabled = (bool) $this->cfg("$kind.enabled");
        $zones = ['left' => '', 'center' => '', 'right' => ''];

        if ($enabled && ! ($variant === 'first' && $this->cfg("$kind.hide_on_chapter_opening"))) {
            $set = $variant === 'even' && $this->cfg("$kind.different_odd_even") ? 'even' : 'odd';

            foreach (array_keys($zones) as $zone) {
                $zones[$zone] = (string) $this->cfg("$kind.{$set}_$zone");
            }
        }

        // Nomor halaman ditambahkan sendiri bila teks header/footer tidak memuat {nomor}.
        $texts = implode('', array_map(fn ($zone) => (string) $this->cfg("$kind.odd_$zone").(string) $this->cfg("$kind.even_$zone"), array_keys($zones)));
        $wantsNumber = $this->cfg('pagination.position') === $kind
            && ! ($enabled && str_contains($texts, '{nomor}'))
            && ! ($variant === 'first' && $this->cfg('pagination.hide_on_chapter_opening'));

        if ($wantsNumber) {
            $align = (string) $this->cfg('pagination.align');
            $zone = match ($align) {
                'outer' => $variant === 'even' ? 'left' : 'right',
                'inner' => $variant === 'even' ? 'right' : 'left',
                'left' => 'left',
                'right' => 'right',
                default => 'center',
            };
            $format = (string) $this->cfg('pagination.format');
            $zones[$zone] = trim($zones[$zone].' '.(str_contains($format, '{n}') ? str_replace('{n}', '{nomor}', $format) : '{nomor}'));
        }

        $font = (string) $this->cfg($enabled ? "$cfgKind.font" : 'pagination.font');
        $size = (float) $this->cfg($enabled ? "$cfgKind.size_pt" : 'pagination.size_pt');
        $color = $enabled ? $this->hex("$cfgKind.color") : $this->hex('typography.body.color');
        $italic = $enabled && $this->cfg("$cfgKind.italic");

        $width = $this->twips($this->textWidthMm());
        $runs = '';
        $first = true;

        foreach (['left', 'center', 'right'] as $zone) {
            if (! $first) {
                $runs .= '<w:r><w:tab/></w:r>';
            }

            $first = false;
            $runs .= $this->tokenRuns($zones[$zone], $plain, $font, $size, $color, $italic);
        }

        $border = $enabled && $this->cfg("$cfgKind.line") && $zones !== ['left' => '', 'center' => '', 'right' => '']
            ? sprintf('<w:pBdr><w:%s w:val="single" w:sz="4" w:space="1" w:color="888888"/></w:pBdr>', $kind === 'header' ? 'bottom' : 'top')
            : '';

        $tag = $kind === 'header' ? 'w:hdr' : 'w:ftr';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .sprintf('<%s xmlns:w="%s" xmlns:r="%s">', $tag, self::W, self::R)
            .'<w:p><w:pPr>'.$border
            .sprintf('<w:tabs><w:tab w:val="center" w:pos="%d"/><w:tab w:val="right" w:pos="%d"/></w:tabs>', intdiv($width, 2), $width)
            .'<w:spacing w:before="0" w:after="0"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr>'
            .$runs.'</w:p>'
            .sprintf('</%s>', $tag);
    }

    /** Teks dengan penanda {judul} {penulis} {bab} {sub_bab} {nomor} -> run Word (field untuk nomor & bab). */
    private function tokenRuns(string $text, bool $plain, string $font, float $size, string $color, bool $italic): string
    {
        if ($text === '') {
            return '';
        }

        $rPr = sprintf(
            '<w:rPr><w:rFonts w:ascii="%1$s" w:hAnsi="%1$s" w:cs="%1$s"/>%2$s<w:color w:val="%3$s"/><w:sz w:val="%4$d"/><w:szCs w:val="%4$d"/></w:rPr>',
            htmlspecialchars($font, ENT_XML1),
            $italic ? '<w:i/>' : '',
            $color,
            (int) round($size * 2)
        );

        $authors = $this->data['authors'];
        $authorText = count($authors) > 2 ? $authors[0].', '.$authors[1].', dkk.' : implode(' & ', $authors);

        $out = '';

        foreach (preg_split('/(\{judul\}|\{penulis\}|\{bab\}|\{sub_bab\}|\{nomor\})/', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [] as $piece) {
            $out .= match ($piece) {
                '{judul}' => $this->textRun($this->data['title'], $rPr),
                '{penulis}' => $this->textRun($authorText, $rPr),
                '{nomor}' => $this->fieldRuns(' PAGE ', '1', $rPr),
                '{bab}' => $plain ? '' : $this->fieldRuns(' STYLEREF "heading 1" ', 'Bab', $rPr),
                '{sub_bab}' => $plain ? '' : $this->fieldRuns(' STYLEREF "heading 2" ', 'Sub bab', $rPr),
                default => $this->textRun($piece, $rPr),
            };
        }

        return $out;
    }

    private function textRun(string $text, string $rPr): string
    {
        return '<w:r>'.$rPr.'<w:t xml:space="preserve">'.htmlspecialchars($text, ENT_XML1).'</w:t></w:r>';
    }

    private function fieldRuns(string $instruction, string $placeholder, string $rPr): string
    {
        return '<w:r>'.$rPr.'<w:fldChar w:fldCharType="begin"/></w:r>'
            .'<w:r>'.$rPr.'<w:instrText xml:space="preserve">'.htmlspecialchars($instruction, ENT_XML1).'</w:instrText></w:r>'
            .'<w:r>'.$rPr.'<w:fldChar w:fldCharType="separate"/></w:r>'
            .$this->textRun($placeholder, $rPr)
            .'<w:r>'.$rPr.'<w:fldChar w:fldCharType="end"/></w:r>';
    }

    // =====================================================================
    // Gaya (styles.xml) & pengaturan (settings.xml)
    // =====================================================================

    private function readStyles(string $xml): void
    {
        if ($xml === '') {
            return;
        }

        $styles = $this->load($xml);
        $xp = $this->xpath($styles);

        foreach ($xp->query('/w:styles/w:style') as $style) {
            /** @var DOMElement $style */
            $id = $style->getAttributeNS(self::W, 'styleId');
            $name = $xp->query('./w:name/@w:val', $style)->item(0)?->nodeValue ?? $id;
            $this->styleNames[$id] = strtolower(trim($name));
            $outline = $xp->query('./w:pPr/w:outlineLvl/@w:val', $style)->item(0)?->nodeValue;

            if ($outline !== null && (int) $outline < 3) {
                $this->styleOutline[$id] = (int) $outline + 1;
            }

            $numId = $xp->query('./w:pPr/w:numPr/w:numId/@w:val', $style)->item(0)?->nodeValue;

            if ($numId !== null && $numId !== '0') {
                $this->styleNumbering[$id] = [
                    'numId' => $numId,
                    'ilvl' => $xp->query('./w:pPr/w:numPr/w:ilvl/@w:val', $style)->item(0)?->nodeValue ?? '0',
                ];
            }
        }
    }

    private function buildStyles(string $xml): string
    {
        if ($xml === '') {
            $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="'.self::W.'"/>';
        }

        $styles = $this->load($xml);
        $xp = $this->xpath($styles);
        $root = $styles->documentElement;

        $generated = $this->generatedStyles();
        $ids = array_keys($generated);

        foreach (iterator_to_array($xp->query('/w:styles/w:docDefaults | /w:styles/w:style')) as $node) {
            /** @var DOMElement $node */
            $id = $node->getAttributeNS(self::W, 'styleId');

            if ($node->localName === 'docDefaults' || in_array($id, $ids, true) || isset($this->styleRenames[$id])) {
                $root->removeChild($node);
            }
        }

        $this->renameStyleReferences($styles);

        $fragment = $styles->createDocumentFragment();
        $fragment->appendXML($this->docDefaultsXml().implode('', $generated));
        $root->insertBefore($fragment, $root->firstChild);

        return $styles->saveXML();
    }

    /**
     * Gaya paragraf penulis yang namanya sama dengan gaya template tetapi
     * id-nya lain → id gaya template.
     *
     * @return array<string, string>
     */
    private function styleRenames(string $xml): array
    {
        if ($xml === '') {
            return [];
        }

        $byName = [];

        foreach ($this->generatedStyles() as $id => $styleXml) {
            if (preg_match('/<w:name w:val="([^"]+)"/', $styleXml, $m)) {
                $byName[strtolower($m[1])] = $id;
            }
        }

        $styles = $this->load($xml);
        $xp = $this->xpath($styles);
        $renames = [];

        foreach ($xp->query('/w:styles/w:style[@w:type="paragraph"]') as $style) {
            /** @var DOMElement $style */
            $id = $style->getAttributeNS(self::W, 'styleId');
            $name = strtolower(trim((string) $xp->query('./w:name/@w:val', $style)->item(0)?->nodeValue));
            $target = $byName[$name] ?? null;

            if ($target !== null && $target !== $id) {
                $renames[$id] = $target;
            }
        }

        return $renames;
    }

    private function renameStyleReferences(DOMDocument $doc): void
    {
        if ($this->styleRenames === []) {
            return;
        }

        $xp = $this->xpath($doc);

        foreach ($xp->query('//w:pStyle/@w:val | //w:basedOn/@w:val | //w:next/@w:val | //w:link/@w:val') as $attribute) {
            if (isset($this->styleRenames[$attribute->nodeValue])) {
                $attribute->nodeValue = $this->styleRenames[$attribute->nodeValue];
            }
        }
    }

    private function docDefaultsXml(): string
    {
        $font = $this->xmlAttr((string) $this->cfg('typography.body.font'));
        $size = (int) round((float) $this->cfg('typography.body.size_pt') * 2);

        return sprintf(
            '<w:docDefaults xmlns:w="%s"><w:rPrDefault><w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%2$s" w:eastAsia="%2$s" w:cs="%2$s"/><w:color w:val="%s"/><w:sz w:val="%d"/><w:szCs w:val="%4$d"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault>'
            .'<w:pPrDefault><w:pPr><w:spacing w:before="%d" w:after="%d" w:line="%d" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>',
            self::W,
            $font,
            $this->hex('typography.body.color'),
            $size,
            $this->ptTwips('paragraph.space_before_pt'),
            $this->ptTwips('paragraph.space_after_pt'),
            $this->lineAuto((float) $this->cfg('paragraph.line_spacing'))
        );
    }

    /** @return array<string, string> styleId => XML gaya */
    private function generatedStyles(): array
    {
        $w = 'xmlns:w="'.self::W.'"';
        $styles = [];

        $styles['Normal'] = sprintf(
            '<w:style %s w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>%s<w:spacing w:before="%d" w:after="%d" w:line="%d" w:lineRule="auto"/><w:ind w:firstLine="%d"/><w:jc w:val="%s"/></w:pPr><w:rPr>%s</w:rPr></w:style>',
            $w,
            $this->cfg('paragraph.widow_orphan') ? '<w:widowControl/>' : '<w:widowControl w:val="0"/>',
            $this->ptTwips('paragraph.space_before_pt'),
            $this->ptTwips('paragraph.space_after_pt'),
            $this->lineAuto((float) $this->cfg('paragraph.line_spacing')),
            $this->twips((float) $this->cfg('paragraph.first_line_indent_mm')),
            $this->jc((string) $this->cfg('paragraph.alignment')),
            $this->rPrXml((string) $this->cfg('typography.body.font'), (float) $this->cfg('typography.body.size_pt'), false, false, false, $this->hex('typography.body.color'))
        );

        foreach ([1, 2, 3] as $level) {
            $key = "heading.h$level";
            $styles["Heading$level"] = sprintf(
                '<w:style %s w:type="paragraph" w:styleId="Heading%d"><w:name w:val="heading %2$d"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>%s<w:keepLines/><w:spacing w:before="%d" w:after="%d" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="%s"/><w:outlineLvl w:val="%d"/></w:pPr><w:rPr>%s</w:rPr></w:style>',
                $w,
                $level,
                $this->cfg("$key.keep_with_next") ? '<w:keepNext/>' : '',
                $this->ptTwips("$key.space_before_pt"),
                $this->ptTwips("$key.space_after_pt"),
                $this->jc((string) $this->cfg("$key.align")),
                $level - 1,
                $this->rPrXml((string) $this->cfg("$key.font"), (float) $this->cfg("$key.size_pt"), (bool) $this->cfg("$key.bold"), (bool) $this->cfg("$key.italic"), (bool) $this->cfg("$key.uppercase"), $this->hex("$key.color"))
            );
        }

        // Judul bagian awal/penutup (Kata Pengantar, Daftar Pustaka, ...) ikut gaya bab.
        $styles['TPJudulBagian'] = sprintf(
            '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="TPJudulBagian"><w:name w:val="TP Judul Bagian"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="%d" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr>%s</w:rPr></w:style>',
            $w,
            $this->ptTwips('heading.h1.space_after_pt'),
            $this->rPrXml((string) $this->cfg('heading.h1.font'), (float) $this->cfg('heading.h1.size_pt'), (bool) $this->cfg('heading.h1.bold'), false, true, $this->hex('heading.h1.color'))
        );

        // Book Chapter: "Daftar Pustaka" dll. di dalam bab (rupa sub-bab, tanpa nomor).
        $styles['TPJudulSubBagian'] = sprintf(
            '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="TPJudulSubBagian"><w:name w:val="TP Judul Sub Bagian"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="%d" w:after="%d" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="%s"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr>%s</w:rPr></w:style>',
            $w,
            $this->ptTwips('heading.h2.space_before_pt'),
            $this->ptTwips('heading.h2.space_after_pt'),
            $this->jc((string) $this->cfg('heading.h2.align')),
            $this->rPrXml((string) $this->cfg('heading.h2.font'), (float) $this->cfg('heading.h2.size_pt'), (bool) $this->cfg('heading.h2.bold'), (bool) $this->cfg('heading.h2.italic'), (bool) $this->cfg('heading.h2.uppercase'), $this->hex('heading.h2.color'))
        );

        // Book Chapter: nama penulis di bawah judul bab.
        $styles['TPPenulisBab'] = sprintf(
            '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="TPPenulisBab"><w:name w:val="TP Penulis Bab"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="%d" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="%s"/></w:pPr><w:rPr>%s</w:rPr></w:style>',
            $w,
            $this->ptTwips('heading.h1.space_after_pt'),
            $this->jc((string) $this->cfg('heading.h1.align')),
            $this->rPrXml((string) $this->cfg('typography.body.font'), (float) $this->cfg('typography.body.size_pt'), false, true, false, $this->hex('typography.body.color'))
        );

        foreach (['figures' => ['TPKeteranganGambar', 'TP Keterangan Gambar'], 'tables' => ['TPKeteranganTabel', 'TP Keterangan Tabel']] as $kind => [$id, $name]) {
            $space = $this->twips((float) $this->cfg("$kind.caption.space_mm"));
            $above = $this->cfg("$kind.caption.position") === 'above';
            $styles[$id] = sprintf(
                '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="%s"><w:name w:val="%s"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>%s<w:spacing w:before="%d" w:after="%d" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="%s"/></w:pPr><w:rPr>%s</w:rPr></w:style>',
                $w,
                $id,
                $name,
                $above ? '<w:keepNext/>' : '',
                $above ? $this->ptTwips("$kind.space_before_pt") : $space,
                $above ? $space : $this->ptTwips("$kind.space_after_pt"),
                $this->jc((string) $this->cfg("$kind.caption.align")),
                $this->rPrXml((string) $this->cfg("$kind.caption.font"), (float) $this->cfg("$kind.caption.size_pt"), false, false, false, $this->hex("$kind.caption.color"))
            );
        }

        $styles['TPGambar'] = sprintf(
            '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="TPGambar"><w:name w:val="TP Gambar"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="%d" w:after="%d" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="%s"/></w:pPr></w:style>',
            $w,
            $this->ptTwips('figures.space_before_pt'),
            $this->cfg('figures.caption.position') === 'below' ? 0 : $this->ptTwips('figures.space_after_pt'),
            $this->jc((string) $this->cfg('figures.align'))
        );

        $styles['TPIsiTabel'] = sprintf(
            '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="TPIsiTabel"><w:name w:val="TP Isi Tabel"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="%d"/><w:szCs w:val="%2$d"/></w:rPr></w:style>',
            $w,
            (int) round((float) $this->cfg('tables.font_size_pt') * 2)
        );

        $hang = $this->twips((float) $this->cfg('back_matter.bibliography.hanging_indent_mm'));
        $styles['TPPustaka'] = sprintf(
            '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="TPPustaka"><w:name w:val="TP Daftar Pustaka"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="%d" w:line="%d" w:lineRule="auto"/><w:ind w:left="%d" w:hanging="%3$d" w:firstLine="0"/><w:jc w:val="%s"/></w:pPr><w:rPr><w:sz w:val="%d"/><w:szCs w:val="%5$d"/></w:rPr></w:style>',
            $w,
            $this->ptTwips('back_matter.bibliography.entry_space_pt'),
            $this->lineAuto((float) $this->cfg('back_matter.bibliography.line_spacing')),
            $hang,
            $this->jc((string) $this->cfg('back_matter.bibliography.alignment')),
            (int) round((float) $this->cfg('back_matter.bibliography.size_pt') * 2)
        );

        $tocWidth = $this->twips($this->textWidthMm());
        $leader = $this->cfg('front_matter.toc.dot_leader') ? 'dot' : 'none';

        foreach ([1, 2, 3] as $level) {
            $styles["TOC$level"] = sprintf(
                '<w:style %s w:type="paragraph" w:styleId="TOC%d"><w:name w:val="toc %2$d"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="%s" w:pos="%d"/></w:tabs><w:spacing w:before="0" w:after="60" w:line="%d" w:lineRule="auto"/><w:ind w:left="%d" w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr>%s<w:sz w:val="%d"/><w:szCs w:val="%8$d"/></w:rPr></w:style>',
                $w,
                $level,
                $leader,
                $tocWidth,
                $this->lineAuto((float) $this->cfg('front_matter.toc.line_spacing')),
                $this->twips((float) $this->cfg('front_matter.toc.indent_mm') * ($level - 1)),
                $level === 1 && $this->cfg('front_matter.toc.bold_chapters') ? '<w:b/>' : '',
                (int) round((float) $this->cfg('front_matter.toc.size_pt') * 2)
            );
        }

        $styles['FootnoteText'] = sprintf(
            '<w:style %s w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="%d"/><w:szCs w:val="%2$d"/></w:rPr></w:style>',
            $w,
            (int) round((float) $this->cfg('body.footnote.size_pt') * 2)
        );

        $styles['TPTabel'] = $this->tableStyleXml();

        return $styles;
    }

    private function tableStyleXml(): string
    {
        $border = (string) $this->cfg('tables.border_style');
        $line = fn (string $side) => sprintf('<w:%s w:val="single" w:sz="6" w:space="0" w:color="000000"/>', $side);
        $none = fn (string $side) => sprintf('<w:%s w:val="nil"/>', $side);

        $sides = match ($border) {
            'grid' => ['top' => 1, 'left' => 1, 'bottom' => 1, 'right' => 1, 'insideH' => 1, 'insideV' => 1],
            'horizontal' => ['top' => 1, 'left' => 0, 'bottom' => 1, 'right' => 0, 'insideH' => 1, 'insideV' => 0],
            'three_line' => ['top' => 1, 'left' => 0, 'bottom' => 1, 'right' => 0, 'insideH' => 0, 'insideV' => 0],
            default => ['top' => 0, 'left' => 0, 'bottom' => 0, 'right' => 0, 'insideH' => 0, 'insideV' => 0],
        };

        $borders = '';

        foreach ($sides as $side => $on) {
            $borders .= $on ? $line($side) : $none($side);
        }

        $padding = $this->ptTwips('tables.cell_padding_pt');
        $headerFill = ltrim((string) $this->cfg('tables.header_background'), '#');
        $firstRowBorder = $border === 'three_line' ? '<w:tcBorders>'.$line('bottom').'</w:tcBorders>' : '';

        return sprintf(
            '<w:style xmlns:w="%s" w:type="table" w:customStyle="1" w:styleId="TPTabel"><w:name w:val="TP Tabel"/><w:basedOn w:val="TableNormal"/>'
            .'<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr>'
            .'<w:rPr><w:sz w:val="%d"/><w:szCs w:val="%2$d"/></w:rPr>'
            .'<w:tblPr><w:tblStyleRowBandSize w:val="1"/><w:tblBorders>%s</w:tblBorders><w:tblCellMar><w:top w:w="%d" w:type="dxa"/><w:left w:w="%4$d" w:type="dxa"/><w:bottom w:w="%4$d" w:type="dxa"/><w:right w:w="%4$d" w:type="dxa"/></w:tblCellMar></w:tblPr>'
            .'<w:tblStylePr w:type="firstRow">%s<w:tcPr>%s%s</w:tcPr></w:tblStylePr>'
            .'%s</w:style>',
            self::W,
            (int) round((float) $this->cfg('tables.font_size_pt') * 2),
            $borders,
            $padding,
            $this->cfg('tables.header_bold') ? '<w:rPr><w:b/></w:rPr>' : '',
            $firstRowBorder,
            strtolower($headerFill) !== 'ffffff' ? sprintf('<w:shd w:val="clear" w:color="auto" w:fill="%s"/>', $headerFill) : '',
            $this->cfg('tables.zebra') ? '<w:tblStylePr w:type="band2Horz"><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="EEF1F6"/></w:tcPr></w:tblStylePr>' : ''
        );
    }

    private function buildSettings(?string $xml, ZipArchive $zip): string
    {
        if ($xml === null) {
            $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="'.self::W.'"/>';
            $this->registerSettingsPart($zip);
        }

        $settings = $this->load($xml);
        $xp = $this->xpath($settings);
        $root = $settings->documentElement;

        foreach (iterator_to_array($xp->query('/w:settings/w:mirrorMargins | /w:settings/w:evenAndOddHeaders | /w:settings/w:updateFields | /w:settings/w:gutterAtTop')) as $node) {
            $root->removeChild($node);
        }

        $even = ($this->cfg('header.enabled') && $this->cfg('header.different_odd_even'))
            || ($this->cfg('footer.enabled') && $this->cfg('footer.different_odd_even'))
            || in_array($this->cfg('pagination.align'), ['outer', 'inner'], true);

        if ($this->cfg('margins.mirror')) {
            $this->insertSetting($settings, 'mirrorMargins');
        }

        if ($this->cfg('gutter.position') === 'top') {
            $this->insertSetting($settings, 'gutterAtTop');
        }

        if ($even) {
            $this->insertSetting($settings, 'evenAndOddHeaders');
        }

        $this->insertSetting($settings, 'updateFields', 'true');

        return $settings->saveXML();
    }

    /** Urutan anak w:settings menurut skema OOXML (Word menolak urutan yang salah). */
    private const SETTINGS_ORDER = [
        'writeProtection', 'view', 'zoom', 'removePersonalInformation', 'removeDateAndTime', 'doNotDisplayPageBoundaries',
        'displayBackgroundShape', 'printPostScriptOverText', 'printFractionalCharacterWidth', 'printFormsData', 'embedTrueTypeFonts',
        'embedSystemFonts', 'saveSubsetFonts', 'saveFormsData', 'mirrorMargins', 'alignBordersAndEdges', 'bordersDoNotSurroundHeader',
        'bordersDoNotSurroundFooter', 'gutterAtTop', 'hideSpellingErrors', 'hideGrammaticalErrors', 'activeWritingStyle', 'proofState',
        'formsDesign', 'attachedTemplate', 'linkStyles', 'stylePaneFormatFilter', 'stylePaneSortMethod', 'documentType', 'mailMerge',
        'revisionView', 'trackRevisions', 'doNotTrackMoves', 'doNotTrackFormatting', 'documentProtection', 'autoFormatOverride',
        'styleLockTheme', 'styleLockQFSet', 'defaultTabStop', 'autoHyphenation', 'consecutiveHyphenLimit', 'hyphenationZone',
        'doNotHyphenateCaps', 'showEnvelope', 'summaryLength', 'clickAndTypeStyle', 'defaultTableStyle', 'evenAndOddHeaders',
        'bookFoldRevPrinting', 'bookFoldPrinting', 'bookFoldPrintingSheets', 'drawingGridHorizontalSpacing', 'drawingGridVerticalSpacing',
        'displayHorizontalDrawingGridEvery', 'displayVerticalDrawingGridEvery', 'doNotUseMarginsForDrawingGridOrigin',
        'drawingGridHorizontalOrigin', 'drawingGridVerticalOrigin', 'doNotShadeFormData', 'noPunctuationKerning',
        'characterSpacingControl', 'printTwoOnOne', 'strictFirstAndLastChars', 'noLineBreaksAfter', 'noLineBreaksBefore',
        'savePreviewPicture', 'doNotValidateAgainstSchema', 'saveInvalidXml', 'ignoreMixedContent', 'alwaysShowPlaceholderText',
        'doNotDemarcateInvalidXml', 'saveXmlDataOnly', 'useXSLTWhenSaving', 'saveThroughXslt', 'showXMLTags',
        'alwaysMergeEmptyNamespace', 'updateFields', 'hdrShapeDefaults', 'footnotePr', 'endnotePr', 'compat', 'docVars', 'rsids',
    ];

    private function insertSetting(DOMDocument $settings, string $name, ?string $value = null): void
    {
        $root = $settings->documentElement;
        $node = $settings->createElementNS(self::W, 'w:'.$name);

        if ($value !== null) {
            $node->setAttributeNS(self::W, 'w:val', $value);
        }

        $position = array_search($name, self::SETTINGS_ORDER, true);

        foreach ($root->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            $index = array_search($child->localName, self::SETTINGS_ORDER, true);

            // Elemen di luar daftar (ekstensi w14/w15, mathPr, ...) berada di akhir.
            if ($index === false || $index > $position) {
                $root->insertBefore($node, $child);

                return;
            }
        }

        $root->appendChild($node);
    }

    private function registerSettingsPart(ZipArchive $zip): void
    {
        $types = $this->load($this->parts['[Content_Types].xml'] ?? (string) $zip->getFromName('[Content_Types].xml'));
        $override = $types->createElementNS(self::CT, 'Override');
        $override->setAttribute('PartName', '/word/settings.xml');
        $override->setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml');
        $types->documentElement->appendChild($override);
        $this->parts['[Content_Types].xml'] = $types->saveXML();

        $rels = $this->load($this->parts['word/_rels/document.xml.rels']);
        $rel = $rels->createElementNS(self::PKG_REL, 'Relationship');
        $rel->setAttribute('Id', 'rIdTpSettings');
        $rel->setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings');
        $rel->setAttribute('Target', 'settings.xml');
        $rels->documentElement->appendChild($rel);
        $this->parts['word/_rels/document.xml.rels'] = $rels->saveXML();
    }

    // =====================================================================
    // Pembantu XML
    // =====================================================================

    private function load(string $xml): DOMDocument
    {
        return DocxPackage::loadXml($xml);
    }

    private function xpath(DOMDocument $doc): DOMXPath
    {
        $xp = new DOMXPath($doc);
        $xp->registerNamespace('w', self::W);
        $xp->registerNamespace('r', self::R);
        $xp->registerNamespace('wp', self::WP);
        $xp->registerNamespace('a', self::A);

        return $xp;
    }

    /** @param  array<string, string>  $attributes */
    private function el(string $name, array $attributes = []): DOMElement
    {
        $node = $this->doc->createElementNS(self::W, $name);

        foreach ($attributes as $attribute => $value) {
            if ($attribute === 'xml:space') {
                $node->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', $value);
            } elseif (str_starts_with($attribute, 'r:')) {
                $node->setAttributeNS(self::R, $attribute, $value);
            } else {
                $node->setAttributeNS(self::W, $attribute, $value);
            }
        }

        return $node;
    }

    private function text(DOMNode $node): string
    {
        $out = '';

        foreach ($this->xp->query('.//w:t | .//w:tab | .//w:br', $node) as $piece) {
            $out .= $piece->localName === 't' ? $piece->textContent : ' ';
        }

        return $out;
    }

    private function pPr(DOMElement $p): DOMElement
    {
        $pPr = $this->xp->query('./w:pPr', $p)->item(0);

        if (! $pPr instanceof DOMElement) {
            $pPr = $this->el('w:pPr');
            $p->insertBefore($pPr, $p->firstChild);
        }

        return $pPr;
    }

    /** @param  list<string>  $names */
    private function pPrRemove(DOMElement $p, array $names): void
    {
        $pPr = $this->xp->query('./w:pPr', $p)->item(0);

        if (! $pPr instanceof DOMElement) {
            return;
        }

        foreach ($names as $name) {
            foreach (iterator_to_array($this->xp->query('./'.$name, $pPr)) as $node) {
                $pPr->removeChild($node);
            }
        }
    }

    /** Urutan anak pPr / tblPr / trPr menurut skema OOXML. */
    private const CHILD_ORDER = [
        'pPr' => [
            'pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers',
            'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE',
            'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents',
            'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle',
            'rPr', 'sectPr', 'pPrChange',
        ],
        'tblPr' => [
            'tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual', 'tblStyleRowBandSize', 'tblStyleColBandSize', 'tblW', 'jc',
            'tblCellSpacing', 'tblInd', 'tblBorders', 'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription',
        ],
        'trPr' => [
            'cnfStyle', 'divId', 'gridBefore', 'gridAfter', 'wBefore', 'wAfter', 'cantSplit', 'trHeight', 'tblHeader',
            'tblCellSpacing', 'jc', 'hidden', 'ins', 'del', 'trPrChange',
        ],
    ];

    /** Pasang (ganti) elemen anak di pPr/tblPr/trPr, di posisi yang sesuai skema. */
    private function setChild(DOMElement $parent, string $name, array $attributes): void
    {
        foreach (iterator_to_array($this->xp->query('./'.$name, $parent)) as $old) {
            $parent->removeChild($old);
        }

        $this->insertOrdered($parent, $this->el($name, $attributes));
    }

    private function insertOrdered(DOMElement $parent, DOMElement $node): void
    {
        $order = self::CHILD_ORDER[$parent->localName] ?? null;

        if ($order === null) {
            $parent->appendChild($node);

            return;
        }

        $position = array_search($node->localName, $order, true);

        foreach ($parent->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            $index = array_search($child->localName, $order, true);

            if ($index !== false && $position !== false && $index > $position) {
                $parent->insertBefore($node, $child);

                return;
            }
        }

        $parent->appendChild($node);
    }

    /**
     * Heading yang nomornya otomatis dari gaya Word penulis (mis. "1.1" dari
     * daftar bertingkat) tetap bernomor setelah gayanya diganti template.
     */
    private function inheritStyleNumbering(DOMElement $p): void
    {
        if ($this->xp->query('./w:pPr/w:numPr', $p)->length > 0) {
            return;
        }

        $styleId = $this->xp->query('./w:pPr/w:pStyle/@w:val', $p)->item(0)?->nodeValue ?? '';
        $numbering = $this->styleNumbering[$styleId] ?? null;

        if ($numbering === null) {
            return;
        }

        $numPr = $this->el('w:numPr');
        $numPr->appendChild($this->el('w:ilvl', ['w:val' => $numbering['ilvl']]));
        $numPr->appendChild($this->el('w:numId', ['w:val' => $numbering['numId']]));
        $this->insertOrdered($this->pPr($p), $numPr);
    }

    private function setStyle(DOMElement $p, ?string $styleId): void
    {
        $pPr = $this->pPr($p);

        foreach (iterator_to_array($this->xp->query('./w:pStyle', $pPr)) as $old) {
            $pPr->removeChild($old);
        }

        if ($styleId !== null) {
            $pPr->insertBefore($this->el('w:pStyle', ['w:val' => $styleId]), $pPr->firstChild);
        }
    }

    private function stripParagraph(DOMElement $p, bool $keepNumbering): void
    {
        $hasNumbering = $this->xp->query('./w:pPr/w:numPr', $p)->length > 0;
        $remove = ['w:spacing', 'w:jc', 'w:keepNext', 'w:keepLines', 'w:widowControl', 'w:outlineLvl', 'w:rPr', 'w:shd', 'w:pBdr', 'w:framePr', 'w:textAlignment', 'w:tabs'];

        if (! ($keepNumbering && $hasNumbering)) {
            $remove[] = 'w:ind';
        }

        if (! $keepNumbering) {
            $remove[] = 'w:numPr';
        }

        $this->pPrRemove($p, $remove);
    }

    private function stripRuns(DOMElement $p, bool $heading): void
    {
        $names = ['w:rFonts', 'w:sz', 'w:szCs', 'w:color', 'w:kern', 'w:spacing', 'w:w', 'w:position', 'w:lang'];

        if ($heading) {
            array_push($names, 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps', 'w:u', 'w:highlight', 'w:shd');
        }

        foreach (iterator_to_array($this->xp->query('.//w:r/w:rPr', $p)) as $rPr) {
            /** @var DOMElement $rPr */
            foreach ($names as $name) {
                foreach (iterator_to_array($this->xp->query('./'.$name, $rPr)) as $node) {
                    $rPr->removeChild($node);
                }
            }
        }

        foreach (iterator_to_array($this->xp->query('.//w:r/w:rPr/w:rStyle', $p)) as $style) {
            $value = strtolower($style->getAttributeNS(self::W, 'val'));

            // Gaya karakter bawaan heading ikut terhapus; hyperlink dll. tetap.
            if ($heading || str_contains($value, 'heading') || str_contains($value, 'judul')) {
                $style->parentNode?->removeChild($style);
            }
        }
    }

    private function isMonospace(DOMElement $p): bool
    {
        $runs = $this->xp->query('.//w:r[w:t]', $p);

        if ($runs->length === 0) {
            return false;
        }

        foreach ($runs as $run) {
            $font = strtolower($this->xp->query('./w:rPr/w:rFonts/@w:ascii', $run)->item(0)?->nodeValue ?? '');

            if (! in_array($font, self::MONO_FONTS, true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Ganti semua run di paragraf dengan run baru (format paragraf tetap).
     *
     * @param  list<array{text?: string, bold?: bool, italic?: bool, break?: bool}>  $runs
     */
    private function replaceRuns(DOMElement $p, array $runs): void
    {
        foreach (iterator_to_array($p->childNodes) as $child) {
            if ($child instanceof DOMElement && $child->localName !== 'pPr') {
                $p->removeChild($child);
            }
        }

        foreach ($runs as $spec) {
            $run = $this->el('w:r');

            if (! empty($spec['bold']) || ! empty($spec['italic'])) {
                $rPr = $this->el('w:rPr');

                if (! empty($spec['bold'])) {
                    $rPr->appendChild($this->el('w:b'));
                }

                if (! empty($spec['italic'])) {
                    $rPr->appendChild($this->el('w:i'));
                }

                $run->appendChild($rPr);
            }

            if (! empty($spec['break'])) {
                $run->appendChild($this->el('w:br'));
            } else {
                $t = $this->el('w:t', ['xml:space' => 'preserve']);
                $t->textContent = (string) ($spec['text'] ?? '');
                $run->appendChild($t);
            }

            $p->appendChild($run);
        }
    }

    private function replaceHeadingText(DOMElement $p, string $text): void
    {
        if (trim($text) !== '') {
            $this->replaceRuns($p, [['text' => $text]]);
        }
    }

    private function alignNode(DOMElement $p, string $align): void
    {
        $this->setChild($this->pPr($p), 'w:jc', ['w:val' => $this->jc($align)]);
    }

    private function pageBreakParagraph(): DOMElement
    {
        $p = $this->el('w:p');
        $r = $this->el('w:r');
        $r->appendChild($this->el('w:br', ['w:type' => 'page']));
        $p->appendChild($r);

        return $p;
    }

    /**
     * Paragraf baru dengan format langsung.
     *
     * @param  list<array{text: string, bold?: bool, italic?: bool, size?: mixed, font?: string}>  $runs
     * @param  array{jc?: string, before?: int, after?: int, line?: int, style?: string, keep_next?: bool, page_break?: bool}  $format
     */
    private function paragraph(array $runs, array $format = []): DOMElement
    {
        $p = $this->el('w:p');
        $pPr = $this->el('w:pPr');

        if (isset($format['style'])) {
            $pPr->appendChild($this->el('w:pStyle', ['w:val' => $format['style']]));
        }

        if (! empty($format['keep_next'])) {
            $pPr->appendChild($this->el('w:keepNext'));
        }

        if (! empty($format['page_break'])) {
            $pPr->appendChild($this->el('w:pageBreakBefore'));
        }

        if (isset($format['before']) || isset($format['after']) || isset($format['line'])) {
            $spacing = [];

            if (isset($format['before'])) {
                $spacing['w:before'] = (string) (int) $format['before'];
            }

            if (isset($format['after'])) {
                $spacing['w:after'] = (string) (int) $format['after'];
            }

            if (isset($format['line'])) {
                $spacing['w:line'] = (string) (int) $format['line'];
                $spacing['w:lineRule'] = 'auto';
            }

            $pPr->appendChild($this->el('w:spacing', $spacing));
        }

        $pPr->appendChild($this->el('w:ind', ['w:firstLine' => '0']));

        if (isset($format['jc'])) {
            $pPr->appendChild($this->el('w:jc', ['w:val' => $this->jc($format['jc'])]));
        }

        $p->appendChild($pPr);

        foreach ($runs as $spec) {
            $run = $this->el('w:r');
            $rPr = $this->el('w:rPr');

            if (! empty($spec['font'])) {
                $rPr->appendChild($this->el('w:rFonts', ['w:ascii' => $spec['font'], 'w:hAnsi' => $spec['font'], 'w:cs' => $spec['font']]));
            }

            if (! empty($spec['bold'])) {
                $rPr->appendChild($this->el('w:b'));
            }

            if (! empty($spec['italic'])) {
                $rPr->appendChild($this->el('w:i'));
            }

            if (isset($spec['size'])) {
                $half = (string) (int) round((float) $spec['size'] * 2);
                $rPr->appendChild($this->el('w:sz', ['w:val' => $half]));
                $rPr->appendChild($this->el('w:szCs', ['w:val' => $half]));
            }

            if ($rPr->hasChildNodes()) {
                $run->appendChild($rPr);
            }

            $t = $this->el('w:t', ['xml:space' => 'preserve']);
            $t->textContent = $spec['text'];
            $run->appendChild($t);
            $p->appendChild($run);
        }

        return $p;
    }

    private function rPrXml(string $font, float $size, bool $bold, bool $italic, bool $caps, string $color): string
    {
        $font = $this->xmlAttr($font);
        $half = (int) round($size * 2);

        return sprintf('<w:rFonts w:ascii="%1$s" w:hAnsi="%1$s" w:eastAsia="%1$s" w:cs="%1$s"/>', $font)
            .($bold ? '<w:b/><w:bCs/>' : '')
            .($italic ? '<w:i/><w:iCs/>' : '')
            .($caps ? '<w:caps/>' : '')
            .sprintf('<w:color w:val="%s"/><w:sz w:val="%d"/><w:szCs w:val="%2$d"/>', $color, $half);
    }

    // =====================================================================
    // Konfigurasi & satuan
    // =====================================================================

    /** Naskah gabungan Book Chapter (hasil DocxMerger). */
    private function isCompilation(): bool
    {
        return ! empty($this->data['compilation']);
    }

    private function cfg(string $path): mixed
    {
        $node = $this->config;

        foreach (explode('.', $path) as $key) {
            if (! is_array($node) || ! array_key_exists($key, $node)) {
                return TemplateSchema::fields()[$path]['default'] ?? null;
            }

            $node = $node[$key];
        }

        return $node;
    }

    private function hex(string $path): string
    {
        $value = ltrim((string) $this->cfg($path), '#');

        return preg_match('/^[0-9a-fA-F]{6}$/', $value) ? strtoupper($value) : '000000';
    }

    private function jc(string $align): string
    {
        return match ($align) {
            'justify' => 'both',
            'center' => 'center',
            'right' => 'right',
            default => 'left',
        };
    }

    private function twips(float $mm): int
    {
        return (int) round($mm * 1440 / 25.4);
    }

    private function ptTwips(string $path): int
    {
        return (int) round((float) $this->cfg($path) * 20);
    }

    /** Spasi antarbaris "multiple" Word: 240 = 1 baris. */
    private function lineAuto(float $multiple): int
    {
        return (int) round(max(1, $multiple) * 240);
    }

    private function pageWidthMm(): float
    {
        return (float) $this->cfg('page.width_mm');
    }

    private function pageHeightMm(): float
    {
        return (float) $this->cfg('page.height_mm');
    }

    private function textWidthMm(): float
    {
        $gutter = in_array($this->cfg('gutter.position'), ['inner', 'left'], true) ? (float) $this->cfg('gutter.width_mm') : 0;

        return max(20, $this->pageWidthMm() - (float) $this->cfg('margins.inner_mm') - (float) $this->cfg('margins.outer_mm') - $gutter);
    }

    private function xmlAttr(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES);
    }
}
