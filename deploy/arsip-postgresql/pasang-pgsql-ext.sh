#!/usr/bin/env bash
#
# Memasang ekstensi PHP pgsql + pdo_pgsql dari berkas .deb resmi PPA
# ondrej/php, dengan mengambil berkas .so di dalamnya saja -- TANPA lewat
# `apt install`/`dpkg -i`.
#
# Kenapa begini: Launchpad cuma menyediakan unduhan untuk versi PHP yang
# SEDANG aktif di PPA (sekarang 8.2.34), sedangkan PHP yang sudah terpasang di
# server ini versi lain (mis. 8.2.30) karena repositorinya sempat/sedang tidak
# terjangkau dari sini. `apt`/`dpkg -i` akan menolak paket yang nomor versinya
# tidak sama persis. Padahal semua PHP 8.2.x (dari 8.2.0 sampai versi
# terbarunya) memakai "PHP API" yang SAMA, jadi berkas .so dari build versi
# lain tetap bisa dipakai oleh PHP yang terpasang sekarang -- cuma cara
# `apt install`-nya yang perlu dilewati.
#
# Aman: tidak mendaftar ke database dpkg sama sekali, jadi tidak akan membuat
# paket lain "rusak". Kalau ternyata tidak cocok, tinggal hapus dua baris di
# /etc/php/*/mods-available/pgsql.ini dan pdo_pgsql.ini plus dua berkas .so di
# /usr/lib/php/*/ -- tidak ada bekas lain.
#
#   bash deploy/pasang-pgsql-ext.sh ~/php8.2-pgsql_8.2.34-1+ubuntu22.04.1+deb.sury.org+1_amd64.deb

set -uo pipefail

DEB="${1:-}"
if [ -z "$DEB" ] || [ ! -f "$DEB" ]; then
    echo "Pemakaian: bash deploy/pasang-pgsql-ext.sh /path/ke/php8.2-pgsql_..._amd64.deb"
    exit 1
fi

PHPVER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
API="$(php -i | awk -F'=> ' '/^PHP API/{print $2}')"
if [ -z "$API" ]; then
    echo "GAGAL: tidak bisa membaca nomor 'PHP API' dari \`php -i\`."
    exit 1
fi
echo "==> PHP terpasang: $PHPVER, nomor API: $API"

echo "==> Memastikan libpq5 terpasang (dibutuhkan oleh pgsql.so)"
sudo apt install -y libpq5

WORK="$(mktemp -d)"
echo "==> Membongkar $DEB"
dpkg-deb -x "$DEB" "$WORK"

SRC="$WORK/usr/lib/php/$API"
DEST="/usr/lib/php/$API"

if [ ! -f "$SRC/pgsql.so" ] || [ ! -f "$SRC/pdo_pgsql.so" ]; then
    echo "GAGAL: pgsql.so / pdo_pgsql.so tidak ada di $SRC"
    echo "       Nomor API di dalam berkas .deb ini mungkin beda. Isi yang ada:"
    find "$WORK/usr/lib/php" -maxdepth 1 2>/dev/null
    rm -rf "$WORK"
    exit 1
fi

echo "==> Menyalin pgsql.so dan pdo_pgsql.so ke $DEST"
sudo cp "$SRC/pgsql.so" "$SRC/pdo_pgsql.so" "$DEST/"
rm -rf "$WORK"

echo "==> Mengaktifkan ekstensinya"
printf '; configuration for php pgsql module\n; priority=20\nextension=pgsql.so\n' | sudo tee "/etc/php/$PHPVER/mods-available/pgsql.ini" > /dev/null
printf '; configuration for php pgsql module\n; priority=20\nextension=pdo_pgsql.so\n' | sudo tee "/etc/php/$PHPVER/mods-available/pdo_pgsql.ini" > /dev/null
sudo phpenmod -v "$PHPVER" pgsql pdo_pgsql
sudo systemctl restart "php$PHPVER-fpm" 2>/dev/null

echo
echo "==> Selesai. Harus ada 'pgsql' dan 'pdo_pgsql' di bawah ini:"
php -m | grep -i pgsql
