#!/usr/bin/env bash
#
# Memuat berkas SQL hasil deploy/ekspor-data-lokal.ps1 ke database server.
#
#   bash deploy/muat-data.sh ~/tartila_press_data.sql
#
# Syarat: `php artisan migrate --force` sudah dijalankan (tabel ada). Skrip ini
# MENGOSONGKAN semua tabel (kecuali `migrations`) lebih dulu, karena migrasi dan
# pemasangan awal sudah mengisi beberapa baris bawaan (peran, profil, templat)
# yang juga ada di data lokal; lalu memuat seluruh data dalam SATU transaksi.
# Kalau ada galat saat memuat, tidak ada data setengah jadi: ulangi saja.
#
# Variabel opsional: ENV_FILE=/jalur/.env  (bawaan: tartila-press_backend/.env)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/tartila-press_backend/.env}"
SQL="${1:-}"

[ -n "$SQL" ] && [ -f "$SQL" ] || { echo "Pemakaian: bash deploy/muat-data.sh BERKAS.sql"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "GAGAL: $ENV_FILE tidak ada."; exit 1; }

env_value() {
    grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" -e 's/[[:space:]]*$//'
}

DB_HOST="$(env_value DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(env_value DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="$(env_value DB_DATABASE)"
DB_USERNAME="$(env_value DB_USERNAME)"
DB_PASSWORD="$(env_value DB_PASSWORD)"
[ -n "$DB_DATABASE" ] && [ -n "$DB_USERNAME" ] || { echo "GAGAL: DB_DATABASE/DB_USERNAME kosong di $ENV_FILE."; exit 1; }

CNF="$(mktemp)"
TRUNC="$(mktemp)"
trap 'rm -f "$CNF" "$TRUNC"' EXIT
chmod 600 "$CNF"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\ndefault-character-set=utf8mb4\n' "$DB_HOST" "$DB_PORT" "$DB_USERNAME" "$DB_PASSWORD" > "$CNF"

SQLCMD=(mysql --defaults-extra-file="$CNF" --max-allowed-packet=64M "$DB_DATABASE")

echo "Database tujuan: $DB_DATABASE di $DB_HOST:$DB_PORT"
TABEL="$("${SQLCMD[@]}" -N -e "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'" | cut -f1)"
if ! grep -qx migrations <<< "$TABEL"; then
    echo "GAGAL: tabel migrations tidak ada. Jalankan dulu: php artisan migrate --force"
    exit 1
fi

if [ "${YA:-0}" != "1" ]; then
    echo "SEMUA isi tabel (kecuali migrations) di database ini akan DIGANTI dengan isi $SQL."
    echo "Ketik GANTI untuk melanjutkan:"
    read -r jawab
    [ "$jawab" = "GANTI" ] || { echo "Dibatalkan."; exit 0; }
fi

{
    echo "SET FOREIGN_KEY_CHECKS=0;"
    while IFS= read -r t; do
        [ "$t" = "migrations" ] && continue
        echo "TRUNCATE TABLE \`$t\`;"
    done <<< "$TABEL"
    echo "SET FOREIGN_KEY_CHECKS=1;"
} > "$TRUNC"

echo "==> Mengosongkan tabel"
"${SQLCMD[@]}" < "$TRUNC"

echo "==> Memuat data (satu transaksi)"
{
    echo "SET NAMES utf8mb4; SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0; SET autocommit=0;"
    cat "$SQL"
    echo
    echo "COMMIT; SET FOREIGN_KEY_CHECKS=1; SET UNIQUE_CHECKS=1;"
} | "${SQLCMD[@]}"

echo "==> Ringkasan"
"${SQLCMD[@]}" -e "SELECT 'users' AS tabel, COUNT(*) AS baris FROM users UNION ALL SELECT 'books', COUNT(*) FROM books UNION ALL SELECT 'manuscripts', COUNT(*) FROM manuscripts UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'packages', COUNT(*) FROM packages"
echo
echo "Selesai. Sisa pekerjaan:"
echo "  - Ganti akun bawaan seeder (DEPLOY.md, 'Sesudah membawa data lokal')."
echo "  - Bersihkan akun/pesanan uji (akun berakhiran @example.com) lewat panel admin."
echo "  - php artisan config:cache   (langkah 3.3)"
