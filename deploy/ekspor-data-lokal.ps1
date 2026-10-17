<#
.SYNOPSIS
  Mengekspor isi database MariaDB LOKAL menjadi satu berkas SQL siap dimuat di server.

.DESCRIPTION
  Pasangannya di server: deploy/muat-data.sh. Database lokal hanya DIBACA.

  - Hanya berisi data (INSERT); tabelnya dibuat di server lewat `php artisan migrate`.
  - Alamat gambar lokal (backend :8000 dan frontend :5173) diganti dengan -Base.
  - Tidak ikut: token login, sesi, cache, antrean, token reset password. Semua orang
    cukup login ulang di server, dan token pengembangan tidak bocor ke server.
  - Pengaturan koneksi dibaca dari tartila-press_backend\.env.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\ekspor-data-lokal.ps1 -Base https://tartilapress.com
  powershell -ExecutionPolicy Bypass -File deploy\ekspor-data-lokal.ps1 -Base http://203.0.113.5:8080 -Out C:\temp\data.sql
#>
param(
    [Parameter(Mandatory = $true)][string]$Base,
    [string]$Out = "",
    [string]$EnvFile = "",
    [string]$MysqlDump = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if ($EnvFile -eq "") { $EnvFile = Join-Path $root "tartila-press_backend\.env" }
if ($Out -eq "") { $Out = Join-Path $root "tartila_press_data.sql" }

$Base = $Base.TrimEnd('/')
if ($Base -notmatch '^https?://[^/\s]+$') {
    throw "-Base harus berupa alamat tanpa jalur, mis. https://tartilapress.com (diterima: $Base)"
}

if ($MysqlDump -eq "") {
    $cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
    if ($cmd) { $MysqlDump = $cmd.Source } elseif (Test-Path "C:\xampp\mysql\bin\mysqldump.exe") { $MysqlDump = "C:\xampp\mysql\bin\mysqldump.exe" }
}
if ($MysqlDump -eq "" -or -not (Test-Path $MysqlDump)) {
    throw "mysqldump tidak ditemukan. Isi -MysqlDump 'C:\xampp\mysql\bin\mysqldump.exe'."
}

function Get-EnvValue([string]$name) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$name=" } | Select-Object -Last 1
    if (-not $line) { return "" }
    return ($line -replace "^$name=", "").Trim().Trim('"').Trim("'")
}

if ((Get-EnvValue "DB_CONNECTION") -notin @("mysql", "mariadb")) {
    throw "DB_CONNECTION di $EnvFile bukan mysql/mariadb. Skrip ini untuk database lokal MariaDB."
}
$dbHost = Get-EnvValue "DB_HOST"; if ($dbHost -eq "") { $dbHost = "127.0.0.1" }
$dbPort = Get-EnvValue "DB_PORT"; if ($dbPort -eq "") { $dbPort = "3306" }
$dbName = Get-EnvValue "DB_DATABASE"
$dbUser = Get-EnvValue "DB_USERNAME"
$dbPass = Get-EnvValue "DB_PASSWORD"

# Tabel yang tidak dibawa (terisi sendiri di server atau berisi data pengembangan).
$lewati = @("migrations", "sessions", "cache", "cache_locks", "jobs", "job_batches",
    "failed_jobs", "password_reset_tokens", "personal_access_tokens")

# Sandi lewat berkas sementara, bukan argumen perintah.
$cnf = [System.IO.Path]::GetTempFileName()
try {
    Set-Content -Path $cnf -Value "[client]`nhost=$dbHost`nport=$dbPort`nuser=$dbUser`npassword=`"$dbPass`"" -Encoding ascii

    $dumpArgs = @("--defaults-extra-file=$cnf", "--no-create-info", "--skip-triggers", "--skip-add-locks",
        "--skip-disable-keys", "--complete-insert", "--single-transaction", "--skip-lock-tables",
        "--default-character-set=utf8mb4", "--max-allowed-packet=64M", "--result-file=$Out.mentah")
    foreach ($t in $lewati) { $dumpArgs += "--ignore-table=$dbName.$t" }
    $dumpArgs += $dbName

    & $MysqlDump @dumpArgs
    if ($LASTEXITCODE -ne 0) { throw "mysqldump gagal (kode $LASTEXITCODE)." }
}
finally {
    [System.IO.File]::Delete($cnf)
}

# Mengganti alamat lokal. Kolom JSON berisi alamat dengan garis miring yang di-escape
# (http:\/\/127.0.0.1:8000), dan mysqldump menggandakan garis terbaliknya (http:\\/\\/...).
$teks = [System.IO.File]::ReadAllText("$Out.mentah", [System.Text.Encoding]::UTF8)
$baseJson = $Base.Replace("/", "\\/")
$total = 0
# 8000 = backend, 5173 = frontend Tartila Press (di server keduanya satu alamat).
foreach ($lokal in @("http://127.0.0.1:8000", "http://localhost:8000", "http://127.0.0.1:5173", "http://localhost:5173")) {
    $lokalJson = $lokal.Replace("/", "\\/")
    foreach ($pasangan in @(@($lokal, $Base), @($lokalJson, $baseJson))) {
        $jumlah = ([regex]::Matches($teks, [regex]::Escape($pasangan[0]))).Count
        if ($jumlah -gt 0) {
            $teks = $teks.Replace($pasangan[0], $pasangan[1])
            $total += $jumlah
        }
    }
}
[System.IO.File]::WriteAllText($Out, $teks, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::Delete("$Out.mentah")

# Hanya alamat web (http://127.0.0.1..., http://localhost...). Alamat IP polos di log login
# pengembangan (kolom ip_address) bukan masalah.
$polaSisa = 'https?:\\*/\\*/(127\.0\.0\.1|localhost)'
$sisa = ([regex]::Matches($teks, $polaSisa)).Count
$ukuran = [math]::Round((Get-Item $Out).Length / 1KB)
Write-Host "Selesai: $Out ($ukuran KB)"
Write-Host "Alamat lokal diganti dengan ${Base}: $total tempat."
if ($sisa -gt 0) {
    Write-Host "PERHATIAN: masih ada $sisa alamat web lokal (mis. port selain 8000). Periksa:" -ForegroundColor Yellow
    Write-Host "  Select-String -Path '$Out' -Pattern 'https?:.{0,6}(127\.0\.0\.1|localhost)' | Select-Object -First 10"
}
Write-Host ""
Write-Host "Berikutnya: salin ke server lalu jalankan deploy/muat-data.sh"
Write-Host "  scp `"$Out`" USER@IP_SERVER:~/"
