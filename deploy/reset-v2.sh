#!/usr/bin/env bash
#
# Membatalkan pemasangan Tartila Press v2 yang sudah berjalan sebagian, supaya
# bisa dimulai lagi dari langkah 1 di deploy/DEPLOY.md. TIDAK menyentuh website
# lama (folder/database/Nginx/PHP-FPM/cron miliknya) maupun folder
# tartila-press-v2 itu sendiri (kode + riwayat git tetap ada) -- cuma hasil
# pemasangannya yang dibuang. Aman dijalankan berulang kali atau walau sebagian
# belum pernah dibuat.
#
#   cd /var/www/tartila-press-v2
#   git pull
#   bash deploy/reset-v2.sh                   # reset biasa
#   bash deploy/reset-v2.sh --hapus-unggahan  # + buang cover/PDF uji coba

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/tartila-press_backend"
FRONTEND="$ROOT/tartila-press-frontend"
PHPVER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"

echo "==> Nginx & PHP-FPM khusus v2"
sudo rm -f /etc/nginx/sites-enabled/tartila-press-v2 /etc/nginx/sites-available/tartila-press-v2
if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
else
    echo "    (nginx -t gagal -- reload dilewati, berkas lain tidak disentuh)"
fi
sudo rm -f "/etc/php/$PHPVER/fpm/pool.d/tartila-v2.conf"
sudo systemctl reload "php$PHPVER-fpm" 2>/dev/null

echo "==> Baris cron v2 (baris lain, termasuk milik website lama, tetap ada)"
crontab -l 2>/dev/null | grep -v 'tartila-press-v2' | crontab - 2>/dev/null

echo "==> Database v2 (PostgreSQL dan/atau MySQL, kalau pernah dibuat)"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS tartila_press;" 2>/dev/null
sudo -u postgres psql -c "DROP USER IF EXISTS tartila;" 2>/dev/null
sudo mysql -e "DROP DATABASE IF EXISTS tartila_press_v2; DROP USER IF EXISTS 'tartila_v2'@'localhost';" 2>/dev/null

echo "==> Berkas hasil pemasangan backend & frontend"
if [ -f "$BACKEND/.env" ]; then
    BACKUP=~/"tartila-press_backend.env.bak-$(date +%F-%H%M%S)"
    mv "$BACKEND/.env" "$BACKUP"
    echo "    .env lama dipindah ke $BACKUP"
fi
rm -rf "$BACKEND/vendor"
rm -f "$BACKEND"/bootstrap/cache/*.php
rm -rf "$FRONTEND/node_modules" "$FRONTEND/dist" "$FRONTEND/.env.production.local"

if [ "${1:-}" = "--hapus-unggahan" ]; then
    echo "==> Menghapus unggahan uji coba (storage/app/public dan storage/app/private)"
    rm -rf "$BACKEND"/storage/app/public/* "$BACKEND"/storage/app/private/*
fi

echo
echo "Selesai. Folder v2 sudah seperti baru di-clone."
echo "Lanjutkan dari langkah 1 (paket) sampai 2B (PostgreSQL) di deploy/DEPLOY.md."
