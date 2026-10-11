<?php

namespace App\Support\ManuscriptTemplates;

use DOMDocument;
use DOMElement;
use RuntimeException;
use ZipArchive;

/**
 * Pengaman berkas Word (.docx) kiriman penulis sebelum diolah/diteruskan:
 * - XML ber-DTD ditolak (XXE, "billion laughs"); OOXML tidak memakai DTD.
 * - Ukuran setelah diekstrak dibatasi (zip bomb).
 * - Relasi eksternal selain tautan http/https/mailto dinetralkan (template
 *   jarak jauh, gambar dari jalur UNC/file:// yang bisa membocorkan kredensial
 *   Windows editor) dan makro VBA dibuang dari berkas hasil.
 */
final class DocxPackage
{
    /** Batas satu part setelah diekstrak. */
    public static int $maxPartBytes = 60 * 1024 * 1024;

    /** Batas total isi paket setelah diekstrak. */
    public static int $maxTotalBytes = 300 * 1024 * 1024;

    public const MAX_ENTRIES = 3000;

    private const SAFE_EXTERNAL = '#^(https?|mailto):#i';

    /** Tolak paket yang terlalu besar setelah diekstrak. */
    public static function assertSafeSize(ZipArchive $zip, string $label = 'Berkas Word'): void
    {
        if ($zip->numFiles > self::MAX_ENTRIES) {
            throw new RuntimeException("$label berisi terlalu banyak bagian.");
        }

        $total = 0;

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $size = (int) ($zip->statIndex($i)['size'] ?? 0);
            $total += $size;

            if ($size > self::$maxPartBytes || $total > self::$maxTotalBytes) {
                throw new RuntimeException("$label terlalu besar setelah diekstrak.");
            }
        }
    }

    /**
     * Berkas unggahan harus .docx yang bisa diperiksa: zip valid, punya
     * word/document.xml, ukuran wajar, dan tidak satu pun part XML memakai
     * DTD (deklarasi DTD hanya bisa ada di awal berkas).
     */
    public static function assertUsable(string $path): void
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new RuntimeException('Berkas bukan dokumen Word (.docx) yang valid.');
        }

        try {
            if ($zip->locateName('word/document.xml') === false) {
                throw new RuntimeException('Berkas bukan dokumen Word (.docx) yang valid.');
            }

            self::assertSafeSize($zip);

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = (string) $zip->getNameIndex($i);

                if (! preg_match('/\.(xml|rels)$/i', $name)) {
                    continue;
                }

                $stream = $zip->getStream($name);
                $head = $stream ? (string) fread($stream, 4096) : '';

                if ($stream) {
                    fclose($stream);
                }

                if (preg_match('/<!DOCTYPE|<!ENTITY/i', $head)) {
                    throw new RuntimeException('Berkas Word berisi bagian yang tidak diizinkan.');
                }
            }
        } finally {
            $zip->close();
        }
    }

    /**
     * Salinan .docx yang sudah dinetralkan (untuk diunduh); berkas asli
     * tidak diubah. Pemanggil menghapus salinannya.
     */
    public static function sanitizedCopy(string $path): string
    {
        $copy = tempnam(sys_get_temp_dir(), 'tpsafe');

        if ($copy === false || ! copy($path, $copy)) {
            throw new RuntimeException('Berkas Word tidak bisa disalin.');
        }

        try {
            self::assertUsable($copy);
            self::sanitizeFile($copy);
        } catch (RuntimeException $exception) {
            @unlink($copy);

            throw $exception;
        }

        return $copy;
    }

    /** XML part tanpa DTD; NONET supaya tidak pernah mengambil apa pun dari jaringan. */
    public static function loadXml(string $xml): DOMDocument
    {
        if ($xml === '' || preg_match('/<!DOCTYPE|<!ENTITY/i', $xml)) {
            throw new RuntimeException('Isi dokumen Word rusak atau tidak bisa dibaca.');
        }

        $doc = new DOMDocument;
        $doc->preserveWhiteSpace = true;

        if (! @$doc->loadXML($xml, LIBXML_NONET | LIBXML_PARSEHUGE)) {
            throw new RuntimeException('Isi dokumen Word rusak atau tidak bisa dibaca.');
        }

        return $doc;
    }

    /**
     * Netralkan relasi eksternal berbahaya dan buang makro pada berkas .docx
     * hasil olahan (dibuka ulang dari disk supaya membaca isi akhirnya).
     */
    public static function sanitizeFile(string $path): void
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new RuntimeException('Berkas Word hasil olahan tidak bisa dibuka.');
        }

        $vba = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);

            if (preg_match('#(^|/)vba[^/]*\.(bin|xml)$#i', $name) || preg_match('#(^|/)_rels/vba[^/]*\.rels$#i', $name)) {
                $vba[] = $name;
            }
        }

        foreach ($vba as $name) {
            $zip->deleteName($name);
        }

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);

            if (! str_ends_with($name, '.rels')) {
                continue;
            }

            $xml = $zip->getFromIndex($i);

            if ($xml === false || $xml === '') {
                continue;
            }

            $rels = self::loadXml($xml);
            $changed = false;

            foreach (iterator_to_array($rels->documentElement->childNodes) as $rel) {
                if (! $rel instanceof DOMElement) {
                    continue;
                }

                $type = $rel->getAttribute('Type');

                // Relasi ke makro dibuang bersama partnya.
                if (preg_match('#/vbaProject$|/vbaData$|/keyMapCustomizations$#', $type)) {
                    $rels->documentElement->removeChild($rel);
                    $changed = true;

                    continue;
                }

                if ($rel->getAttribute('TargetMode') !== 'External') {
                    continue;
                }

                $isLink = str_ends_with($type, '/hyperlink');

                if (! $isLink || ! preg_match(self::SAFE_EXTERNAL, trim($rel->getAttribute('Target')))) {
                    $rel->setAttribute('Target', 'about:blank');
                    $changed = true;
                }
            }

            if ($changed) {
                $zip->addFromString($name, $rels->saveXML());
            }
        }

        // Dokumen utama ber-makro (.docm yang diganti nama) → dokumen biasa;
        // tipe konten part makro yang dibuang ikut dihapus.
        $typesXml = $zip->getFromName('[Content_Types].xml');

        if ($typesXml !== false && ($vba !== [] || str_contains($typesXml, 'macroEnabled'))) {
            $types = self::loadXml($typesXml);

            foreach (iterator_to_array($types->documentElement->childNodes) as $type) {
                if (! $type instanceof DOMElement) {
                    continue;
                }

                if ($type->localName === 'Override' && in_array(ltrim($type->getAttribute('PartName'), '/'), $vba, true)) {
                    $types->documentElement->removeChild($type);
                } elseif ($type->getAttribute('ContentType') === 'application/vnd.ms-word.document.macroEnabled.main+xml') {
                    $type->setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');
                }
            }

            $zip->addFromString('[Content_Types].xml', $types->saveXML());
        }

        $zip->close();
    }
}
