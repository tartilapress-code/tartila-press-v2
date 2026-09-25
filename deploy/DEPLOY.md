# Deploy Tartila Press ke VPS

Panduan untuk server **Ubuntu + Nginx + PHP-FPM + PostgreSQL**, dengan kode di
`/var/www/tartila-press-v2`. Semua langkah sudah dicoba di komputer pengembang
(instalasi produksi Laravel, migrasi dari nol di PostgreSQL, build frontend),
tetapi belum di server Anda, jadi kalau ada langkah yang gagal, salin pesan
galatnya dan tanyakan.

Satu domain melayani semuanya:

| Alamat                  | Dilayani oleh                                           |
| ----------------------- | ------------------------------------------------------- |
| `https://DOMAIN/`       | Frontend React (`tartila-press-frontend/dist`)          |
| `https://DOMAIN/api/…`  | Backend Laravel (API + halaman katalog/abstrak Scholar) |
| `https://DOMAIN/storage/…` | Unggahan (cover, foto, PDF preview)                  |

Karena satu domain, tidak ada urusan CORS, dan halaman Google Scholar
(`/api/katalog`) berada di domain yang sama dengan situsnya.

Perintah dijalankan sebagai **user biasa yang punya sudo** (bukan root).

---

## 0. Backend harus ikut ke GitHub (sekali saja)

Folder `tartila-press_backend` masih repo git tersendiri di komputer Anda, jadi
repo utama hanya mencatatnya sebagai penanda kosong — itulah sebabnya foldernya
kosong setelah di-`clone` di server. Jadikan isinya bagian dari repo utama.

**Di komputer Anda** (PowerShell, dari folder proyek):

```powershell
cd "C:\Users\HP OMEN\Documents\NEW SOFTWARE_TARTILA PRESS"

# Riwayat git backend lama dipindah ke luar proyek (jadi cadangan, tidak dihapus).
Move-Item -Force tartila-press_backend\.git ..\tartila-press_backend.git-lama

# Buang penanda kosong, lalu tambahkan isi backend sebagai berkas biasa.
git rm --cached tartila-press_backend
git add -A

# Periksa: daftar ini TIDAK boleh memuat .env, vendor/, atau storage/logs.
git status --short | Select-String 'vendor|storage/logs|/\.env$'

git commit -m "Tambah backend dan berkas deploy"
git push
```

> Jangan `git push` dari folder backend dengan repo lamanya: remote-nya
> menunjuk ke repo GitHub yang sama dengan repo utama.

**Di server**, tarik kode terbarunya:

```bash
cd /var/www/tartila-press-v2
git checkout -- tartila-press-frontend/package-lock.json   # buang perubahan otomatis npm install
rmdir tartila-press_backend                                # folder kosong penanda lama
git pull
ls tartila-press_backend                                   # sekarang harus berisi app, config, dst.
```

---

## 1. Paket yang dibutuhkan

Cek yang sudah terpasang:

```bash
lsb_release -ds; php -v | head -1; composer --version; node -v; psql --version; nginx -v
```

Kebutuhan: **PHP 8.2 atau lebih baru**, **Node 20.19 atau lebih baru** (Vite 8),
PostgreSQL, Nginx, Composer.

Ubuntu 24.04 (PHP 8.3 bawaan):

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib git unzip composer certbot python3-certbot-nginx ufw \
  php-fpm php-cli php-pgsql php-mbstring php-xml php-curl php-zip php-bcmath php-intl
```

Ubuntu 22.04 (PHP bawaannya 8.1, terlalu lama) — tambahkan dulu repositori PHP:

```bash
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib git unzip composer certbot python3-certbot-nginx ufw \
  php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-intl
