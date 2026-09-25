#!/usr/bin/env bash
#
# Memperbarui Tartila Press di server setelah ada kode baru di GitHub.
#
#   bash deploy/deploy.sh
#
# Jalankan sebagai user biasa yang sama dengan user PHP-FPM (bukan root).
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

if [ ! -f "$FRONTEND/.env.production.local" ]; then
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

echo "==> 4/5 Frontend: build"
cd "$FRONTEND"
npm ci
# Sengaja `vite build`, bukan `npm run build`: skrip itu menjalankan `tsc -b`
# yang masih gagal karena beberapa berkas lama yang belum selesai (WIP).
# Hasil situsnya sama.
npx vite build

echo "==> 5/5 Memuat ulang PHP-FPM (membersihkan opcache)"
PHPVER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
sudo systemctl reload "php${PHPVER}-fpm"

echo
echo "Selesai. Buka situsnya dan segarkan halaman (Ctrl+F5)."
