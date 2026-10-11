<?php

namespace App\Http\Controllers\Api\V1\Certificate;

use App\Http\Controllers\Controller;
use App\Support\Certificates\CertificateFonts;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class FontController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Show - Berkas font sertifikat untuk pratinjau di editor templat
    |--------------------------------------------------------------------------
    | Publik (font open source), tapi hanya berkas yang terdaftar di
    | config/certificates.php. Lewat API supaya mendapat header CORS --
    | browser menolak memuat font lintas origin tanpa itu.
    */

    public function show(string $file): BinaryFileResponse
    {
        $path = CertificateFonts::pathOf($file);

        abort_unless($path, 404);

        return response()->file($path, [
            'Content-Type' => 'font/ttf',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
