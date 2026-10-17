#!/usr/bin/env bash
#
# Memasang setelan server (swap, database, PHP-FPM, OPcache) untuk satu profil
# ukuran server. Aman dijalankan ulang; dipakai lagi saat naik paket (2gb -> 8gb).
#
#   bash deploy/pasang-server.sh 2gb              # server 2 GB RAM / 1 vCPU
#   bash deploy/pasang-server.sh 8gb              # server 8 GB RAM / 4 vCPU
#   bash deploy/pasang-server.sh 2gb --simulasi   # hanya menampilkan, tidak mengubah
#   bash deploy/pasang-server.sh 2gb --ya         # tanpa pertanyaan konfirmasi
#
# Jalankan sebagai user biasa yang punya sudo (bukan root), SESUDAH PHP-FPM dan
# database terpasang (deploy/DEPLOY.md langkah 1-2).
#
# Yang dikerjakan:
#   1. Swap (cadangan memori di disk) + vm.swappiness rendah.
#   2. 99-tartila.cnf di /etc/mysql/mariadb.conf.d (MySQL: conf.d) (memori, karakter, sql_mode) dan restart
#      database. Restart memutus koneksi website lama beberapa detik. Kalau
#      database gagal start dengan berkas ini, berkasnya dicabut otomatis.
#   3. Pool PHP-FPM tartila-v2 (jumlah worker sesuai profil) + OPcache.
#   4. Memuat ulang PHP-FPM.
# Tidak menyentuh Nginx, pool `www`, atau database website lama.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT/deploy/server"

PROFIL="${1:-}"
SIMULASI=0
YA=0
for arg in "${@:2}"; do
    case "$arg" in
        --simulasi) SIMULASI=1 ;;
        --ya) YA=1 ;;
        *) echo "Pilihan tidak dikenal: $arg"; exit 1 ;;
    esac
done

case "$PROFIL" in
    2gb) SWAP_GB=2; MAX_CHILDREN=5;  START=2; MIN_SPARE=1; MAX_SPARE=3 ;;
    8gb) SWAP_GB=2; MAX_CHILDREN=16; START=4; MIN_SPARE=4; MAX_SPARE=8 ;;
    *)
        echo "Pemakaian: bash deploy/pasang-server.sh 2gb|8gb [--simulasi] [--ya]"
        exit 1
        ;;
esac

# Menjalankan perintah, atau hanya menampilkannya saat --simulasi.
jalankan() {
    if [ "$SIMULASI" = 1 ]; then
        echo "   [simulasi] $*"
    else
        "$@"
    fi
}

# Menulis stdin ke berkas milik root, atau menampilkan tujuannya saat --simulasi.
tulis_ke() {
    local tujuan="$1"
    if [ "$SIMULASI" = 1 ]; then
        echo "   [simulasi] menulis $tujuan:"
        awk 'NR <= 12 { print "        | " $0 } END { if (NR > 12) print "        | ... (" NR " baris)" }'
    else
        sudo tee "$tujuan" > /dev/null
    fi
}

for berkas in "$SERVER_DIR/mariadb-$PROFIL.cnf" "$SERVER_DIR/php-tuning.ini" "$ROOT/deploy/php-fpm-pool-v2.conf"; do
    [ -f "$berkas" ] || { echo "GAGAL: $berkas tidak ada."; exit 1; }
done

PHPVER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
USER_PHP="${USER_PHP:-$(id -un)}"
GROUP_PHP="${GROUP_PHP:-$(id -gn 2>/dev/null || id -un)}"
RAM_MB="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)"

echo "Profil      : $PROFIL"
echo "PHP         : $PHPVER (pool berjalan sebagai $USER_PHP:$GROUP_PHP)"
echo "RAM terdeteksi: ${RAM_MB} MB"
if [ "$PROFIL" = 2gb ] && [ "$RAM_MB" -gt 3500 ]; then
    echo "CATATAN: RAM server ini lebih dari 3,5 GB; profil 8gb mungkin lebih cocok."
fi
if [ "$PROFIL" = 8gb ] && [ "$RAM_MB" -gt 0 ] && [ "$RAM_MB" -lt 6000 ]; then
    echo "PERINGATAN: RAM server ini hanya ${RAM_MB} MB; profil 8gb akan kehabisan memori. Gunakan 2gb."
    [ "$SIMULASI" = 1 ] || exit 1
fi

if [ "$SIMULASI" = 0 ] && [ "$YA" = 0 ]; then
    echo
    echo "Ini akan me-restart database (website lama terputus beberapa detik) dan"
    echo "memuat ulang PHP-FPM. Lanjutkan? [y/N]"
    read -r jawab
    case "$jawab" in y|Y|ya|YA) ;; *) echo "Dibatalkan."; exit 0 ;; esac
fi