sudo update-alternatives --set php /usr/bin/php8.3     # supaya `php` di terminal memakai 8.3
php -v | head -1
```

Node 22 (kalau `node -v` kurang dari 20.19):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Mulai sesi ini, tentukan domain dan versi PHP (dipakai perintah-perintah berikut;
ulangi kalau sesi SSH terputus):

```bash
DOMAIN=tartilapress.com        # <- GANTI dengan domain Anda
PHPVER=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
echo "$DOMAIN  php$PHPVER"
```

Domain harus sudah diarahkan ke IP server (DNS *A record* untuk `DOMAIN` dan
`www.DOMAIN`) sebelum langkah HTTPS.

---

## 2. Database PostgreSQL

Buat sandi acak dan catat (dipakai lagi di `.env`):

```bash
openssl rand -base64 24
```

```bash
sudo -u postgres psql -c "CREATE USER tartila WITH PASSWORD 'GANTI_PASSWORD_DATABASE';"
sudo -u postgres psql -c "CREATE DATABASE tartila_press OWNER tartila;"
```

---

## 3. Backend (Laravel)

Ada dua jalan: **mulai dari kosong** (langkah ini sampai selesai), atau **membawa
data dari komputer lokal**: kerjakan sampai `storage:link`, lewati `migrate`,
`db:seed` dan pembuatan admin, lalu lanjut ke bagian 10.

```bash
cd /var/www/tartila-press-v2
cp deploy/backend.env.example tartila-press_backend/.env
nano tartila-press_backend/.env        # ganti semua yang berawalan GANTI_
chmod 600 tartila-press_backend/.env
```

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
composer install --no-dev --optimize-autoloader
php artisan key:generate --force
php artisan storage:link
php artisan migrate --force
php artisan db:seed --class=RoleSeeder --force
```

Peringatan `... does not comply with psr-4 autoloading standard ... Skipping`
saat `composer install` berasal dari berkas modul Publisher yang belum selesai;
aman diabaikan.

> **Jangan** menjalankan `php artisan db:seed` tanpa `--class=RoleSeeder`. Seeder
> bawaan membuat akun admin dengan sandi yang tertulis di kode
> (`admin@tartilapress.test` / `Tartila@2026`) dan akun `test@example.com`.

Buat akun admin dengan sandi Anda sendiri (ganti tiga nilai di dalam tanda kutip):

```bash
php artisan tinker --execute='$u = App\Models\User::create(["name" => "Admin Tartila Press", "email" => "admin@tartilapress.com", "password" => "GANTI_SANDI_ADMIN_YANG_KUAT"]); $u->markEmailAsVerified(); $u->roles()->attach(App\Models\Role::whereIn("name", ["user", "admin"])->pluck("id")); echo "Admin dibuat: ".$u->email.PHP_EOL;'
```

Terakhir, simpan konfigurasi ke cache (wajib diulang setiap `.env` diubah):

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

---

## 4. Frontend (build)

`tartila-press-frontend/.env` di repo berisi alamat lokal. Timpa di server dengan
`.env.production.local` (tidak ikut git):

```bash
cd /var/www/tartila-press-v2/tartila-press-frontend
echo "VITE_API_URL=https://$DOMAIN/api/v1" > .env.production.local
npm ci
npx vite build
```

Kenapa `npx vite build`, bukan `npm run build`? Skrip `build` menjalankan
`tsc -b` lebih dulu, dan itu masih gagal karena beberapa berkas lama yang belum
selesai (`BookFilter`, `BookSearchBar`, `InputField`, dst.). `vite build`
menghasilkan situs yang sama tanpa pemeriksaan itu.

Hasilnya ada di `tartila-press-frontend/dist`. Kalau proses terhenti sendiri
("Killed"), memori server kurang: lihat *Masalah umum* (menambah swap).

---

## 5. PHP-FPM dan Nginx

PHP-FPM dijalankan sebagai user Anda sendiri, supaya berkas yang dibuat
`php artisan` (log, cache) dan yang dibuat situs (unggahan) dimiliki user yang
sama dan tidak ada galat "permission denied". Batas unggah dinaikkan agar PDF
preview (20 MB) bisa diunggah.

