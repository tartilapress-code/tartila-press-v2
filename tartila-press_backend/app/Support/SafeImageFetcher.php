<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Mengunduh gambar dari tautan yang diisi pengguna (foto profil, cover)
 * tanpa membuka celah SSRF:
 * - hanya http/https, tanpa user:password di URL, tanpa redirect;
 * - SEMUA alamat hasil DNS harus alamat internet publik (bukan localhost,
 *   jaringan privat, link-local/metadata cloud, CGNAT, dsb.);
 * - koneksi dikunci ke IP yang sudah diperiksa (anti DNS rebinding);
 * - ukuran dibatasi saat mengunduh, bukan sesudahnya.
 */
final class SafeImageFetcher
{
    /** @return array{bytes: string, mime: string}|null */
    public static function fetch(string $url, int $maxBytes): ?array
    {
        $parts = parse_url(trim($url));

        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        if ($ips === []) {
            return null;
        }

        foreach ($ips as $ip) {
            if (! self::isPublicIp($ip)) {
                return null;
            }
        }

        $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));

        try {
            $response = Http::timeout(8)
                ->connectTimeout(4)
                ->withOptions([
                    'allow_redirects' => false,
                    'stream' => true,
                    'curl' => [CURLOPT_RESOLVE => ["$host:$port:{$ips[0]}"]],
                ])
                ->withHeaders(['Accept' => 'image/*'])
                ->get($url);

            if (! $response->successful()) {
                return null;
            }

            $body = $response->toPsrResponse()->getBody();
            $bytes = '';

            while (! $body->eof()) {
                $bytes .= $body->read(65536);

                if (strlen($bytes) > $maxBytes) {
                    return null;
                }
            }
        } catch (Throwable) {
            return null;
        }

        $mime = strtolower(trim((string) strtok((string) $response->header('Content-Type'), ';')));

        return $bytes === '' ? null : ['bytes' => $bytes, 'mime' => $mime];
    }

    /** Alamat internet publik (IPv4/IPv6 global), bukan jaringan internal. */
    public static function isPublicIp(string $ip): bool
    {
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE | FILTER_FLAG_GLOBAL_RANGE
        ) !== false;
    }
}
