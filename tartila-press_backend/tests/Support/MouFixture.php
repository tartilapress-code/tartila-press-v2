<?php

namespace Tests\Support;

use App\Models\Manuscript;
use App\Models\Mou;
use App\Models\MouTemplate;

/** MOU distribusi buku yang sudah ditandatangani semua penulis (syarat terbit). */
final class MouFixture
{
    public static function signedFor(Manuscript $manuscript): Mou
    {
        $content = MouTemplate::current('regular')->snapshot();
        $content['royalty_types'] = ['physical' => true, 'ebook' => false];

        return Mou::create([
            'type' => Mou::TYPE_REGULAR,
            'manuscript_id' => $manuscript->id,
            'number' => '001/MOU/TP/X/2026',
            'title' => $manuscript->title,
            'content' => $content,
            'distribution_choice' => array_column($content['distribution_options'], 'key'),
            'status' => Mou::STATUS_SIGNED,
            'signed_at' => now(),
        ]);
    }
}
