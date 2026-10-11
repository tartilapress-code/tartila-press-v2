<?php

namespace Tests\Feature\Security;

use App\Support\SafeImageFetcher;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** SSRF: foto/cover dari tautan pengguna tidak boleh menjangkau jaringan internal. */
class SafeImageFetcherTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function internalUrls(): array
    {
        return [
            'localhost' => ['http://localhost/a.png'],
            'loopback' => ['http://127.0.0.1:8000/api/v1/admin/vouchers'],
            'loopback lain' => ['http://127.1.2.3/a.png'],
            'desimal' => ['http://2130706433/a.png'],
            'heksadesimal' => ['http://0x7f000001/a.png'],
            'jaringan privat 10' => ['http://10.0.0.5/a.png'],
            'jaringan privat 192' => ['http://192.168.1.1/a.png'],
            'jaringan privat 172' => ['http://172.16.0.1/a.png'],
            'metadata cloud' => ['http://169.254.169.254/latest/meta-data/'],
            'CGNAT / metadata Alibaba' => ['http://100.100.100.200/latest/meta-data'],
            'nol' => ['http://0.0.0.0/a.png'],
            'IPv6 loopback' => ['http://[::1]/a.png'],
            'IPv6 terpetakan' => ['http://[::ffff:127.0.0.1]/a.png'],
            'skema file' => ['file:///C:/Windows/win.ini'],
            'skema gopher' => ['gopher://127.0.0.1:6379/_INFO'],
            'skema ftp' => ['ftp://93.184.215.14/a.png'],
            'kredensial di URL' => ['http://user:pass@93.184.215.14/a.png'],
            'host tak dikenal' => ['http://tidak-ada.invalid/a.png'],
            'bukan URL' => ['../../.env'],
        ];
    }

    #[DataProvider('internalUrls')]
    public function test_internal_or_unsafe_urls_are_never_requested(string $url): void
    {
        Http::fake(['*' => Http::response('RAHASIA', 200, ['Content-Type' => 'image/png'])]);

        $this->assertNull(SafeImageFetcher::fetch($url, 1024 * 1024));
        Http::assertNothingSent();
    }

    public function test_public_images_are_fetched_without_following_redirects_and_with_a_size_cap(): void
    {
        Http::fake([
            '93.184.215.14/ok.png' => Http::response('PNGDATA', 200, ['Content-Type' => 'image/png; charset=binary']),
            '93.184.215.14/redirect.png' => Http::response('', 302, ['Location' => 'http://127.0.0.1/rahasia']),
            '93.184.215.14/besar.png' => Http::response(str_repeat('x', 3000), 200, ['Content-Type' => 'image/png']),
        ]);

        $this->assertSame(['bytes' => 'PNGDATA', 'mime' => 'image/png'], SafeImageFetcher::fetch('https://93.184.215.14/ok.png', 1000));
        $this->assertNull(SafeImageFetcher::fetch('https://93.184.215.14/redirect.png', 1000));
        $this->assertNull(SafeImageFetcher::fetch('https://93.184.215.14/besar.png', 1000));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '127.0.0.1'));
    }
}
