<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Akun mitra (Tartila Book) di Tartila Press hanya pengguna biasa: bisa membeli buku fisik, tetapi
 * tidak bisa mengambil paket, mendaftar event, menulis artikel, atau meminta role penulis/editor.
 * Semua aksi tulis di luar daftar di bawah ditolak; membaca halaman publik tetap bisa.
 */
class RestrictPartnerAccount
{
    /** Awalan jalur (setelah api/v1/) yang boleh ditulis oleh akun mitra. */
    private const ALLOWED_PREFIXES = ['auth/', 'orders', 'notifications', 'wallet', 'reader/', 'partner/', 'users/search'];

    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        $user = $request->user('sanctum');

        if (! $user || ! $user->roles->contains('name', 'mitra')) {
            return $next($request);
        }

        $path = ltrim(preg_replace('#^api/v1/#', '', $request->path()), '/');

        foreach (self::ALLOWED_PREFIXES as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return $next($request);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Akun mitra hanya bisa membeli buku fisik di Tartila Press. Kelola ebook Anda di Tartila Book.',
        ], 403);
    }
}
