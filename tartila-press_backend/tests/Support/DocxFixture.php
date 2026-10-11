<?php

namespace Tests\Support;

use Illuminate\Http\UploadedFile;
use ZipArchive;

/**
 * Naskah Word (.docx) kecil seperti yang diunggah penulis: format langsung
 * campur aduk (Arial 12, spasi bebas), judul bab berupa teks biasa maupun
 * gaya Heading 1, daftar isi ketik manual, tabel, gambar, caption, daftar
 * pustaka, lampiran berisi kode.
 */
final class DocxFixture
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /** PNG 1x1 untuk gambar. */
    public const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    /**
     * Naskah satu bab Book Chapter seperti diunggah penulis: diawali judul
     * "BAB 1 ..." dan nama penulis yang diketik sendiri, sub-bab dan caption
     * bernomor 1.x, daftar bernomor, catatan kaki, tautan, gambar, tabel,
     * daftar pustaka di akhir bab.
     */
    public static function chapter(string $path, string $title, string $author, string $marker): void
    {
        $p = fn (string $text, string $pPr = '', string $runs = '') => '<w:p><w:pPr>'.$pPr.'</w:pPr><w:r><w:t xml:space="preserve">'.htmlspecialchars($text).'</w:t></w:r>'.$runs.'</w:p>';
        $bold = '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>';

        $drawing = '<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="1800000" cy="900000"/><wp:docPr id="7" name="Gambar"/>'
            .'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            .'<pic:nvPicPr><pic:cNvPr id="7" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            .'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1800000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

        $body = implode('', [
            '<w:p><w:pPr><w:pStyle w:val="Judul1"/></w:pPr>'.sprintf($bold, 'BAB 1 '.htmlspecialchars(mb_strtoupper($title))).'</w:p>',
            $p($author, '<w:jc w:val="center"/>'),
            '<w:p><w:pPr><w:pStyle w:val="Judul2"/></w:pPr><w:r><w:t>1.1 Pendahuluan</w:t></w:r></w:p>',
            $p("Isi bab $marker dengan catatan kaki.", '', '<w:r><w:rPr><w:rStyle w:val="RefCatatan"/></w:rPr><w:footnoteReference w:id="1"/></w:r>'),
            '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Butir daftar '.$marker.'</w:t></w:r></w:p>',
            '<w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>Tautan '.$marker.'</w:t></w:r></w:hyperlink></w:p>',
            $drawing,
            '<w:p><w:r><w:t xml:space="preserve">Gambar </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> STYLEREF 1 \s </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t xml:space="preserve">.1 Diagram '.$marker.'</w:t></w:r></w:p>',
            '<w:p><w:pPr><w:pStyle w:val="Judul2"/></w:pPr><w:r><w:t>1.2 Pembahasan</w:t></w:r></w:p>',
            $p('Tabel 1.1 Data '.$marker),
            '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc>'.$p('Sel '.$marker).'</w:tc></w:tr></w:tbl>',
            '<w:p><w:pPr><w:pStyle w:val="Judul1"/></w:pPr><w:r><w:t>Penutup Bab</w:t></w:r></w:p>',
            $p("Kesimpulan bab $marker."),
            $p('DAFTAR PUSTAKA'),
            $p("[1] Referensi $marker, 2024."),
            '<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>',
        ]);

        $w = 'xmlns:w="'.self::W.'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
        $document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '.$w.'><w:body>'.$body.'</w:body></w:document>';

        $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles '.$w.'>'
            .'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
            .'<w:style w:type="paragraph" w:styleId="Judul1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>'
            .'<w:style w:type="paragraph" w:styleId="Judul2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>'
            .'<w:style w:type="character" w:styleId="RefCatatan"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>'
            .'</w:styles>';

        $numbering = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering '.$w.'>'
            .'<w:abstractNum w:abstractNumId="0"><w:nsid w:val="1A2B3C4D"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>'
            .'<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

        $footnotes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes '.$w.'>'
            .'<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>'
            .'<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
            .'<w:footnote w:id="1"><w:p><w:r><w:t>Catatan kaki '.$marker.'</w:t></w:r></w:p></w:footnote></w:footnotes>';

        $header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr '.$w.'><w:p><w:r><w:t>Header penulis '.$marker.'</w:t></w:r></w:p></w:hdr>';

        $types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
            .'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            .'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            .'<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
            .'<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>'
            .'<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
            .'</Types>';

        $rel = fn (string $id, string $type, string $target, string $extra = '') => '<Relationship Id="'.$id.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'.$type.'" Target="'.$target.'"'.$extra.'/>';
        $docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .$rel('rId1', 'styles', 'styles.xml').$rel('rId2', 'numbering', 'numbering.xml').$rel('rId3', 'footnotes', 'footnotes.xml')
            .$rel('rIdHdr', 'header', 'header1.xml').$rel('rIdImg', 'image', 'media/image1.png')
            .$rel('rIdLink', 'hyperlink', 'https://contoh.id/'.$marker, ' TargetMode="External"')
            .'</Relationships>';

        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', $types);
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        $zip->addFromString('word/document.xml', $document);
        $zip->addFromString('word/styles.xml', $styles);
        $zip->addFromString('word/numbering.xml', $numbering);
        $zip->addFromString('word/footnotes.xml', $footnotes);
        $zip->addFromString('word/header1.xml', $header);
        $zip->addFromString('word/_rels/document.xml.rels', $docRels);
        $zip->addFromString('word/media/image1.png', base64_decode(self::PNG));
        $zip->close();
    }

    /** Unggahan .docx asli (berkas sementara) untuk tes endpoint upload. */
    public static function upload(string $name = 'naskah.docx'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'unggah').'.docx';
        self::chapter($path, 'Judul Bab', 'Penulis', 'U');

        return new UploadedFile($path, $name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);
    }

    public static function make(string $path): void
    {
        $p = fn (string $text, string $extra = '', string $rPr = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/>') => '<w:p><w:pPr>'.$extra.'<w:spacing w:after="400" w:line="480" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr>'.$rPr.'</w:rPr><w:t xml:space="preserve">'.htmlspecialchars($text).'</w:t></w:r></w:p>';
        $bold = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="28"/>';
        $lorem = 'Embedded system hadir di hampir setiap aspek kehidupan modern, dari peralatan rumah tangga hingga kendaraan dan perangkat medis yang bekerja tanpa henti.';

        $table = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="double" w:sz="12"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>'
            .'<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="FF0000"/></w:tcPr>'.$p('Karakteristik', '', $bold).'</w:tc><w:tc>'.$p('Contoh').'</w:tc></w:tr>'
            .'<w:tr><w:tc>'.$p('Dedicated').'</w:tc><w:tc>'.$p('Thermostat').'</w:tc></w:tr></w:tbl>';

        $drawing = '<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="9000000" cy="4500000"/><wp:docPr id="1" name="Gambar 1"/>'
            .'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            .'<pic:nvPicPr><pic:cNvPr id="1" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdImg1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            .'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9000000" cy="4500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

        $body = implode('', [
            $p('EMBEDDED SYSTEM', '', $bold),
            $p('Rahima Tartila, S.T'),
            $p('Kata Pengantar', '<w:pageBreakBefore/>', $bold),
            $p('Puji syukur ke hadirat Tuhan Yang Maha Esa atas terselesaikannya buku ini. '.$lorem),
            $p('Semoga buku ini bermanfaat bagi pembaca. '.$lorem),
            $p('DAFTAR ISI', '', $bold),
            $p('BAB 1 PENGENALAN ........ 1'),
            $p('1.1 Definisi ........ 2'),
            $p('BAB 1 PENGENALAN EMBEDDED SYSTEM', '', $bold),
            $p($lorem),
            $p($lorem.' '.$lorem),
            $p('1.1 Definisi dan Karakteristik', '', $bold),
            $p($lorem),
            $p('Tabel 1. 1 Karakteristik Utama Embedded System'),
            $table,
            $drawing,
            $p('Gambar 1. 1 Hubungan Hardware dan Software'),
            '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Bab 2: Arsitektur Hardware Dasar</w:t></w:r></w:p>',
            $p($lorem),
            '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Prosesor dan Mikrokontroler</w:t></w:r></w:p>',
            $p($lorem),
            $p('DAFTAR PUSTAKA', '', $bold),
            $p('[1] ARM Limited, ARM Cortex-M4 Devices Generic User Guide, 2010.'),
            $p('[2] M. Barr, Programming Embedded Systems in C and C++, O\'Reilly, 1999.'),
            $p('LAMPIRAN', '', $bold),
            $p('Lampiran 1 Kode program driver I2C'),
            $p('#include <linux/module.h>', '', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/>'),
            $p('BIODATA PENULIS', '', $bold),
            $p('Biodata lama yang diketik penulis di naskah.'),
            '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
        ]);

        $document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<w:document xmlns:w="'.self::W.'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'.$body.'</w:body></w:document>';

        $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="'.self::W.'">'
            .'<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
            .'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
            .'<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="40"/></w:rPr></w:style>'
            .'<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>'
            .'<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>'
            .'</w:styles>';

        $settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="'.self::W.'"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>';

        $types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
            .'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            .'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            .'<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
            .'</Types>';

        $rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

        $docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
            .'<Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>';

        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', $types);
        $zip->addFromString('_rels/.rels', $rootRels);
        $zip->addFromString('word/document.xml', $document);
        $zip->addFromString('word/styles.xml', $styles);
        $zip->addFromString('word/settings.xml', $settings);
        $zip->addFromString('word/_rels/document.xml.rels', $docRels);
        $zip->addFromString('word/media/image1.png', base64_decode(self::PNG));
        $zip->close();
    }
}
