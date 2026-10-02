<?php

/*
 * Mengubah isi database PostgreSQL LOKAL menjadi berkas SQL yang bisa dimuat ke
 * MySQL/MariaDB di server. Dipakai HANYA kalau server memakai MySQL dan data dari
 * komputer lokal ikut dibawa (deploy/DEPLOY.md, bagian "Membawa data lokal").
 *
 *   cd tartila-press_backend
 *   php ..\deploy\pg-ke-mysql.php --base=https://DOMAIN_ANDA --out=..\tartila_press_mysql.sql
 *
 * - Database lokal hanya DIBACA; tidak ada yang diubah.
 * - Berkas hasilnya hanya berisi data (INSERT). Tabelnya harus sudah dibuat di
 *   MySQL lewat `php artisan migrate --force`.
 * - Alamat gambar lokal ("http://127.0.0.1:8000/storage/...") otomatis diganti
 *   dengan --base, jadi tidak perlu langkah URL terpisah.
 * - Tidak ikut dibawa: token login, sesi, cache, antrean, dan token reset
 *   password (semua orang cukup login ulang di server).
 * - Seluruh isi dimuat dalam SATU transaksi: kalau ada galat, tidak ada data
 *   setengah jadi yang tersisa.
 */

declare(strict_types=1);

const TABEL_DILEWATI = [
    'migrations', // sudah diisi oleh `php artisan migrate` di server
    'sessions',
    'cache',
    'cache_locks',
    'jobs',
    'job_batches',
    'failed_jobs',
    'password_reset_tokens',
    'personal_access_tokens',
];

const BATAS_BYTE_PER_INSERT = 262144;

function gagal(string $pesan): never
{
    fwrite(STDERR, "GAGAL: {$pesan}\n");
    exit(1);
}

function kutip(string $teks): string
{
    return "'".strtr($teks, [
        '\\' => '\\\\',
        "'" => "\\'",
        "\0" => '\\0',
        "\n" => '\\n',
        "\r" => '\\r',
        "\x1a" => '\\Z',
    ])."'";
}

$opsi = getopt('', ['base:', 'out:', 'help']);

if (isset($opsi['help']) || ! isset($opsi['base'], $opsi['out'])) {
    echo "Pemakaian:\n";
    echo "  php ..\\deploy\\pg-ke-mysql.php --base=https://DOMAIN_ANDA --out=..\\tartila_press_mysql.sql\n\n";
    echo "  --base  alamat situs di server, tanpa garis miring di belakang\n";
    echo "          (menggantikan http://127.0.0.1:8000 pada alamat gambar)\n";
    echo "  --out   berkas SQL hasilnya\n";
    exit(isset($opsi['help']) ? 0 : 1);
}

$base = rtrim((string) $opsi['base'], '/');
if (! preg_match('#^https?://[^/\s]+$#', $base)) {
    gagal("--base harus berupa alamat tanpa jalur, mis. https://tartilapress.com (diterima: {$base})");
}

$keluaran = (string) $opsi['out'];

$backend = dirname(__DIR__).DIRECTORY_SEPARATOR.'tartila-press_backend';
if (! is_file($backend.'/vendor/autoload.php')) {
    gagal("folder backend tidak ditemukan di {$backend} (jalankan dari komputer pengembangan).");
}

require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$koneksi = $app->make('db')->connection();
if ($koneksi->getDriverName() !== 'pgsql') {
    gagal('database backend saat ini bukan PostgreSQL ('.$koneksi->getDriverName().'); berkas ini khusus PostgreSQL -> MySQL.');
}
$pdo = $koneksi->getPdo();

// Alamat lokal yang diganti: alamat aplikasi lokal dan dua bentuk umum server pengembangan.
$alamatLokal = array_values(array_unique(array_filter([
    rtrim((string) config('app.url'), '/'),
    'http://127.0.0.1:8000',
    'http://localhost:8000',
])));

$tabel = $pdo->query('select tablename from pg_tables where schemaname = current_schema() order by tablename')
    ->fetchAll(PDO::FETCH_COLUMN);

$berkas = @fopen($keluaran, 'wb');
if ($berkas === false) {
    gagal("tidak bisa menulis {$keluaran}");
}

