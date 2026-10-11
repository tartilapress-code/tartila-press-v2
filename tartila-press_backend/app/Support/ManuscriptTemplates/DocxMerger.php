<?php

namespace App\Support\ManuscriptTemplates;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use RuntimeException;
use ZipArchive;

/**
 * Menggabungkan naskah Word (.docx) tiap bab Book Chapter menjadi satu
 * dokumen buku, berurutan menurut nomor bab.
 *
 * Tiap bab diawali judul "BAB n Judul" (gaya Heading 1, ditandai bookmark
 * `_TPBab{n}`) dan nama penulisnya (bookmark `_TPPenulis{n}`) supaya auto
 * layout mengenali batas bab. Judul/nama yang diketik penulis di awal
 * naskahnya dibuang; heading 1 di dalam bab diturunkan menjadi heading 2;
 * nomor sub-bab dan caption ("1.2", "Gambar 1.3") disesuaikan dengan nomor
 * bab. Gambar, grafik, tautan, daftar bernomor, catatan kaki dan gaya ikut
 * disalin; header/footer, komentar dan bookmark penulis tidak.
 */
final class DocxMerger
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    private const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';

    private const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

    private const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';

    private const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

    private const CAPTION = '/^(gambar|tabel|grafik|diagram|ilustrasi)\s+(\d+)\s*[.\-]\s*\d+/iu';

    private const NUMBERED_HEADING = '/^(\d+)((?:\.\d+)+)\.?\s+\S/u';

    private ZipArchive $zip;

    private DOMDocument $doc;

    private DOMXPath $xp;

    private DOMDocument $rels;

    private DOMDocument $types;

    private DOMDocument $styles;

    private ?DOMDocument $numbering = null;

    /** @var array<string, DOMDocument|null> footnotes|endnotes */
    private array $notes = [];

    /** @var array<string, string> path part baru => isi */
    private array $parts = [];

    private DOMElement $sectPr;

    private string $h1Style = 'Heading1';

    private string $h2Style = 'Heading2';

    private int $relCounter = 0;

    private int $bookmarkId = 990000;

    /**
     * @param  list<array{path: string, number: int, title: string, author: string}>  $chapters  urut menurut nomor bab
     */
    public function merge(array $chapters): string
    {
        if ($chapters === []) {
            throw new RuntimeException('Belum ada naskah bab yang bisa digabung.');
        }

        $work = tempnam(sys_get_temp_dir(), 'tpmerge');

        if ($work === false || ! copy($chapters[0]['path'], $work)) {
            throw new RuntimeException('Naskah bab tidak bisa disalin.');
        }

        $this->zip = new ZipArchive;

        if ($this->zip->open($work) !== true || $this->zip->locateName('word/document.xml') === false) {
            @unlink($work);

            throw new RuntimeException("Naskah BAB {$chapters[0]['number']} bukan dokumen Word (.docx) yang valid.");
        }

        try {
            DocxPackage::assertSafeSize($this->zip, "Naskah BAB {$chapters[0]['number']}");
            $this->prepareBase();

            foreach ($chapters as $index => $chapter) {
                $this->appendChapter($chapter, $index === 0);
            }

            $this->zip->addFromString('word/document.xml', $this->doc->saveXML());
            $this->zip->addFromString('word/styles.xml', $this->styles->saveXML());
            $this->zip->addFromString('word/_rels/document.xml.rels', $this->rels->saveXML());
            $this->zip->addFromString('[Content_Types].xml', $this->types->saveXML());

            if ($this->numbering !== null) {
                $this->zip->addFromString('word/numbering.xml', $this->numbering->saveXML());
            }

            foreach ($this->notes as $kind => $notes) {
                if ($notes !== null) {
                    $this->zip->addFromString("word/$kind.xml", $notes->saveXML());
                }
            }

            foreach ($this->parts as $path => $bytes) {
                $this->zip->addFromString($path, $bytes);
            }

            $this->zip->close();
            $closed = true;
            DocxPackage::sanitizeFile($work);
            $bytes = (string) file_get_contents($work);
        } finally {
            if (! isset($closed)) {
                // Buang perubahan; berkas harus tertutup sebelum dihapus (Windows).
                $this->zip->unchangeAll();
                $this->zip->close();
            }

            @unlink($work);
        }

        return $bytes;
    }

    // =====================================================================
    // Dokumen dasar (berkas bab pertama, isinya dikosongkan)
    // =====================================================================

    private function prepareBase(): void
    {
        $this->doc = $this->load((string) $this->zip->getFromName('word/document.xml'));
        $this->xp = $this->xpath($this->doc);
        $this->rels = $this->load($this->zip->getFromName('word/_rels/document.xml.rels') ?: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="'.self::PKG_REL.'"/>');
        $this->types = $this->load((string) $this->zip->getFromName('[Content_Types].xml'));
        $this->styles = $this->load($this->zip->getFromName('word/styles.xml') ?: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="'.self::W.'"/>');

        if ($this->zip->locateName('word/styles.xml') === false) {
            $this->addRelationship('styles', 'styles.xml');
            $this->addOverride('/word/styles.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml');
        }

        $numbering = $this->zip->getFromName('word/numbering.xml');
        $this->numbering = $numbering ? $this->load($numbering) : null;

        foreach (['footnotes', 'endnotes'] as $kind) {
            $xml = $this->zip->getFromName("word/$kind.xml");
            $this->notes[$kind] = $xml ? $this->load($xml) : null;
        }

        $body = $this->xp->query('/w:document/w:body')->item(0);

        if (! $body instanceof DOMElement) {
            throw new RuntimeException('Dokumen Word tidak punya isi.');
        }

        $sectPr = null;

        foreach (iterator_to_array($body->childNodes) as $child) {
            if ($child instanceof DOMElement && $child->localName === 'sectPr' && $child->namespaceURI === self::W) {
                $sectPr = $child;

                continue;
            }

            $body->removeChild($child);
        }

        if (! $sectPr instanceof DOMElement) {
            $sectPr = $this->doc->createElementNS(self::W, 'w:sectPr');
            $body->appendChild($sectPr);
        }

        // Header/footer penulis bab pertama tidak berlaku untuk seluruh buku.
        foreach (iterator_to_array($this->xp->query('./w:headerReference | ./w:footerReference | ./w:titlePg', $sectPr)) as $node) {
            $sectPr->removeChild($node);
        }

        $this->sectPr = $sectPr;
        $this->h1Style = $this->ensureHeadingStyle(1);
        $this->h2Style = $this->ensureHeadingStyle(2);

        foreach ($this->rels->documentElement->childNodes as $rel) {
            if ($rel instanceof DOMElement && preg_match('/^rIdTpm(\d+)$/', $rel->getAttribute('Id'), $m)) {
                $this->relCounter = max($this->relCounter, (int) $m[1]);
            }
        }
    }

    /** Id gaya "heading n" di dokumen dasar; dibuat kalau belum ada. */
    private function ensureHeadingStyle(int $level): string
    {
        $sxp = $this->xpath($this->styles);

        foreach ($sxp->query('/w:styles/w:style[@w:type="paragraph"]') as $style) {
            /** @var DOMElement $style */
            $name = strtolower((string) $sxp->query('./w:name/@w:val', $style)->item(0)?->nodeValue);

            if ($name === "heading $level") {
                return $style->getAttributeNS(self::W, 'styleId');
            }
        }

        $id = "Heading$level";
        $size = $level === 1 ? 32 : 26;
        $xml = '<w:style xmlns:w="'.self::W.'" w:type="paragraph" w:styleId="'.$id.'"><w:name w:val="heading '.$level.'"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
            .'<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>'.($level === 1 ? '<w:jc w:val="center"/>' : '').'<w:outlineLvl w:val="'.($level - 1).'"/></w:pPr>'
            .'<w:rPr><w:b/><w:sz w:val="'.$size.'"/></w:rPr></w:style>';
        $this->styles->documentElement->appendChild($this->styles->importNode($this->load($xml)->documentElement, true));

        return $id;
    }

    // =====================================================================
    // Satu bab
    // =====================================================================

    /** @param  array{path: string, number: int, title: string, author: string}  $chapter */
    private function appendChapter(array $chapter, bool $isBase): void
    {
        $source = new ZipArchive;

        if ($source->open($chapter['path']) !== true || $source->locateName('word/document.xml') === false) {
            throw new RuntimeException("Naskah BAB {$chapter['number']} bukan dokumen Word (.docx) yang valid.");
        }

        try {
            DocxPackage::assertSafeSize($source, "Naskah BAB {$chapter['number']}");
            $src = new MergeSource($source, $this->load((string) $source->getFromName('word/document.xml')));
            $src->xp = $this->xpath($src->doc);
            $src->styleNames = $this->styleNames($source);

            $body = $src->xp->query('/w:document/w:body')->item(0);
            $nodes = [];

            foreach ($body instanceof DOMElement ? iterator_to_array($body->childNodes) : [] as $child) {
                if ($child instanceof DOMElement && $child->localName !== 'sectPr') {
                    $nodes[] = $child;
                }
            }

            $this->clean($src, $nodes);
            $chapter['title'] = $this->chapterTitle($src, $nodes, $chapter['title']);
            $nodes = $this->dropLeadingTitle($src, $nodes, $chapter);
            $this->demoteHeadings($src, $nodes, $isBase);
            $this->renumber($src, $nodes, $chapter['number']);

            if (! $isBase) {
                $copiedNotes = $this->copyNotes($src, $nodes);
                $copiedStyles = $this->copyStyles($src, [...$nodes, ...$copiedNotes]);
                $this->copyNumbering($src, [...$nodes, ...$copiedNotes], $copiedStyles);
                $this->copyRelationships($src, $nodes, $chapter['number']);
            }

            foreach ($this->chapterOpening($chapter, $isBase) as $paragraph) {
                $this->sectPr->parentNode->insertBefore($paragraph, $this->sectPr);
            }

            foreach ($nodes as $node) {
                $this->sectPr->parentNode->insertBefore($this->doc->importNode($node, true), $this->sectPr);
            }
        } finally {
            $source->close();
        }
    }

    /**
     * Judul bab dari proyek ("Bab 2: Sensor" → "Sensor"). Judul generik
     * ("Bab 2", dari impor CSV) diganti judul yang diketik penulis.
     *
     * @param  list<DOMElement>  $nodes
     */
    private function chapterTitle(MergeSource $src, array $nodes, string $slotTitle): string
    {
        $pattern = '/^bab\s+([0-9]+|[ivxlcdm]+)\s*[:.\-–—]?\s*/iu';
        $title = trim(preg_replace($pattern, '', trim($slotTitle)) ?? '');

        if ($title !== '') {
            return $title;
        }

        $afterBab = false;
        $checked = 0;

        foreach ($nodes as $node) {
            if ($node->localName !== 'p' || $checked >= 4) {
                break;
            }

            $text = trim(preg_replace('/\s+/u', ' ', $this->text($src->xp, $node)) ?? '');

            if ($text === '') {
                continue;
            }

            $checked++;
            $styleName = $src->styleNames[$src->xp->query('./w:pPr/w:pStyle/@w:val', $node)->item(0)?->nodeValue ?? ''] ?? '';

            if (preg_match($pattern, $text)) {
                $rest = trim(preg_replace($pattern, '', $text) ?? '');

                if ($rest !== '') {
                    return $rest;
                }

                $afterBab = true;

                continue;
            }

            if (($afterBab || in_array($styleName, ['title', 'heading 1'], true)) && mb_strlen($text) <= 200) {
                return $text;
            }

            break;
        }

        return '';
    }

    /** Judul bab + nama penulis, ditandai bookmark untuk auto layout. */
    private function chapterOpening(array $chapter, bool $first): array
    {
        $heading = $this->paragraph(
            trim('BAB '.$chapter['number'].' '.trim($chapter['title'])),
            ['style' => $this->h1Style, 'page_break' => ! $first],
            '_TPBab'.$chapter['number']
        );

        if (trim($chapter['author']) === '') {
            return [$heading];
        }

        return [$heading, $this->paragraph(trim($chapter['author']), ['jc' => 'center', 'italic' => true], '_TPPenulis'.$chapter['number'])];
    }

    /** @param  array{style?: string, page_break?: bool, jc?: string, italic?: bool}  $format */
    private function paragraph(string $text, array $format, string $bookmark): DOMElement
    {
        $p = $this->doc->createElementNS(self::W, 'w:p');
        $pPr = $this->doc->createElementNS(self::W, 'w:pPr');

        if (isset($format['style'])) {
            $style = $this->doc->createElementNS(self::W, 'w:pStyle');
            $style->setAttributeNS(self::W, 'w:val', $format['style']);
            $pPr->appendChild($style);
        }

        if (! empty($format['page_break'])) {
            $pPr->appendChild($this->doc->createElementNS(self::W, 'w:pageBreakBefore'));
        }

        if (isset($format['jc'])) {
            $jc = $this->doc->createElementNS(self::W, 'w:jc');
            $jc->setAttributeNS(self::W, 'w:val', $format['jc']);
            $pPr->appendChild($jc);
        }

        $p->appendChild($pPr);

        $id = (string) ++$this->bookmarkId;
        $start = $this->doc->createElementNS(self::W, 'w:bookmarkStart');
        $start->setAttributeNS(self::W, 'w:id', $id);
        $start->setAttributeNS(self::W, 'w:name', $bookmark);
        $p->appendChild($start);

        $run = $this->doc->createElementNS(self::W, 'w:r');

        if (! empty($format['italic'])) {
            $rPr = $this->doc->createElementNS(self::W, 'w:rPr');
            $rPr->appendChild($this->doc->createElementNS(self::W, 'w:i'));
            $run->appendChild($rPr);
        }

        $t = $this->doc->createElementNS(self::W, 'w:t');
        $t->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        $t->textContent = $text;
        $run->appendChild($t);
        $p->appendChild($run);

        $end = $this->doc->createElementNS(self::W, 'w:bookmarkEnd');
        $end->setAttributeNS(self::W, 'w:id', $id);
        $p->appendChild($end);

        return $p;
    }

    /**
     * Buang yang tidak ikut ke buku: section/header penulis, bookmark,
     * komentar, penanda ejaan, altChunk, id paragraf Word 2010.
     *
     * @param  list<DOMElement>  $nodes
     */
    private function clean(MergeSource $src, array $nodes): void
    {
        foreach ($nodes as $node) {
            $query = './/w:pPr/w:sectPr | .//w:bookmarkStart | .//w:bookmarkEnd | .//w:commentRangeStart | .//w:commentRangeEnd'
                .' | .//w:r[w:commentReference] | .//w:proofErr | .//w:altChunk | .//w:permStart | .//w:permEnd';

            foreach (iterator_to_array($src->xp->query($query, $node)) as $junk) {
                $junk->parentNode?->removeChild($junk);
            }

            foreach ([$node, ...iterator_to_array($src->xp->query('.//*', $node))] as $element) {
                /** @var DOMElement $element */
                if ($element->hasAttributeNS(self::W14, 'paraId')) {
                    $element->removeAttributeNS(self::W14, 'paraId');
                }

                if ($element->hasAttributeNS(self::W14, 'textId')) {
                    $element->removeAttributeNS(self::W14, 'textId');
                }
            }
        }
    }

    /**
     * Judul, "BAB n" dan nama penulis yang diketik di awal naskah bab
     * digantikan judul bab dari proyek.
     *
     * @param  list<DOMElement>  $nodes
     * @return list<DOMElement>
     */
    private function dropLeadingTitle(MergeSource $src, array $nodes, array $chapter): array
    {
        $title = $this->normalize($chapter['title']);
        $author = $this->normalize($chapter['author']);
        $removed = 0;

        while ($nodes !== [] && $removed < 4) {
            $node = $nodes[0];

            if ($node->localName !== 'p' || $src->xp->query('.//w:drawing | .//w:pict | .//w:object', $node)->length > 0) {
                break;
            }

            $text = $this->normalize($this->text($src->xp, $node));

            if ($text === '') {
                array_shift($nodes);

                continue;
            }

            $styleName = $src->styleNames[$src->xp->query('./w:pPr/w:pStyle/@w:val', $node)->item(0)?->nodeValue ?? ''] ?? '';
            $outline = $src->xp->query('./w:pPr/w:outlineLvl/@w:val', $node)->item(0)?->nodeValue;
            $isTitle = in_array($styleName, ['title', 'subtitle', 'heading 1'], true)
                || $outline === '0'
                || preg_match('/^bab\s+([0-9]+|[ivxlcdm]+)\b/iu', $text)
                || ($title !== '' && ($text === $title || (str_contains($text, $title) && mb_strlen($text) <= mb_strlen($title) + 20)))
                || ($author !== '' && $text === $author);

            if (! $isTitle || mb_strlen($text) > 200) {
                break;
            }

            array_shift($nodes);
            $removed++;
        }

        return $nodes;
    }

    /**
     * Dalam buku, hanya judul bab yang heading 1; heading 1 di naskah bab
     * menjadi heading 2.
     *
     * @param  list<DOMElement>  $nodes
     */
    private function demoteHeadings(MergeSource $src, array $nodes, bool $isBase): void
    {
        $h2 = $isBase ? $this->h2Style : $this->sourceHeadingStyle($src, 2);

        foreach ($nodes as $node) {
            foreach ($node->localName === 'p' ? [$node] : iterator_to_array($src->xp->query('.//w:p', $node)) as $p) {
                /** @var DOMElement $p */
                $style = $src->xp->query('./w:pPr/w:pStyle', $p)->item(0);
                $name = $style instanceof DOMElement ? ($src->styleNames[$style->getAttributeNS(self::W, 'val')] ?? '') : '';

                if ($style instanceof DOMElement && in_array($name, ['heading 1', 'title'], true)) {
                    $style->setAttributeNS(self::W, 'w:val', $h2);
                }

                foreach (iterator_to_array($src->xp->query('./w:pPr/w:outlineLvl[@w:val="0"]', $p)) as $outline) {
                    /** @var DOMElement $outline */
                    $outline->setAttributeNS(self::W, 'w:val', '1');
                }
            }
        }
    }

    /** Id gaya heading n di naskah bab (dipakai saat isinya disalin). */
    private function sourceHeadingStyle(MergeSource $src, int $level): string
    {
        foreach ($src->styleNames as $id => $name) {
            if ($name === "heading $level") {
                return (string) $id;
            }
        }

        return $level === 1 ? $this->h1Style : $this->h2Style;
    }

    /**
     * Nomor bab di sub-bab dan caption mengikuti nomor bab di buku:
     * "1.2 Sensor" di bab 3 menjadi "3.2 Sensor", "Gambar 1. 4" → "Gambar 3. 4".
     *
     * @param  list<DOMElement>  $nodes
     */
    private function renumber(MergeSource $src, array $nodes, int $number): void
    {
        $candidates = [];
        $counts = [];

        foreach ($nodes as $node) {
            foreach ($node->localName === 'p' ? [$node] : iterator_to_array($src->xp->query('.//w:p', $node)) as $p) {
                /** @var DOMElement $p */
                $text = $this->text($src->xp, $p);
                $trimmed = ltrim($text);

                if (preg_match(self::CAPTION, $trimmed)) {
                    // Nomor caption dari field (SEQ/STYLEREF) dijadikan teks
                    // biasa supaya tidak dihitung ulang Word.
                    $this->flattenFields($src->xp, $p);
                    $text = $this->text($src->xp, $p);
                    $trimmed = ltrim($text);
                }

                if (preg_match(self::CAPTION, $trimmed, $m, PREG_OFFSET_CAPTURE)) {
                    $offset = strlen($text) - strlen($trimmed) + $m[2][1];
                    $candidates[] = [$p, (int) $m[2][0], $offset, strlen($m[2][0])];
                    $counts[(int) $m[2][0]] = ($counts[(int) $m[2][0]] ?? 0) + 1;

                    continue;
                }

                if (mb_strlen($trimmed) <= 160 && ! preg_match('/[.;,]$/u', $trimmed) && preg_match(self::NUMBERED_HEADING, $trimmed, $m, PREG_OFFSET_CAPTURE)) {
                    $offset = strlen($text) - strlen($trimmed);
                    $candidates[] = [$p, (int) $m[1][0], $offset, strlen($m[1][0])];
                    $counts[(int) $m[1][0]] = ($counts[(int) $m[1][0]] ?? 0) + 1;
                }
            }
        }

        if ($counts === []) {
            return;
        }

        arsort($counts);
        $own = (int) array_key_first($counts);

        if ($own === $number) {
            return;
        }

        foreach ($candidates as [$p, $found, $offset, $length]) {
            if ($found === $own) {
                $this->replaceText($src->xp, $p, $offset, $length, (string) $number);
            }
        }
    }

    /** Field di paragraf diganti hasil tampilannya (teks biasa). */
    private function flattenFields(DOMXPath $xp, DOMElement $p): void
    {
        foreach (iterator_to_array($xp->query('.//w:fldSimple', $p)) as $simple) {
            while ($simple->firstChild) {
                $simple->parentNode->insertBefore($simple->firstChild, $simple);
            }

            $simple->parentNode->removeChild($simple);
        }

        $state = 'text';
        $depth = 0;

        foreach (iterator_to_array($xp->query('.//w:r', $p)) as $run) {
            /** @var DOMElement $run */
            $char = $xp->query('./w:fldChar/@w:fldCharType', $run)->item(0)?->nodeValue;

            if ($char === 'begin') {
                $depth++;
                $state = 'instr';
                $run->parentNode->removeChild($run);
            } elseif ($char === 'separate') {
                $state = 'result';
                $run->parentNode->removeChild($run);
            } elseif ($char === 'end') {
                $depth = max(0, $depth - 1);
                $state = $depth > 0 ? 'result' : 'text';
                $run->parentNode->removeChild($run);
            } elseif ($state === 'instr' || $xp->query('./w:instrText', $run)->length > 0) {
                $run->parentNode->removeChild($run);
            }
        }
    }

    /** Ganti $length byte teks paragraf mulai $offset (lintas run). */
    private function replaceText(DOMXPath $xp, DOMElement $p, int $offset, int $length, string $replacement): void
    {
        $position = 0;

        foreach ($xp->query('.//w:t', $p) as $t) {
            $value = $t->textContent;
            $size = strlen($value);
            $start = max($offset, $position);
            $end = min($offset + $length, $position + $size);

            if ($start < $end) {
                $before = substr($value, 0, $start - $position);
                $after = substr($value, $end - $position);
                $t->textContent = $before.$replacement.$after;
                $replacement = '';
            }

            $position += $size;

            if ($position >= $offset + $length) {
                return;
            }
        }
    }

    // =====================================================================
    // Bagian yang ikut disalin dari naskah bab
    // =====================================================================

    /**
     * Catatan kaki/akhir yang dirujuk isi bab (id baru).
     *
     * @param  list<DOMElement>  $nodes
     * @return list<DOMElement> catatan yang disalin (sudah di dokumen tujuan)
     */
    private function copyNotes(MergeSource $src, array $nodes): array
    {
        $copied = [];

        foreach (['footnotes' => 'footnote', 'endnotes' => 'endnote'] as $kind => $tag) {
            $references = [];

            foreach ($nodes as $node) {
                foreach ($src->xp->query(".//w:{$tag}Reference", $node) as $reference) {
                    $references[] = $reference;
                }
            }

            if ($references === []) {
                continue;
            }

            $sourceXml = $src->zip->getFromName("word/$kind.xml");

            if (! $sourceXml) {
                continue;
            }

            $sourceNotes = $this->load($sourceXml);
            $sxp = $this->xpath($sourceNotes);
            $target = $this->notesPart($kind, $tag);
            $next = 1;

            foreach ($this->xpath($target)->query("/w:$kind/w:$tag/@w:id") as $id) {
                $next = max($next, (int) $id->nodeValue + 1);
            }

            $map = [];

            foreach ($references as $reference) {
                /** @var DOMElement $reference */
                $old = $reference->getAttributeNS(self::W, 'id');

                if (! isset($map[$old])) {
                    $note = $sxp->query("/w:$kind/w:{$tag}[@w:id='$old']")->item(0);

                    if (! $note instanceof DOMElement) {
                        continue;
                    }

                    $map[$old] = (string) $next++;
                    $this->cleanNote($sxp, $note);
                    $note->setAttributeNS(self::W, 'w:id', $map[$old]);
                    $imported = $target->importNode($note, true);
                    $target->documentElement->appendChild($imported);
                    $copied[] = $imported;
                }

                $reference->setAttributeNS(self::W, 'w:id', $map[$old]);
            }
        }

        return $copied;
    }

    /** Catatan kaki disalin tanpa tautan/gambar (relasinya milik part lain). */
    private function cleanNote(DOMXPath $xp, DOMElement $note): void
    {
        foreach (iterator_to_array($xp->query('.//w:hyperlink', $note)) as $link) {
            while ($link->firstChild) {
                $link->parentNode->insertBefore($link->firstChild, $link);
            }

            $link->parentNode->removeChild($link);
        }

        foreach (iterator_to_array($xp->query('.//w:drawing | .//w:pict | .//w:object | .//w:bookmarkStart | .//w:bookmarkEnd | .//w:commentRangeStart | .//w:commentRangeEnd | .//w:r[w:commentReference]', $note)) as $junk) {
            $junk->parentNode?->removeChild($junk);
        }
    }

    private function notesPart(string $kind, string $tag): DOMDocument
    {
        if ($this->notes[$kind] !== null) {
            return $this->notes[$kind];
        }

        $separators = sprintf(
            '<w:%1$s w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:%1$s>'
            .'<w:%1$s w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:%1$s>',
            $tag
        );
        $this->notes[$kind] = $this->load('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:'.$kind.' xmlns:w="'.self::W.'" xmlns:r="'.self::R.'">'.$separators.'</w:'.$kind.'>');
        $this->addRelationship($kind, "$kind.xml");
        $this->addOverride("/word/$kind.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.$kind+xml");

        return $this->notes[$kind];
    }

    /**
     * Gaya yang dipakai isi bab tetapi belum ada di dokumen dasar ikut
     * disalin (beserta gaya induknya). Gaya bernama sama memakai milik buku.
     *
     * @param  list<DOMElement>  $nodes
     * @return list<DOMElement> gaya yang disalin (di dokumen tujuan)
     */
    private function copyStyles(MergeSource $src, array $nodes): array
    {
        $xml = $src->zip->getFromName('word/styles.xml');

        if (! $xml) {
            return [];
        }

        $sourceStyles = $this->load($xml);
        $sxp = $this->xpath($sourceStyles);
        $txp = $this->xpath($this->styles);
        $existing = [];

        foreach ($txp->query('/w:styles/w:style/@w:styleId') as $id) {
            $existing[$id->nodeValue] = true;
        }

        $queue = [];

        foreach ($nodes as $node) {
            $xpath = $node->ownerDocument === $src->doc ? $src->xp : $this->xpath($node->ownerDocument);

            foreach ($xpath->query('.//w:pStyle/@w:val | .//w:rStyle/@w:val | .//w:tblStyle/@w:val', $node) as $id) {
                $queue[] = $id->nodeValue;
            }
        }

        $copied = [];

        while ($queue !== []) {
            $id = array_shift($queue);

            if (isset($existing[$id])) {
                continue;
            }

            $existing[$id] = true;
            $style = $sxp->query("/w:styles/w:style[@w:styleId='".str_replace("'", '', $id)."']")->item(0);

            if (! $style instanceof DOMElement) {
                continue;
            }

            foreach ($sxp->query('./w:basedOn/@w:val | ./w:link/@w:val | ./w:next/@w:val', $style) as $related) {
                $queue[] = $related->nodeValue;
            }

            $imported = $this->styles->importNode($style, true);
            $this->styles->documentElement->appendChild($imported);
            $copied[] = $imported;
        }

        return $copied;
    }

    /**
     * Daftar bernomor/berbutir: definisi num + abstractNum disalin dengan id
     * baru supaya tidak bertabrakan dengan daftar bab lain.
     *
     * @param  list<DOMElement>  $nodes
     * @param  list<DOMElement>  $styles
     */
    private function copyNumbering(MergeSource $src, array $nodes, array $styles): void
    {
        $references = [];

        foreach ([...$nodes, ...$styles] as $node) {
            $xpath = $node->ownerDocument === $src->doc ? $src->xp : $this->xpath($node->ownerDocument);

            foreach ($xpath->query('.//w:numPr/w:numId', $node) as $numId) {
                $references[] = $numId;
            }
        }

        if ($references === []) {
            return;
        }

        $xml = $src->zip->getFromName('word/numbering.xml');

        if (! $xml) {
            return;
        }

        $sourceNumbering = $this->load($xml);
        $sxp = $this->xpath($sourceNumbering);

        if ($this->numbering === null) {
            $this->numbering = $this->load('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="'.self::W.'"/>');
            $this->addRelationship('numbering', 'numbering.xml');
            $this->addOverride('/word/numbering.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml');
        }

        $txp = $this->xpath($this->numbering);
        $nextNum = 1;
        $nextAbstract = 0;

        foreach ($txp->query('/w:numbering/w:num/@w:numId') as $id) {
            $nextNum = max($nextNum, (int) $id->nodeValue + 1);
        }

        foreach ($txp->query('/w:numbering/w:abstractNum/@w:abstractNumId') as $id) {
            $nextAbstract = max($nextAbstract, (int) $id->nodeValue + 1);
        }

        $numMap = ['0' => '0'];
        $abstractMap = [];
        $root = $this->numbering->documentElement;

        foreach ($references as $reference) {
            /** @var DOMElement $reference */
            $old = $reference->getAttributeNS(self::W, 'val');

            if (! isset($numMap[$old])) {
                $num = $sxp->query("/w:numbering/w:num[@w:numId='".str_replace("'", '', $old)."']")->item(0);

                if (! $num instanceof DOMElement) {
                    continue;
                }

                $oldAbstract = (string) $sxp->query('./w:abstractNumId/@w:val', $num)->item(0)?->nodeValue;

                if (! isset($abstractMap[$oldAbstract])) {
                    $abstract = $sxp->query("/w:numbering/w:abstractNum[@w:abstractNumId='$oldAbstract']")->item(0);

                    if ($abstract instanceof DOMElement) {
                        $abstractMap[$oldAbstract] = (string) $nextAbstract++;
                        $copy = $this->numbering->importNode($abstract, true);
                        $copy->setAttributeNS(self::W, 'w:abstractNumId', $abstractMap[$oldAbstract]);

                        // nsid sama membuat Word menyatukan daftar dari bab berbeda.
                        foreach (iterator_to_array($this->xpath($this->numbering)->query('./w:nsid', $copy)) as $nsid) {
                            $copy->removeChild($nsid);
                        }

                        $firstNum = $this->xpath($this->numbering)->query('/w:numbering/w:num')->item(0);
                        $root->insertBefore($copy, $firstNum);
                    }
                }

                $numMap[$old] = (string) $nextNum++;
                $copy = $this->numbering->importNode($num, true);
                $copy->setAttributeNS(self::W, 'w:numId', $numMap[$old]);

                foreach ($this->xpath($this->numbering)->query('./w:abstractNumId', $copy) as $abstractId) {
                    /** @var DOMElement $abstractId */
                    $abstractId->setAttributeNS(self::W, 'w:val', $abstractMap[$oldAbstract] ?? $oldAbstract);
                }

                $cleanup = $this->xpath($this->numbering)->query('/w:numbering/w:numIdMacAtCleanup')->item(0);
                $root->insertBefore($copy, $cleanup);
            }

            $reference->setAttributeNS(self::W, 'w:val', $numMap[$old]);
        }
    }

    /**
     * Relasi yang dirujuk isi bab (gambar, grafik, tautan, objek): part
     * tujuannya disalin dengan nama baru lalu id relasi diganti.
     *
     * @param  list<DOMElement>  $nodes
     */
    private function copyRelationships(MergeSource $src, array $nodes, int $number): void
    {
        $sourceRels = [];
        $relsXml = $src->zip->getFromName('word/_rels/document.xml.rels');

        if ($relsXml) {
            foreach ($this->load($relsXml)->documentElement->childNodes as $rel) {
                if ($rel instanceof DOMElement) {
                    $sourceRels[$rel->getAttribute('Id')] = $rel;
                }
            }
        }

        $sourceTypes = $this->load((string) $src->zip->getFromName('[Content_Types].xml'));
        $map = [];
        $copiedParts = [];

        foreach ($nodes as $node) {
            foreach ([$node, ...iterator_to_array($src->xp->query('.//*', $node))] as $element) {
                /** @var DOMElement $element */
                foreach (iterator_to_array($element->attributes) as $attribute) {
                    if ($attribute->namespaceURI !== self::R) {
                        continue;
                    }

                    $old = $attribute->value;

                    if (! isset($map[$old])) {
                        $rel = $sourceRels[$old] ?? null;

                        if (! $rel instanceof DOMElement) {
                            continue;
                        }

                        if ($rel->getAttribute('TargetMode') === 'External') {
                            $map[$old] = $this->addRelationship(null, $rel->getAttribute('Target'), $rel->getAttribute('Type'), true);
                        } else {
                            $part = $this->resolve('word', $rel->getAttribute('Target'));
                            $copy = $this->copyPart($src->zip, $sourceTypes, $part, $number, $copiedParts);

                            if ($copy === null) {
                                continue;
                            }

                            $map[$old] = $this->addRelationship(null, $this->relative('word', $copy), $rel->getAttribute('Type'));
                        }
                    }

                    $element->setAttributeNS(self::R, $attribute->nodeName, $map[$old]);
                }
            }
        }
    }

    /**
     * Salin satu part (dan part yang dirujuknya) ke dokumen buku.
     *
     * @param  array<string, string>  $copied  path lama => path baru
     */
    private function copyPart(ZipArchive $source, DOMDocument $sourceTypes, string $path, int $number, array &$copied): ?string
    {
        if (isset($copied[$path])) {
            return $copied[$path];
        }

        $bytes = $source->getFromName($path);

        if ($bytes === false) {
            return null;
        }

        $directory = dirname($path);
        $base = basename($path);
        $target = "$directory/tpb$number-$base";
        $suffix = 1;

        while ($this->zip->locateName($target) !== false || isset($this->parts[$target])) {
            $target = "$directory/tpb$number-".$suffix++."-$base";
        }

        $copied[$path] = $target;
        $this->parts[$target] = $bytes;

        // Tipe konten: override part ini, atau default menurut ekstensinya.
        $override = null;

        foreach ($sourceTypes->documentElement->childNodes as $type) {
            if ($type instanceof DOMElement && $type->localName === 'Override' && ltrim($type->getAttribute('PartName'), '/') === $path) {
                $override = $type->getAttribute('ContentType');
            }
        }

        if ($override !== null) {
            $this->addOverride('/'.$target, $override);
        } else {
            $this->ensureDefault($sourceTypes, strtolower(pathinfo($path, PATHINFO_EXTENSION)));
        }

        // Relasi milik part ini (mis. grafik → data Excel).
        $relsPath = "$directory/_rels/$base.rels";
        $relsXml = $source->getFromName($relsPath);

        if ($relsXml) {
            $rels = $this->load($relsXml);

            foreach ($rels->documentElement->childNodes as $rel) {
                if (! $rel instanceof DOMElement || $rel->getAttribute('TargetMode') === 'External') {
                    continue;
                }

                $child = $this->copyPart($source, $sourceTypes, $this->resolve($directory, $rel->getAttribute('Target')), $number, $copied);

                if ($child !== null) {
                    $rel->setAttribute('Target', $this->relative($directory, $child));
                }
            }

            $this->parts["$directory/_rels/".basename($target).'.rels'] = $rels->saveXML();
        }

        return $target;
    }

    private function ensureDefault(DOMDocument $sourceTypes, string $extension): void
    {
        if ($extension === '') {
            return;
        }

        foreach ($this->types->documentElement->childNodes as $type) {
            if ($type instanceof DOMElement && $type->localName === 'Default' && strtolower($type->getAttribute('Extension')) === $extension) {
                return;
            }
        }

        $contentType = null;

        foreach ($sourceTypes->documentElement->childNodes as $type) {
            if ($type instanceof DOMElement && $type->localName === 'Default' && strtolower($type->getAttribute('Extension')) === $extension) {
                $contentType = $type->getAttribute('ContentType');
            }
        }

        $contentType ??= match ($extension) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'emf' => 'image/x-emf',
            'wmf' => 'image/x-wmf',
            'svg' => 'image/svg+xml',
            'bmp' => 'image/bmp',
            'tif', 'tiff' => 'image/tiff',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'bin' => 'application/vnd.openxmlformats-officedocument.oleObject',
            default => 'application/octet-stream',
        };

        $default = $this->types->createElementNS(self::CT, 'Default');
        $default->setAttribute('Extension', $extension);
        $default->setAttribute('ContentType', $contentType);
        $this->types->documentElement->insertBefore($default, $this->types->documentElement->firstChild);
    }

    // =====================================================================
    // Paket
    // =====================================================================

    /** Tambah relasi dokumen; $kind = jenis standar (styles, numbering, ...) atau $type lengkap. */
    private function addRelationship(?string $kind, string $target, ?string $type = null, bool $external = false): string
    {
        $ids = [];

        foreach ($this->rels->documentElement->childNodes as $rel) {
            if ($rel instanceof DOMElement) {
                $ids[$rel->getAttribute('Id')] = true;
            }
        }

        do {
            $id = 'rIdTpm'.++$this->relCounter;
        } while (isset($ids[$id]));

        $rel = $this->rels->createElementNS(self::PKG_REL, 'Relationship');
        $rel->setAttribute('Id', $id);
        $rel->setAttribute('Type', $type ?? self::REL_BASE.$kind);
        $rel->setAttribute('Target', $target);

        if ($external) {
            $rel->setAttribute('TargetMode', 'External');
        }

        $this->rels->documentElement->appendChild($rel);

        return $id;
    }

    private function addOverride(string $partName, string $contentType): void
    {
        foreach ($this->types->documentElement->childNodes as $type) {
            if ($type instanceof DOMElement && $type->localName === 'Override' && $type->getAttribute('PartName') === $partName) {
                return;
            }
        }

        $override = $this->types->createElementNS(self::CT, 'Override');
        $override->setAttribute('PartName', $partName);
        $override->setAttribute('ContentType', $contentType);
        $this->types->documentElement->appendChild($override);
    }

    /** Path part dari target relasi yang relatif terhadap $directory. */
    private function resolve(string $directory, string $target): string
    {
        $path = str_starts_with($target, '/') ? ltrim($target, '/') : $directory.'/'.$target;
        $parts = [];

        foreach (explode('/', $path) as $segment) {
            if ($segment === '..') {
                array_pop($parts);
            } elseif ($segment !== '.' && $segment !== '') {
                $parts[] = $segment;
            }
        }

        return implode('/', $parts);
    }

    /** Target relasi relatif dari $directory ke $path. */
    private function relative(string $directory, string $path): string
    {
        $from = explode('/', trim($directory, '/'));
        $to = explode('/', $path);

        while ($from !== [] && $to !== [] && $from[0] === $to[0]) {
            array_shift($from);
            array_shift($to);
        }

        return str_repeat('../', count($from)).implode('/', $to);
    }

    /** @return array<string, string> styleId => nama gaya (huruf kecil) */
    private function styleNames(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('word/styles.xml');

        if (! $xml) {
            return [];
        }

        $styles = $this->load($xml);
        $xp = $this->xpath($styles);
        $names = [];

        foreach ($xp->query('/w:styles/w:style') as $style) {
            /** @var DOMElement $style */
            $names[$style->getAttributeNS(self::W, 'styleId')] = strtolower((string) $xp->query('./w:name/@w:val', $style)->item(0)?->nodeValue);
        }

        return $names;
    }

    private function text(DOMXPath $xp, DOMNode $node): string
    {
        $out = '';

        foreach ($xp->query('.//w:t', $node) as $t) {
            $out .= $t->textContent;
        }

        return $out;
    }

    private function normalize(string $text): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $text) ?? ''));
    }

    private function load(string $xml): DOMDocument
    {
        return DocxPackage::loadXml($xml);
    }

    private function xpath(DOMDocument $doc): DOMXPath
    {
        $xp = new DOMXPath($doc);
        $xp->registerNamespace('w', self::W);
        $xp->registerNamespace('r', self::R);

        return $xp;
    }
}