```bash
sudo sed -i "s/^user = .*/user = $USER/; s/^group = .*/group = $USER/" /etc/php/$PHPVER/fpm/pool.d/www.conf
printf 'upload_max_filesize = 25M\npost_max_size = 30M\nmemory_limit = 256M\nmax_execution_time = 60\n' | sudo tee /etc/php/$PHPVER/fpm/conf.d/99-tartila.ini
sudo systemctl restart php$PHPVER-fpm
```

Nginx:

```bash
cd /var/www/tartila-press-v2
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PHPVER__/$PHPVER/g" deploy/nginx-tartila-press.conf | sudo tee /etc/nginx/sites-available/tartila-press > /dev/null
sudo ln -sf /etc/nginx/sites-available/tartila-press /etc/nginx/sites-enabled/tartila-press
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` harus berakhir dengan `syntax is ok` dan `test is successful`.

Firewall (izinkan SSH lebih dulu supaya tidak terkunci di luar):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## 6. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
sudo certbot renew --dry-run
```

Certbot menambah blok HTTPS dan pengalihan `http → https` ke konfigurasi Nginx,
dan memperpanjang sertifikat otomatis. Tanpa domain (hanya IP), lewati langkah
ini, isi `APP_URL`/`FRONTEND_URL`/`VITE_API_URL` dengan `http://IP_SERVER`, dan
ulangi build (langkah 4).

---

## 7. Jadwal otomatis (cron)

Ada dua tugas harian (mengembalikan proyek Book Chapter yang kedaluwarsa dan
mengonfirmasi otomatis pengiriman buku). Laravel hanya menjalankannya kalau
`schedule:run` dipanggil tiap menit:

```bash
(crontab -l 2>/dev/null; echo "* * * * * cd /var/www/tartila-press-v2/tartila-press_backend && php artisan schedule:run >> /dev/null 2>&1") | crontab -
crontab -l
```

Tidak perlu worker antrean: aplikasi ini tidak memakai queue.

---

## 8. Cek hasilnya

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://$DOMAIN/
curl -s https://$DOMAIN/api/v1/books | head -c 200; echo
curl -s -o /dev/null -w "%{http_code}\n" https://$DOMAIN/api/katalog
```

Harus berturut-turut: `200`, JSON `{"success":true,...}`, `200`. Lalu di browser:

1. Buka `https://DOMAIN`, ganti bahasa, buka beberapa halaman (alamat langsung
   seperti `/buku` juga harus terbuka, bukan 404).
2. Login sebagai admin, tambah buku dan **unggah cover + PDF preview** (menguji
   izin folder dan batas unggah), lalu buka buku itu dan geser sampulnya
   (menguji flipbook).
3. Daftar akun baru dan lihat apakah email verifikasi sampai (lihat bagian 9).

---

## 9. Email (SMTP)

Selama `MAIL_MAILER=log`, email verifikasi/reset password **tidak terkirim**.
Isi `MAIL_*` di `tartila-press_backend/.env` (contoh Gmail ada di berkas itu),
ubah `MAIL_MAILER=smtp`, lalu:

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan config:cache
```

Biarkan `REQUIRE_VERIFIED_EMAIL=false` sampai email terbukti terkirim; kalau
`true`, akun yang emailnya belum diverifikasi tidak bisa membuat pesanan,
mendaftar event, atau menulis artikel/komentar.

---

## 10. Membawa data dari komputer lokal (opsional)

Lewati bagian ini kalau situs boleh mulai dari kosong. Kalau ingin membawa buku,
artikel, event, pesanan, dan akun yang sudah ada:

**Di komputer Anda** (PowerShell). `-U` adalah `DB_USERNAME` di `.env` lokal:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -U postgres -d tartila_press_v2 --no-owner --no-acl -f tartila_press.sql
scp tartila_press.sql USER@IP_SERVER:~/
scp -r "tartila-press_backend\storage\app\public" USER@IP_SERVER:/var/www/tartila-press-v2/tartila-press_backend/storage/app/
scp -r "tartila-press_backend\storage\app\private" USER@IP_SERVER:/var/www/tartila-press-v2/tartila-press_backend/storage/app/
```

