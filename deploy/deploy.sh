#!/usr/bin/env bash
#
# Memperbarui Tartila Press di server setelah ada kode baru di GitHub.
#
#   bash deploy/deploy.sh
#
# Jalankan sebagai user biasa yang sama dengan user PHP-FPM (bukan root).
#
# Server kecil (2 GB RAM): build frontend (Vite) memakan banyak memori. Bangun di
# komputer Anda lalu unggah `dist`, dan jalankan skrip ini dengan
#   SKIP_FRONTEND_BUILD=1 bash deploy/deploy.sh
# (langkah lengkapnya: deploy/DEPLOY.md, bagian "Server 2 GB"). Dengan opsi ini
# Node.js dan `npm ci` tidak diperlukan di server sama sekali.
# Pemasangan awal (paket server, database, .env, Nginx, HTTPS) ada di
# deploy/DEPLOY.md; skrip ini hanya untuk pembaruan berikutnya.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/tartila-press_backend"
FRONTEND="$ROOT/tartila-press-frontend"

if [ ! -f "$BACKEND/.env" ]; then
    echo "GAGAL: $BACKEND/.env belum ada. Ikuti deploy/DEPLOY.md bagian 'Backend' dulu."
    exit 1
fi

SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-0}"

if [ "$SKIP_FRONTEND_BUILD" != "1" ] && [ ! -f "$FRONTEND/.env.production.local" ]; then
    echo "GAGAL: $FRONTEND/.env.production.local belum ada."
    echo "Isinya satu baris:  VITE_API_URL=https://DOMAIN_ANDA/api/v1"
    exit 1
fi

echo "==> 1/5 Mengambil kode terbaru"
# `npm install` di server sering mengubah package-lock.json; buang perubahan itu
# supaya `git pull` tidak bentrok (server memakai `npm ci`, yang tidak mengubahnya).
git -C "$ROOT" checkout -- tartila-press-frontend/package-lock.json 2>/dev/null || true
git -C "$ROOT" pull --ff-only

echo "==> 2/5 Backend: paket PHP (tanpa paket pengembangan)"
cd "$BACKEND"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> 3/5 Backend: migrasi database dan cache"
php artisan migrate --force
php artisan storage:link 2>/dev/null || true
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
# Versi kecil (WebP) gambar unggahan yang belum punya; aman diulang.
php artisan images:responsive || true

if [ "$SKIP_FRONTEND_BUILD" = "1" ]; then
    echo "==> 4/5 Frontend: build dilewati (SKIP_FRONTEND_BUILD=1); memakai dist yang sudah diunggah"
    [ -f "$FRONTEND/dist/index.html" ] || echo "    PERINGATAN: $FRONTEND/dist/index.html belum ada. Unggah hasil build dari komputer Anda."
else
    echo "==> 4/5 Frontend: build"
    cd "$FRONTEND"
    npm ci
    # Sengaja `vite build`, bukan `npm run build`: skrip itu menjalankan `tsc -b`
    # yang masih gagal karena beberapa berkas lama yang belum selesai (WIP).
    # Hasil situsnya sama.
    npx vite build

    # Tartila Book (situs baca buku): dibuild bila foldernya ada dan alamat API-nya
    # sudah diatur (tartila-book-frontend/.env.production.local, lihat DEPLOY.md §12).
    BOOK_FRONTEND="$ROOT/tartila-book-frontend"
    if [ -d "$BOOK_FRONTEND" ] && [ -f "$BOOK_FRONTEND/.env.production.local" ]; then
        echo "==> 4b/5 Tartila Book: build"
        cd "$BOOK_FRONTEND"
        npm ci
        npx vite build
    fi
fi

echo "==> 5/5 Memuat ulang PHP-FPM (membersihkan opcache)"
PHPVER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
sudo systemctl reload "php${PHPVER}-fpm"

echo
echo "Selesai. Buka situsnya dan segarkan halaman (Ctrl+F5)."
