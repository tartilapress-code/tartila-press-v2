<#
.SYNOPSIS
  Membangun frontend (Tartila Press, dan Tartila Book bila diminta) di komputer ini,
  lalu mengunggah hasilnya ke server. Untuk server kecil (2 GB RAM) yang tidak kuat
  menjalankan `vite build`; di server cukup `SKIP_FRONTEND_BUILD=1 bash deploy/deploy.sh`.

.PARAMETER Server
  Tujuan SSH, mis. ubuntu@203.0.113.5

.PARAMETER Domain
  Alamat Tartila Press, mis. https://tartilapress.com (atau http://IP:8080 untuk uji coba).
  Dipakai sebagai alamat API: <Domain>/api/v1

.PARAMETER BookDomain
  (Opsional) bila diisi, Tartila Book ikut dibangun dan diunggah ke folder dist-nya.

.PARAMETER RemoteRoot
  Folder proyek di server. Bawaan: /var/www/tartila-press-v2

.PARAMETER SkipUpload
  Hanya membangun dan membuat arsip (untuk mencoba), tanpa menyalin ke server.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\unggah-frontend.ps1 -Server ubuntu@203.0.113.5 -Domain https://tartilapress.com -BookDomain https://book.tartilapress.com
#>
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Domain,
    [string]$BookDomain = "",
    [string]$RemoteRoot = "/var/www/tartila-press-v2",
    [switch]$SkipUpload
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$Domain = $Domain.TrimEnd('/')
if ($Domain -notmatch '^https?://[^/\s]+$') { throw "-Domain harus berupa alamat tanpa jalur (diterima: $Domain)" }

function Build-And-Pack([string]$folder, [string]$label) {
    $dir = Join-Path $root $folder
    if (-not (Test-Path $dir)) { throw "Folder $dir tidak ada." }

    Write-Host "==> $label : build" -ForegroundColor Cyan
    Push-Location $dir
    try {
        # Variabel lingkungan VITE_* mengalahkan berkas .env, jadi tidak perlu menyentuh
        # .env lokal. `vite build` (bukan `npm run build`): lihat catatan di deploy.sh.
        $env:VITE_API_URL = "$Domain/api/v1"
        $env:VITE_PRESS_URL = $Domain
        if (-not (Test-Path "node_modules")) { npm ci; if ($LASTEXITCODE -ne 0) { throw "npm ci gagal" } }
        npx vite build
        if ($LASTEXITCODE -ne 0) { throw "vite build gagal ($label)" }
    }
    finally {
        Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
        Remove-Item Env:VITE_PRESS_URL -ErrorAction SilentlyContinue
        Pop-Location
    }

    $arsip = Join-Path $env:TEMP "$folder-dist.tgz"
    if (Test-Path -LiteralPath $arsip) { [System.IO.File]::Delete($arsip) }
    tar -czf $arsip -C (Join-Path $dir "dist") .
    if ($LASTEXITCODE -ne 0) { throw "Gagal membuat arsip $arsip" }
    Write-Host ("    arsip: {0} ({1} MB)" -f $arsip, [math]::Round((Get-Item -LiteralPath $arsip).Length / 1MB, 1))
    return $arsip
}

function Send-Dist([string]$arsip, [string]$folder) {
    $namaArsip = Split-Path $arsip -Leaf
    Write-Host "==> $folder : unggah ke $Server" -ForegroundColor Cyan
    scp $arsip "${Server}:~/$namaArsip"
    if ($LASTEXITCODE -ne 0) { throw "scp gagal" }
    # Diekstrak ke folder baru lalu ditukar, supaya situs tidak pernah setengah terganti.
    $remote = "set -e; cd $RemoteRoot/$folder && rm -rf dist.baru && mkdir dist.baru && tar -xzf ~/$namaArsip -C dist.baru && rm -rf dist.lama && { [ -d dist ] && mv dist dist.lama || true; } && mv dist.baru dist && rm -rf dist.lama ~/$namaArsip && echo 'dist terpasang di ' `$(pwd)/dist"
    ssh $Server $remote
    if ($LASTEXITCODE -ne 0) { throw "ssh gagal saat memasang dist" }
}

$daftar = @(, @("tartila-press-frontend", "Tartila Press"))
if ($BookDomain -ne "") { $daftar += , @("tartila-book-frontend", "Tartila Book") }

foreach ($item in $daftar) {
    $arsip = Build-And-Pack $item[0] $item[1]
    if (-not $SkipUpload) { Send-Dist $arsip $item[0] }
}

Write-Host ""
if ($SkipUpload) {
    Write-Host "Selesai (tanpa unggah)." -ForegroundColor Green
}
else {
    Write-Host "Selesai. Frontend sudah di server; tidak perlu me-reload apa pun (berkas statis)." -ForegroundColor Green
}
