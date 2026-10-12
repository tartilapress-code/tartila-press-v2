<?php
// Profil query per request (sama seperti di produksi: cache config/route aktif). Pemakaian: php qprofile.php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

require 'C:/perf/app/vendor/autoload.php';
$app = require 'C:/perf/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$uid = (int) (getenv("PUID") ?: 100005 + (int) ($argv[1] ?? 0));
$token = "$uid|perf$uid";
$cases = [
    ['GET', '/api/v1/admin/royalties', null],
    ['GET', '/api/v1/admin/users?per_page=20', null],
    ['GET', '/api/v1/admin/orders?per_page=20', null],
    ['GET', '/api/v1/reader/books?page=1&per_page=24', null],
    ['GET', '/api/v1/reader/books/5', null],
    ['GET', '/api/v1/reader/me/shelf?tab=reading', null],
    ['GET', '/api/v1/reader/books/5/comments', null],
    ['GET', '/api/v1/reader/books/5/bookmarks', null],
    ['POST', '/api/v1/reader/books/5/reads', ['pages' => [37]]],
    ['PUT', '/api/v1/reader/books/5/progress', ['page' => 37]],
    ['GET', '/api/v1/notifications/summary', null],
    ['GET', '/api/v1/dashboard/summary', null],
    ['GET', '/api/v1/books?per_page=4', null],
];
$only = $argv[2] ?? null;

foreach ($cases as [$method, $uri, $body]) {
    if ($only && ! str_contains($uri, $only)) {
        continue;
    }
    foreach ([1, 2] as $round) {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $request = Request::create($uri, $method, [], [], [], ['HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => "Bearer $token", 'CONTENT_TYPE' => 'application/json'], $body ? json_encode($body) : null);
        $t = microtime(true);
        $response = $kernel->handle($request);
        $ms = (microtime(true) - $t) * 1000;
        $log = DB::getQueryLog();
        $dbms = array_sum(array_column($log, 'time'));
        if ($round === 2) {
            printf("%-5s %-48s %3d  %6.1f ms (db %6.1f ms)  %d\n", $method, $uri, count($log), $ms, $dbms, $response->getStatusCode());
            if ($only) {
                foreach ($log as $q) {
                    printf("      %6.2f ms  %s\n", $q['time'], substr(preg_replace('/\s+/', ' ', $q['query']), 0, 190));
                }
            }
        }
        $kernel->terminate($request, $response);
    }
}