# ------------------------------------------------------------------ 1. swap
echo
echo "==> 1/4 Swap"
if [ "$(swapon --show --noheadings 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "   Swap sudah ada, dibiarkan:"
    swapon --show 2>/dev/null | sed 's/^/   /'
else
    jalankan sudo fallocate -l "${SWAP_GB}G" /swapfile
    jalankan sudo chmod 600 /swapfile
    jalankan sudo mkswap /swapfile
    jalankan sudo swapon /swapfile
    if ! grep -q '^/swapfile' /etc/fstab 2>/dev/null; then
        if [ "$SIMULASI" = 1 ]; then
            echo "   [simulasi] menambah '/swapfile none swap sw 0 0' ke /etc/fstab"
        else
            echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab > /dev/null
        fi
    fi
fi
printf 'vm.swappiness=10\nvm.vfs_cache_pressure=50\n' | tulis_ke /etc/sysctl.d/99-tartila.conf
jalankan sudo sysctl --system > /dev/null 2>&1 || true

# --------------------------------------------------------------- 2. database
echo
echo "==> 2/4 Database (MariaDB/MySQL)"
# `systemctl cat` berhasil (kode 0) bila unit-nya ada. (Jangan pakai `systemctl ... | grep -q`:
# dengan `set -o pipefail`, grep yang berhenti lebih awal membuat pipa dianggap gagal.)
if systemctl cat mariadb.service > /dev/null 2>&1; then
    DB_SERVICE=mariadb
elif systemctl cat mysql.service > /dev/null 2>&1; then
    DB_SERVICE=mysql
else
    DB_SERVICE=""
fi

if [ -z "$DB_SERVICE" ]; then
    echo "   Layanan MariaDB/MySQL tidak ditemukan; langkah ini dilewati."
    echo "   (Pasang dulu: deploy/DEPLOY.md langkah 2, lalu jalankan skrip ini lagi.)"
else
    # MariaDB di Debian/Ubuntu membaca conf.d LEBIH DULU lalu mariadb.conf.d (yang memuat
    # 50-server.cnf dengan collation bawaan sendiri); berkas yang dibaca terakhir menang.
    # Karena itu berkas ini ditaruh di mariadb.conf.d bila ada (MySQL: conf.d).
    if [ -d /etc/mysql/mariadb.conf.d ]; then
        CNF=/etc/mysql/mariadb.conf.d/99-tartila.cnf
        # Buang salinan lama dari versi skrip sebelumnya (supaya tidak ganda).
        [ "$SIMULASI" = 1 ] || sudo rm -f /etc/mysql/conf.d/99-tartila.cnf
    else
        CNF=/etc/mysql/conf.d/99-tartila.cnf
        [ "$SIMULASI" = 1 ] || sudo mkdir -p /etc/mysql/conf.d
    fi
    CNF_LAMA=""
    if [ "$SIMULASI" = 0 ] && [ -f "$CNF" ]; then
        CNF_LAMA="$(mktemp)"
        sudo cp "$CNF" "$CNF_LAMA"
    fi
    tulis_ke "$CNF" < "$SERVER_DIR/mariadb-$PROFIL.cnf"
    [ "$SIMULASI" = 1 ] || sudo mkdir -p /var/log/mysql
    if [ "$SIMULASI" = 1 ]; then
        echo "   [simulasi] sudo systemctl restart $DB_SERVICE"
    elif sudo systemctl restart "$DB_SERVICE" && sleep 2 && systemctl is-active --quiet "$DB_SERVICE"; then
        echo "   $DB_SERVICE aktif dengan pengaturan baru."
    else
        echo "   GAGAL: $DB_SERVICE tidak mau start dengan $CNF. Mengembalikan..."
        if [ -n "$CNF_LAMA" ]; then sudo cp "$CNF_LAMA" "$CNF"; else sudo rm -f "$CNF"; fi
        sudo systemctl restart "$DB_SERVICE" || true
        echo "   Penyebab biasanya tertulis di:  sudo journalctl -u $DB_SERVICE -n 30 --no-pager"
        exit 1
    fi
fi

# --------------------------------------------------------- 3. PHP-FPM + OPcache
echo
echo "==> 3/4 PHP-FPM (pool tartila-v2) dan OPcache"
POOL_DIR="/etc/php/$PHPVER/fpm/pool.d"
CONF_DIR="/etc/php/$PHPVER/fpm/conf.d"
if [ ! -d "$POOL_DIR" ] && [ "$SIMULASI" = 0 ]; then
    echo "GAGAL: $POOL_DIR tidak ada. Pasang php$PHPVER-fpm dulu (DEPLOY.md langkah 1)."
    exit 1
fi

sed -e "s|__USER__|$USER_PHP|g" -e "s|__GROUP__|$GROUP_PHP|g" \
    -e "s/__MAX_CHILDREN__/$MAX_CHILDREN/g" -e "s/__START_SERVERS__/$START/g" \
    -e "s/__MIN_SPARE__/$MIN_SPARE/g" -e "s/__MAX_SPARE__/$MAX_SPARE/g" \
    "$ROOT/deploy/php-fpm-pool-v2.conf" | tulis_ke "$POOL_DIR/tartila-v2.conf"
tulis_ke "$CONF_DIR/90-tartila.ini" < "$SERVER_DIR/php-tuning.ini"

# ---------------------------------------------------------------- 4. muat ulang
echo
echo "==> 4/4 Memuat ulang PHP-FPM"
if [ "$SIMULASI" = 1 ]; then
    echo "   [simulasi] sudo php-fpm$PHPVER -t && sudo systemctl reload php$PHPVER-fpm"
else
    sudo "php-fpm$PHPVER" -t
    sudo systemctl reload "php$PHPVER-fpm"
fi

echo
echo "Selesai (profil $PROFIL): $MAX_CHILDREN worker PHP, database dan OPcache sudah disetel."
echo "Cek memori:  free -h    |  Cek pool:  ls /run/php/   |  Cek swap:  swapon --show"
echo "Lanjutkan ke deploy/DEPLOY.md langkah 3 (backend) kalau belum."