`public` berisi cover/foto/PDF preview (±32 MB), `private` berisi naskah pengguna
(±28 MB).

**Di server**: pulihkan ke database yang masih **kosong** (belum di-`migrate`;
kalau sudah terlanjur, hapus dan buat ulang: `sudo -u postgres psql -c "DROP
DATABASE tartila_press;"` lalu `CREATE DATABASE` seperti di langkah 2). Pulihkan
sebagai user `tartila` supaya tabelnya dimiliki user itu:

```bash
psql -h 127.0.0.1 -U tartila -d tartila_press -f ~/tartila_press.sql
```

Peringatan seperti `unrecognized configuration parameter "transaction_timeout"`
atau `invalid command \restrict` karena versi PostgreSQL berbeda boleh diabaikan.
Sesudah itu:

```bash
cd /var/www/tartila-press-v2
psql -h 127.0.0.1 -U tartila -d tartila_press -v base="https://$DOMAIN" -f deploy/ganti-url-lokal.sql
cd tartila-press_backend && php artisan migrate --force
```

**Wajib**, database lokal membawa akun bawaan seeder. Ganti/hapus segera:

```bash
php artisan tinker --execute='$a = App\Models\User::where("email", "admin@tartilapress.test")->first(); if ($a) { $a->tokens()->delete(); $a->update(["email" => "admin@tartilapress.com", "password" => "GANTI_SANDI_ADMIN_YANG_KUAT"]); } App\Models\User::where("email", "test@example.com")->delete(); echo "Selesai".PHP_EOL;'
```

---

## 11. Memperbarui situs di kemudian hari

Setelah `git push` dari komputer Anda:

```bash
cd /var/www/tartila-press-v2
bash deploy/deploy.sh
```

Skrip itu menjalankan `git pull`, `composer install`, migrasi database, cache
Laravel, build frontend, dan memuat ulang PHP-FPM.

---

## Masalah umum

- **Halaman putih / galat 500 dari API** — lihat log:
  `tail -n 60 /var/www/tartila-press-v2/tartila-press_backend/storage/logs/laravel-*.log`
  dan `sudo tail -n 30 /var/log/nginx/error.log`.
- **502 Bad Gateway** — PHP-FPM mati atau versi soket salah:
  `ls /run/php/` lalu `sudo systemctl status php$PHPVER-fpm`.
- **Mengubah `.env` tidak berpengaruh** — konfigurasi di-cache:
  `cd tartila-press_backend && php artisan config:cache`.
- **"Permission denied" di `storage` atau `bootstrap/cache`** —
  `sudo chown -R $USER:$USER tartila-press_backend/storage tartila-press_backend/bootstrap/cache`
  lalu `chmod -R ug+rwX` pada dua folder itu.
- **Gambar/PDF unggahan 404** — tautan `public/storage` belum ada:
  `php artisan storage:link`.
- **Unggah gagal (413 / "terlalu besar")** — periksa `client_max_body_size` di
  Nginx dan `upload_max_filesize`/`post_max_size` di
  `/etc/php/$PHPVER/fpm/conf.d/99-tartila.ini`, lalu restart PHP-FPM dan Nginx.
- **Build frontend "Killed"** — memori kurang. Tambah swap 2 GB lalu ulangi:
  `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
- **Build frontend menolak versi Node** — `node -v` harus 20.19+ (lihat langkah 1).
- **`git pull` menolak karena `package-lock.json` berubah** —
  `git checkout -- tartila-press-frontend/package-lock.json` (gunakan `npm ci`,
  bukan `npm install`, di server).

## Cadangan (backup)

Yang perlu dicadangkan: database dan folder `tartila-press_backend/storage/app`
(unggahan dan naskah). Contoh manual:

```bash
pg_dump -h 127.0.0.1 -U tartila -d tartila_press --no-owner --no-acl -f ~/tartila_press-$(date +%F).sql
tar -czf ~/storage-$(date +%F).tar.gz -C /var/www/tartila-press-v2/tartila-press_backend/storage app
```
