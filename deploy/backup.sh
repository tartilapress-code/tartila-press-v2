#!/usr/bin/env bash
#
# Cadangan otomatis Tartila Press v2: database (setiap kali dijalankan) dan
# berkas unggahan storage/app (seminggu sekali), lalu membuang cadangan lama.
#
#   bash deploy/backup.sh                    # tujuan bawaan: ~/cadangan-tartila
#   bash deploy/backup.sh /mnt/disk/cadangan # tujuan lain
#
# Dijadwalkan lewat cron (DEPLOY.md bagian "Cadangan"), mis. tiap pukul 02:30:
#   30 2 * * * /bin/bash /var/www/tartila-press-v2/deploy/backup.sh >> $HOME/backup-tartila.log 2>&1
#
# Pengaturan lewat variabel lingkungan (semuanya opsional):
#   KEEP_DB_DAYS=14        simpan cadangan database selama 14 hari
#   KEEP_FILES_DAYS=35     simpan cadangan berkas selama 35 hari
#   FILES_WEEKDAY=7        hari cadangan berkas (1=Senin ... 7=Minggu); 0 = tiap hari
#   BACKUP_REMOTE=user@host:/folder/   salin juga ke server lain lewat rsync+SSH
#   ENV_FILE=/jalur/.env   berkas .env (bawaan: tartila-press_backend/.env)
#
# PENTING: cadangan yang hanya ada di server yang sama TIDAK menyelamatkan Anda
# kalau diska server rusak. Isi BACKUP_REMOTE, atau unduh folder cadangan secara
# berkala (mis. `scp -r user@server:~/cadangan-tartila .`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/tartila-press_backend"
ENV_FILE="${ENV_FILE:-$BACKEND/.env}"
DEST="${1:-$HOME/cadangan-tartila}"
KEEP_DB_DAYS="${KEEP_DB_DAYS:-14}"
KEEP_FILES_DAYS="${KEEP_FILES_DAYS:-35}"
FILES_WEEKDAY="${FILES_WEEKDAY:-7}"

[ -f "$ENV_FILE" ] || { echo "GAGAL: $ENV_FILE tidak ada."; exit 1; }

# Membaca satu nilai dari .env (tanpa tanda kutip dan spasi di ujung).
env_value() {
    grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" -e 's/[[:space:]]*$//'
}

DB_CONNECTION="$(env_value DB_CONNECTION)"
[ "$DB_CONNECTION" = "mysql" ] || [ "$DB_CONNECTION" = "mariadb" ] || { echo "GAGAL: skrip ini untuk MySQL/MariaDB (DB_CONNECTION=$DB_CONNECTION)."; exit 1; }
DB_HOST="$(env_value DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(env_value DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="$(env_value DB_DATABASE)"
DB_USERNAME="$(env_value DB_USERNAME)"
DB_PASSWORD="$(env_value DB_PASSWORD)"
[ -n "$DB_DATABASE" ] && [ -n "$DB_USERNAME" ] || { echo "GAGAL: DB_DATABASE/DB_USERNAME kosong di $ENV_FILE."; exit 1; }

STAMP="$(date +%F_%H%M)"
mkdir -p "$DEST"
chmod 700 "$DEST"

# Sandi lewat berkas sementara (bukan argumen perintah, yang terlihat di `ps`).
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' "$DB_HOST" "$DB_PORT" "$DB_USERNAME" "$DB_PASSWORD" > "$CNF"

# MySQL 8 butuh --no-tablespaces kalau user bukan admin; MariaDB tidak mengenalnya.
EXTRA=()
DUMP_HELP="$(mysqldump --help 2>/dev/null || true)"
if [[ "$DUMP_HELP" == *"--no-tablespaces"* ]]; then
    EXTRA+=(--no-tablespaces)
fi

echo "==> $(date '+%F %T') Database $DB_DATABASE"
DB_FILE="$DEST/db-$STAMP.sql.gz"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --skip-lock-tables \
    --routines --default-character-set=utf8mb4 "${EXTRA[@]}" "$DB_DATABASE" | gzip -9 > "$DB_FILE"
[ -s "$DB_FILE" ] || { echo "GAGAL: berkas cadangan database kosong."; rm -f "$DB_FILE"; exit 1; }
# Pastikan gzip utuh dan dump selesai (baris penutup ada).
gzip -t "$DB_FILE"
zcat "$DB_FILE" | tail -n 3 | grep -q "Dump completed" || { echo "GAGAL: dump database tidak lengkap."; exit 1; }
chmod 600 "$DB_FILE"
echo "    $(basename "$DB_FILE")  $(du -h "$DB_FILE" | cut -f1)"

if [ "$FILES_WEEKDAY" = "0" ] || [ "$(date +%u)" = "$FILES_WEEKDAY" ]; then
    echo "==> Berkas unggahan (storage/app)"
    FILES_FILE="$DEST/storage-$STAMP.tar.gz"
    tar -czf "$FILES_FILE" -C "$BACKEND" storage/app
    chmod 600 "$FILES_FILE"
    echo "    $(basename "$FILES_FILE")  $(du -h "$FILES_FILE" | cut -f1)"
else
    echo "==> Berkas unggahan dilewati (hanya pada hari ke-$FILES_WEEKDAY)."
fi

echo "==> Membuang cadangan lama"
find "$DEST" -maxdepth 1 -name 'db-*.sql.gz' -mtime +"$KEEP_DB_DAYS" -print -delete
find "$DEST" -maxdepth 1 -name 'storage-*.tar.gz' -mtime +"$KEEP_FILES_DAYS" -print -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
    echo "==> Menyalin ke $BACKUP_REMOTE"
    rsync -a --delete-after "$DEST"/ "$BACKUP_REMOTE"
fi

echo "==> Selesai. Isi $DEST:"
ls -lh "$DEST" | tail -n +2
echo "Ruang disk tersisa: $(df -h "$DEST" | awk 'NR==2 {print $4}')"
