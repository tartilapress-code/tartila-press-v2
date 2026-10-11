<?php

namespace App\Support\ManuscriptTemplates;

use DOMDocument;
use DOMXPath;
use ZipArchive;

/** Naskah bab yang sedang disalin oleh DocxMerger. */
final class MergeSource
{
    public DOMXPath $xp;

    /** @var array<string, string> styleId => nama gaya (huruf kecil) */
    public array $styleNames = [];

    public function __construct(public ZipArchive $zip, public DOMDocument $doc) {}
}