fwrite($berkas, "-- Dibuat oleh deploy/pg-ke-mysql.php pada ".date('Y-m-d H:i:s')."\n");
fwrite($berkas, '-- Sumber: PostgreSQL '.$koneksi->getDatabaseName()."\n");
fwrite($berkas, "-- Alamat lokal diganti dengan: {$base}\n");
fwrite($berkas, "-- Muat HANYA ke database baru yang sudah di-`migrate` dan masih kosong.\n\n");
fwrite($berkas, "SET NAMES utf8mb4;\n");
fwrite($berkas, "SET FOREIGN_KEY_CHECKS = 0;\n");
fwrite($berkas, "START TRANSACTION;\n\n");

$totalBaris = 0;
$totalUrlDiganti = 0;
$sisaLokal = [];

foreach ($tabel as $nama) {
    if (in_array($nama, TABEL_DILEWATI, true)) {
        continue;
    }

    $stmt = $pdo->query('select * from "'.$nama.'"');
    $jumlahKolom = $stmt->columnCount();
    $kolom = [];
    for ($i = 0; $i < $jumlahKolom; $i++) {
        $kolom[] = $stmt->getColumnMeta($i)['name'];
    }

    $awalan = 'INSERT INTO `'.$nama.'` (`'.implode('`, `', $kolom).'`) VALUES';
    $kelompok = [];
    $ukuran = 0;
    $baris = 0;

    $tulis = static function () use ($berkas, $awalan, &$kelompok, &$ukuran): void {
        if ($kelompok === []) {
            return;
        }
        fwrite($berkas, $awalan."\n".implode(",\n", $kelompok).";\n");
        $kelompok = [];
        $ukuran = 0;
    };

    while (($data = $stmt->fetch(PDO::FETCH_NUM)) !== false) {
        $nilai = [];
        foreach ($data as $urutan => $v) {
            if ($v === null) {
                $nilai[] = 'NULL';
            } elseif (is_bool($v)) {
                $nilai[] = $v ? '1' : '0';
            } elseif (is_int($v)) {
                $nilai[] = (string) $v;
            } elseif (is_float($v)) {
                $nilai[] = is_finite($v) ? var_export($v, true) : 'NULL';
            } elseif (is_resource($v)) {
                $biner = (string) stream_get_contents($v);
                $nilai[] = $biner === '' ? "''" : '0x'.bin2hex($biner);
            } else {
                $teks = (string) $v;
                foreach ($alamatLokal as $lokal) {
                    if (str_contains($teks, $lokal)) {
                        $teks = str_replace($lokal, $base, $teks, $diganti);
                        $totalUrlDiganti += $diganti;
                    }
                }
                // Alamat lokal lain yang lolos (mis. dengan port berbeda). IP polos seperti
                // audit_logs.ip_address = 127.0.0.1 tidak dihitung.
                if (preg_match('#(127\.0\.0\.1|localhost)(:\d+|/)#', $teks)) {
                    $sisaLokal[$nama.'.'.$kolom[$urutan]] = true;
                }
                $nilai[] = kutip($teks);
            }
        }

        $tuple = '('.implode(', ', $nilai).')';
        if ($kelompok !== [] && $ukuran + strlen($tuple) > BATAS_BYTE_PER_INSERT) {
            $tulis();
        }
        $kelompok[] = $tuple;
        $ukuran += strlen($tuple);
        $baris++;
    }
    $tulis();

    $totalBaris += $baris;
    if ($baris > 0) {
        fwrite($berkas, "\n");
    }
    echo str_pad($nama, 32).$baris." baris\n";
}

fwrite($berkas, "COMMIT;\n");
fwrite($berkas, "SET FOREIGN_KEY_CHECKS = 1;\n");
fclose($berkas);

echo "\nTotal: {$totalBaris} baris; {$totalUrlDiganti} alamat lokal diganti dengan {$base}\n";
echo 'Berkas: '.realpath($keluaran).' ('.number_format((int) (filesize($keluaran) / 1024)).' KB)'."\n";

if ($sisaLokal !== []) {
    echo "\nPERHATIAN: masih ada teks berisi 127.0.0.1/localhost di kolom berikut (periksa manual):\n";
    foreach (array_keys($sisaLokal) as $k) {
        echo "  - {$k}\n";
    }
}
