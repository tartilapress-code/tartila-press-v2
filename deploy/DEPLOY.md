# Deploy Tartila Press v2 ke VPS

Panduan untuk server **Ubuntu + Nginx + PHP-FPM**, dengan kode di
`/var/www/tartila-press-v2`, di server yang **sudah menjalankan website lama**
(`/var/www/tartila-press`, database MySQL). Langkah-langkahnya sudah dicoba di
komputer pengembang (instalasi produksi Laravel, migrasi dari nol di MySQL/MariaDB
dan PostgreSQL, pemindahan data lokal, build frontend), tetapi belum di server
Anda, jadi kalau ada langkah yang gagal, salin pesan galatnya dan tanyakan.

Satu alamat melayani semuanya:

| Alamat                     | Dilayani oleh                                           |
| -------------------------- | ------------------------------------------------------- |
| `https://DOMAIN/`          | Frontend React (`tartila-press-frontend/dist`)          |
| `https://DOMAIN/api/…`     | Backend Laravel (API + halaman katalog/abstrak Scholar) |
| `https://DOMAIN/storage/…` | Unggahan (cover, foto, PDF preview)                     |

Karena satu alamat, tidak ada urusan CORS, dan halaman Google Scholar
(`/api/katalog`) berada di domain yang sama dengan situsnya.

**Urutan**: 0 → 1 → 2 → 3 → 4 → 5 → 8 (uji coba di port 8080) → 6 (pindah ke
domain) → 7 → 9. Bagian 10 (membawa data lokal) dikerjakan di tengah langkah 3,
hanya kalau data lokal ingin ikut.

Perintah dijalankan sebagai **user biasa yang punya sudo** (bukan root).

---

## Website lama di server yang sama

Website lama dan v2 bisa berjalan berdampingan: foldernya berbeda. Yang bisa
bentrok kalau panduan ini diikuti sembarangan, dan cara panduan ini
menghindarinya:

| Yang bisa bentrok                                | Cara menghindarinya di panduan ini                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Berkas Nginx website lama (mis. `tartila-press`) | v2 memakai berkas bernama `tartila-press-v2`; berkas lama tidak disentuh           |
| Pengaturan PHP-FPM bersama (`www.conf`)          | v2 memakai pool PHP-FPM **sendiri** (`tartila-v2`); `www.conf` tidak diubah        |
| Domain + HTTPS yang sudah dipakai website lama   | v2 diuji dulu di port **8080**; pindah domain di langkah 6 (ada cara kembali)      |
| Database                                         | v2 memakai database **sendiri**; database website lama tidak disentuh              |
| Jadwal cron                                      | v2 menambah barisnya sendiri; baris website lama dibiarkan                         |

Sebelum mulai, kumpulkan gambaran server (perintah ini hanya membaca, tidak
mengubah apa pun):

```bash
echo "== Nginx:"; ls /etc/nginx/sites-enabled/; grep -RhE "server_name|^\s*root |fastcgi_pass" /etc/nginx/sites-enabled/; echo "== PHP:"; php -v | head -1; ls /usr/bin/php* /run/php/; php -m | grep -iE "pdo_mysql|pdo_pgsql|mbstring|curl|zip|xml"; echo "== MySQL:"; mysql --version; echo "== HTTPS:"; certbot --version 2>&1 | head -1; echo "== cron:"; crontab -l 2>&1 | grep -v '^#'; echo "== memori/disk:"; free -h | head -2; df -h / | tail -1
```

---

## 0. Backend harus ikut ke GitHub (sekali saja)

Folder `tartila-press_backend` masih repo git tersendiri di komputer Anda, jadi
repo utama hanya mencatatnya sebagai penanda kosong — itulah sebabnya foldernya
kosong setelah di-`clone` di server. Jadikan isinya bagian dari repo utama.

> **Kalau ini sudah dikerjakan** (ada commit "Tambah backend dan berkas deploy" di
> GitHub), lewati ke langkah 1; di server cukup `git pull` setiap ada perubahan.

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
lsb_release -ds; php -v | head -1; composer --version; node -v; nginx -v
```

Kebutuhan:

- **PHP 8.2 atau lebih baru** (Laravel 12 tidak jalan di PHP 8.1)
- **Node 20.19 atau lebih baru** (Vite 8)
- Nginx, Composer, git
- Ekstensi PHP: `mbstring`, `xml`, `curl`, `zip`, dan **satu** driver database:
  `pdo_mysql` (MySQL/MariaDB) atau `pdo_pgsql` (PostgreSQL)

Tentukan domain dan versi PHP yang SUDAH terpasang (dipakai perintah-perintah
berikut; ulangi kalau sesi SSH terputus):

```bash
DOMAIN=tartilapress.com        # <- GANTI dengan domain/subdomain untuk v2
PHPVER=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
echo "$DOMAIN  php$PHPVER"
```

`PHPVER` harus 8.2 atau lebih. Kalau server punya beberapa versi PHP (mis. 8.1
untuk website lama dan 8.2), `php` di terminal bisa menunjuk ke yang lama:

```bash
ls /usr/bin/php*
sudo update-alternatives --set php /usr/bin/php8.2
```

Lihat ekstensi mana yang belum ada:

```bash
for m in pdo_mysql pdo_pgsql mbstring xml curl zip; do php -m | grep -qix "$m" && echo "ada     $m" || echo "belum   $m"; done
```

(`pdo_mysql` dan `pdo_pgsql` tidak perlu dua-duanya; cukup yang sesuai pilihan
database di langkah 2.) Pasang yang kurang; apt melewati yang sudah terpasang.
Ekstensi harus sekelompok dengan PHP Anda, karena itu memakai `$PHPVER`:

```bash
sudo apt update
sudo apt install -y php$PHPVER-fpm php$PHPVER-cli php$PHPVER-mbstring php$PHPVER-xml php$PHPVER-curl php$PHPVER-zip php$PHPVER-mysql
```

(Untuk PostgreSQL ganti `php$PHPVER-mysql` dengan `php$PHPVER-pgsql`.) Kalau apt
menjawab `Unable to locate package` untuk paket `php8.2-…`, berarti repositori
PHP 8.2 belum/tidak lagi terpasang di server ini; kirim hasil perintah berikut:

```bash
dpkg -l | grep -E "^ii +php"; ls /etc/apt/sources.list.d/; apt-cache policy php$PHPVER-cli
```

Kalau PHP masih 8.1 dan tidak ada 8.2 sama sekali, tambahkan repositori PHP
(berada di Launchpad; beberapa server tidak bisa menjangkaunya), lalu ulangi
`apt install` di atas dengan `PHPVER=8.2`:

```bash
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update
```

Kalau Node kurang dari 20.19:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Domain harus sudah diarahkan ke IP server (DNS *A record* untuk `DOMAIN`, dan
`www.DOMAIN` kalau dipakai) sebelum langkah HTTPS.

---

## 2. Database: pilih MySQL atau PostgreSQL

| | MySQL / MariaDB | PostgreSQL |
| --- | --- | --- |
| Cocok kalau | Server sudah punya MySQL (website lama memakainya); tidak mau memasang server database baru | Ingin sama persis dengan komputer pengembangan |
| Paket PHP | `php$PHPVER-mysql` | `php$PHPVER-pgsql` (dari repositori PHP di Launchpad) |
| Pengujian | Diuji di MariaDB 10.4: migrasi dari nol, 420 dari 421 tes lulus (1 tes gagal hanya karena tes itu mengira `id` = 1, dan lulus kalau dijalankan sendiri), API jalan dengan data hasil pemindahan. MySQL 8 belum diuji. | Database pengembangan; diuji penuh |
| Data lokal | Bisa dibawa lewat `deploy/pg-ke-mysql.php` (bagian 10A; 40 tabel, 472 baris identik) | Bisa dibawa lewat `pg_dump` (bagian 10B) |

Keduanya bisa berdampingan dengan MySQL website lama: database v2 selalu
**terpisah**. Yang dipilih di sini harus sama dengan blok database di `.env`
(langkah 3).

### 2A. MySQL / MariaDB

Buat database dan user khusus v2 (`sudo mysql` bekerja kalau root MySQL memakai
login sistem; kalau Anda dulu memberi root sandi, pakai `mysql -u root -p`):

```bash
sudo mysql -e "CREATE DATABASE tartila_press_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'tartila_v2'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_DATABASE';"
sudo mysql -e "GRANT ALL PRIVILEGES ON tartila_press_v2.* TO 'tartila_v2'@'localhost'; FLUSH PRIVILEGES;"
```

Pastikan ekstensinya ada (harus menampilkan `pdo_mysql`):

```bash
php -m | grep pdo_mysql
```

### 2B. PostgreSQL 18

Dari repositori resmi PostgreSQL, supaya sama dengan komputer pengembangan:

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-18 php$PHPVER-pgsql
psql --version
```

Kalau `php$PHPVER-pgsql` tidak ditemukan, paket itu berasal dari repositori PHP
di Launchpad (`ppa:ondrej/php`), yang bisa saja tidak terjangkau dari server ini.
Coba dulu tes ini:

```bash
curl -sS -o /dev/null -w "kode HTTP: %{http_code}\n" --max-time 10 https://ppa.launchpadcontent.net/ondrej/php/ubuntu/dists/jammy/Release
getent hosts ppa.launchpadcontent.net
```

Kalau hasilnya `kode HTTP: 200`, Launchpad terjangkau -- ulangi
`sudo apt update && sudo apt install -y php$PHPVER-pgsql`. Kalau kosong/timeout
atau `getent` tidak menemukan alamatnya, Launchpad memang tidak terjangkau dari
server ini; ada dua jalan lain:

**A. Unduh paketnya lewat komputer Anda, lalu kirim ke server.** Cari dulu versi
PHP yang sudah terpasang di server (nomornya harus PERSIS sama dengan paket yang
diunduh):

```bash
dpkg -s php$PHPVER-common | grep ^Version
```

Buka `https://launchpad.net/~ondrej/+archive/ubuntu/php/+packages` di browser
komputer Anda, filter arsitektur `amd64` dan seri `jammy`, cari
`php$PHPVER-pgsql` dengan nomor versi yang sama persis, unduh berkas `.deb`-nya.
Kalau tidak ada nomor yang cocok persis, jangan dipaksakan -- pakai jalan B.

```powershell
scp Downloads\php8.2-pgsql_*_amd64.deb USER@IP_SERVER:~/
```

```bash
sudo apt install -y ~/php8.2-pgsql_*_amd64.deb
php -m | grep pgsql
```

(`apt install ./berkas.deb`, bukan `dpkg -i`, supaya dependensinya ikut dicari
dari repositori yang sudah terpasang di server.)

**B. Pakai MySQL untuk v2** (bagian 2A) -- paket `php$PHPVER-mysql` biasanya
sudah ada tanpa perlu Launchpad sama sekali, karena website lama memakainya.
Data lokal tetap bisa dibawa lewat `deploy/pg-ke-mysql.php` (bagian 10A).

Kalau salah satu di atas berhasil dan `php -m | grep pgsql` menampilkan
`pgsql`/`pdo_pgsql`, lanjutkan di sini. Buat databasenya:

```bash
openssl rand -base64 24
```

```bash
sudo -u postgres psql -c "CREATE USER tartila WITH PASSWORD 'GANTI_PASSWORD_DATABASE';"
sudo -u postgres psql -c "CREATE DATABASE tartila_press OWNER tartila;"
```

---

## 3. Backend (Laravel)

### 3.1 Pasang

```bash
cd /var/www/tartila-press-v2
cp deploy/backend.env.example tartila-press_backend/.env
nano tartila-press_backend/.env        # ganti semua yang berawalan GANTI_, dan pilih blok database A (MySQL) atau B (PostgreSQL)
chmod 600 tartila-press_backend/.env
```

Untuk **uji coba lewat IP + port 8080** (langkah 5), isi `APP_URL` dan
`FRONTEND_URL` dengan `http://IP_SERVER:8080`. Alamat sebenarnya diisi saat
pindah (langkah 6). IP server: `hostname -I`.

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
composer install --no-dev --optimize-autoloader
php artisan key:generate --force
php artisan storage:link
```

Peringatan `... does not comply with psr-4 autoloading standard ... Skipping`
saat `composer install` berasal dari berkas modul Publisher yang belum selesai;
aman diabaikan.

### 3.2 Isi database: pilih SATU jalan

**Mulai dari kosong** (tanpa data dari komputer lokal): jalankan perintah di
bawah, lalu lanjut ke 3.3.

```bash
php artisan migrate --force
php artisan db:seed --class=RoleSeeder --force
```

> **Jangan** menjalankan `php artisan db:seed` tanpa `--class=RoleSeeder`. Seeder
> bawaan membuat akun admin dengan sandi yang tertulis di kode
> (`admin@tartilapress.test` / `Tartila@2026`) dan akun `test@example.com`.

Buat akun admin dengan sandi Anda sendiri (ganti nilai `GANTI_…` dan email di
dalam tanda kutip; sandinya jangan memuat tanda kutip `'` atau `"`):

```bash
php artisan tinker --execute='$u = App\Models\User::create(["name" => "Admin Tartila Press", "email" => "admin@tartilapress.com", "password" => "GANTI_SANDI_ADMIN_YANG_KUAT"]); $u->markEmailAsVerified(); $u->roles()->attach(App\Models\Role::whereIn("name", ["user", "admin"])->pluck("id")); echo "Admin dibuat: ".$u->email.PHP_EOL;'
```

**Membawa data dari komputer lokal**: LEWATI perintah di atas (data lokal sudah
berisi peran dan akun) dan kerjakan **bagian 10** (10A untuk MySQL, 10B untuk
PostgreSQL), lalu kembali ke 3.3.

### 3.3 Simpan konfigurasi ke cache

Wajib diulang setiap `.env` diubah:

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

---

## 4. Frontend (build)

`tartila-press-frontend/.env` di repo berisi alamat lokal. Timpa di server dengan
`.env.production.local` (tidak ikut git). Untuk uji coba isinya alamat IP + port;
saat pindah domain (langkah 6) diganti dan di-build ulang:

```bash
cd /var/www/tartila-press-v2/tartila-press-frontend
echo "VITE_API_URL=http://$(hostname -I | awk '{print $1}'):8080/api/v1" > .env.production.local
cat .env.production.local
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

## 5. PHP-FPM dan Nginx (uji coba di port 8080)

**Pool PHP-FPM khusus v2.** Berjalan sebagai user Anda sendiri, supaya berkas yang
dibuat `php artisan` (log, cache) dan yang dibuat situs (unggahan) dimiliki user
yang sama dan tidak ada galat "permission denied". Pool bawaan (`www`) yang
dipakai website lama tidak diubah. Batas unggah untuk PDF preview (20 MB) juga
diatur di pool ini.

```bash
cd /var/www/tartila-press-v2
sed -e "s/__USER__/$USER/g" -e "s/__GROUP__/$(id -gn)/g" deploy/php-fpm-pool-v2.conf | sudo tee /etc/php/$PHPVER/fpm/pool.d/tartila-v2.conf > /dev/null
sudo php-fpm$PHPVER -t
sudo systemctl reload php$PHPVER-fpm
ls /run/php/
```

`php-fpm -t` harus menyebut `test is successful`, dan `/run/php/` harus memuat
`tartila-v2.sock`. (`reload` tidak mengganggu website lama.)

**Nginx**, berkas baru bernama `tartila-press-v2`:

```bash
sed -e "s|__LISTEN__|8080|g" -e "s|__SERVER_NAME__|_|g" -e "s|__PHPSOCK__|/run/php/tartila-v2.sock|g" deploy/nginx-tartila-press-v2.conf | sudo tee /etc/nginx/sites-available/tartila-press-v2 > /dev/null
sudo ln -sf /etc/nginx/sites-available/tartila-press-v2 /etc/nginx/sites-enabled/tartila-press-v2
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` harus berakhir dengan `syntax is ok` dan `test is successful`; kalau
tidak, JANGAN `reload` dulu dan kirim pesannya. Kalau server memakai firewall
(`sudo ufw status`), buka port ujinya, dan cek juga firewall di panel penyedia
VPS:

```bash
sudo ufw allow 8080/tcp
```

Buka `http://IP_SERVER:8080` di browser. Website lama tetap di alamat lamanya.
Cek juga dari terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s http://127.0.0.1:8080/api/v1/books | head -c 200; echo
```

Harus `200` dan JSON `{"success":true,...}`.

> Kalau data lokal dibawa (bagian 10) dengan `--base` berupa alamat domain, gambar
> di uji coba ini tampak rusak: alamatnya sudah diarahkan ke domain, yang belum
> menyajikan v2. Itu wajar dan pulih setelah pindah domain (langkah 6). Unggahan
> yang dibuat selama uji coba ini juga menyimpan alamat `http://IP:8080/…`, jadi
> hapus saja setelah selesai menguji.

---

## 6. Pindah ke domain + HTTPS

Kerjakan setelah v2 terbukti jalan di port 8080 (langkah 8). Ada dua pilihan.

### 6A. Domain atau subdomain BARU (paling aman)

Cocok kalau v2 memakai nama berbeda dari website lama (mis.
`baru.tartilapress.com`), sementara website lama tetap berjalan. Tambahkan dulu
*A record* untuk nama itu di DNS, ke IP server yang sama, lalu:

```bash
cd /var/www/tartila-press-v2
sed -e "s|__LISTEN__|80|g" -e "s|__SERVER_NAME__|$DOMAIN|g" -e "s|__PHPSOCK__|/run/php/tartila-v2.sock|g" deploy/nginx-tartila-press-v2.conf | sudo tee /etc/nginx/sites-available/tartila-press-v2 > /dev/null
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d $DOMAIN
```

### 6B. Menggantikan website lama di domain yang sama

Pindahnya hanya mengganti berkas Nginx yang aktif, jadi cepat, dan website lama
bisa dikembalikan.

1. **Catat berkas Nginx website lama** (nama di `sites-enabled`, mis.
   `tartila-press`) dan cadangkan:

   ```bash
   ls /etc/nginx/sites-enabled/
   ```

   ```bash
   sudo cp /etc/nginx/sites-available/NAMA_BERKAS_LAMA ~/nginx-website-lama.conf.bak
   ```

2. **Pasang berkas Nginx untuk domain** (menimpa berkas uji coba `tartila-press-v2`):

   ```bash
   cd /var/www/tartila-press-v2
   sed -e "s|__LISTEN__|80|g" -e "s|__SERVER_NAME__|$DOMAIN www.$DOMAIN|g" -e "s|__PHPSOCK__|/run/php/tartila-v2.sock|g" deploy/nginx-tartila-press-v2.conf | sudo tee /etc/nginx/sites-available/tartila-press-v2 > /dev/null
   ```

3. **Matikan website lama, nyalakan v2**. Yang dihapus hanya tautan di
   `sites-enabled`; berkasnya, foldernya, dan databasenya tetap ada:

   ```bash
   sudo rm /etc/nginx/sites-enabled/NAMA_BERKAS_LAMA
   ```

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **HTTPS**. Kalau website lama sudah punya sertifikat untuk domain ini, certbot
   menawarkan "reinstall the existing certificate": pilih itu.

   ```bash
   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
   ```

**Mengembalikan website lama** (kalau ada masalah), tanpa kehilangan apa pun:

```bash
sudo rm /etc/nginx/sites-enabled/tartila-press-v2
```

```bash
sudo ln -s /etc/nginx/sites-available/NAMA_BERKAS_LAMA /etc/nginx/sites-enabled/NAMA_BERKAS_LAMA
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Sesudah 6A atau 6B

Kalau `certbot` belum ada dan apt tidak menemukannya, pasang lewat snap:

```bash
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

Isi alamat sebenarnya: ubah `APP_URL` dan `FRONTEND_URL` di
`tartila-press_backend/.env` menjadi `https://DOMAIN`, lalu:

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan config:cache
```

Ganti isi `tartila-press-frontend/.env.production.local` menjadi
`VITE_API_URL=https://DOMAIN/api/v1`, lalu build ulang:

```bash
cd /var/www/tartila-press-v2/tartila-press-frontend
echo "VITE_API_URL=https://$DOMAIN/api/v1" > .env.production.local
npx vite build
```

Pembaruan sertifikat otomatis sudah diatur certbot; cek dengan
`sudo certbot renew --dry-run`. Tutup port uji coba kalau tadi dibuka:
`sudo ufw delete allow 8080/tcp`.

Tanpa domain (hanya IP), lewati bagian ini dan tetap pakai `http://IP:8080`.

---

## 7. Jadwal otomatis (cron)

Ada dua tugas harian (mengembalikan proyek Book Chapter yang kedaluwarsa dan
mengonfirmasi otomatis pengiriman buku). Laravel hanya menjalankannya kalau
`schedule:run` dipanggil tiap menit. Baris ini **menambah**; baris website lama
(kalau ada) tetap:

```bash
(crontab -l 2>/dev/null; echo "* * * * * cd /var/www/tartila-press-v2/tartila-press_backend && php artisan schedule:run >> /dev/null 2>&1") | crontab -
crontab -l
```

Tidak perlu worker antrean: aplikasi ini tidak memakai queue.

---

## 8. Cek hasilnya

Ganti `ALAMAT` dengan `127.0.0.1:8080` (uji coba) atau `https://$DOMAIN`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" ALAMAT/
curl -s ALAMAT/api/v1/books | head -c 200; echo
curl -s -o /dev/null -w "%{http_code}\n" ALAMAT/api/katalog
```

Harus berturut-turut: `200`, JSON `{"success":true,...}`, `200`. Lalu di browser:

1. Buka situsnya, ganti bahasa, buka beberapa halaman (alamat langsung seperti
   `/buku` juga harus terbuka, bukan 404).
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

Lewati bagian ini kalau situs boleh mulai dari kosong. Yang ikut dibawa: semua
isi database lokal (buku, artikel, event, paket, layanan, profil, **pengguna,
pesanan**, dan seterusnya) serta berkas unggahan. Tidak ikut: token login, sesi,
cache, dan antrean, jadi semua orang cukup login ulang. Database lokal juga berisi
akun dan pesanan uji (mis. akun berakhiran `@example.com`); bersihkan lewat panel
admin sesudahnya, atau mulai dari kosong kalau tidak diinginkan.

**Berkas unggahan** (sama untuk 10A dan 10B). Dari komputer Anda (PowerShell,
folder proyek); `USER` adalah user login server:

```powershell
cd "C:\Users\HP OMEN\Documents\NEW SOFTWARE_TARTILA PRESS"
scp -r tartila-press_backend\storage\app\public USER@IP_SERVER:/var/www/tartila-press-v2/tartila-press_backend/storage/app/
scp -r tartila-press_backend\storage\app\private USER@IP_SERVER:/var/www/tartila-press-v2/tartila-press_backend/storage/app/
```

`public` berisi cover/foto/PDF preview (±32 MB), `private` berisi naskah pengguna
(±28 MB).

### 10A. MySQL (dari PostgreSQL lokal)

Berkas `deploy/pg-ke-mysql.php` membaca database lokal (hanya membaca) dan menulis
berkas SQL untuk MySQL. `--base` adalah alamat **akhir** situs; alamat gambar
lokal (`http://127.0.0.1:8000/…`) otomatis diganti dengannya.

**Di komputer Anda** (PowerShell):

```powershell
cd "C:\Users\HP OMEN\Documents\NEW SOFTWARE_TARTILA PRESS\tartila-press_backend"
php ..\deploy\pg-ke-mysql.php --base=https://DOMAIN_ANDA --out=..\tartila_press_mysql.sql
```

```powershell
scp ..\tartila_press_mysql.sql USER@IP_SERVER:~/
```

Skrip menampilkan jumlah baris tiap tabel dan total alamat yang diganti. Kalau ia
melaporkan "PERHATIAN: masih ada teks berisi 127.0.0.1/localhost", kirim daftarnya.

**Di server**: buat tabelnya dulu, lalu muat datanya. Databasenya harus baru dan
kosong; seluruh isi dimuat dalam satu transaksi, jadi kalau ada galat tidak ada
data setengah jadi yang tersisa.

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan migrate --force
mysql -u tartila_v2 -p tartila_press_v2 < ~/tartila_press_mysql.sql
```

Tidak ada keluaran = berhasil. Kalau muncul `Duplicate entry`, databasenya belum
kosong (mis. `RoleSeeder` sudah terlanjur dijalankan); kosongkan lalu ulangi:

```bash
sudo mysql -e "DROP DATABASE tartila_press_v2; CREATE DATABASE tartila_press_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Lalu kembali ke `migrate` + `mysql < …` di atas.

### 10B. PostgreSQL

**Di komputer Anda** (PowerShell). `-U` adalah `DB_USERNAME` di `.env` lokal:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -U postgres -d tartila_press_v2 --no-owner --no-acl -f tartila_press.sql
scp tartila_press.sql USER@IP_SERVER:~/
```

**Di server**: pulihkan ke database yang masih **kosong** (belum di-`migrate`;
kalau sudah terlanjur, hapus dan buat ulang: `sudo -u postgres psql -c "DROP
DATABASE tartila_press;"` lalu `CREATE DATABASE` seperti di langkah 2B). Pulihkan
sebagai user `tartila` supaya tabelnya dimiliki user itu:

```bash
psql -h 127.0.0.1 -U tartila -d tartila_press -f ~/tartila_press.sql
```

Peringatan seperti `unrecognized configuration parameter "transaction_timeout"`
atau `invalid command \restrict` karena versi PostgreSQL berbeda boleh diabaikan.
Sesudah itu ganti alamat gambar lokal dengan alamat akhir situs, dan jalankan
migrasi (kalau ada yang baru):

```bash
cd /var/www/tartila-press-v2
psql -h 127.0.0.1 -U tartila -d tartila_press -v base="https://$DOMAIN" -f deploy/ganti-url-lokal.sql
cd tartila-press_backend && php artisan migrate --force
```

(Untuk uji coba di port 8080, isi `base` dengan `http://IP_SERVER:8080`.)

### Sesudah 10A atau 10B: ganti akun bawaan

**Wajib.** Database lokal membawa akun bawaan seeder, yang sandinya tertulis di
kode. Ganti email + sandi admin bawaan dan hapus akun `test@example.com` (ganti
nilai `GANTI_…`, tanpa tanda kutip di dalam sandi; kalau Anda punya akun admin
sendiri di data lokal, cukup hapus akun bawaannya lewat panel admin):

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan tinker --execute='$a = App\Models\User::where("email", "admin@tartilapress.test")->first(); if ($a) { $a->tokens()->delete(); $a->update(["email" => "admin@tartilapress.com", "password" => "GANTI_SANDI_ADMIN_YANG_KUAT"]); } App\Models\User::where("email", "test@example.com")->delete(); echo "Selesai".PHP_EOL;'
```

Lalu kembali ke **3.3** (cache konfigurasi).

---

## 11. Memperbarui situs di kemudian hari

Setelah `git push` dari komputer Anda:

```bash
cd /var/www/tartila-press-v2
bash deploy/deploy.sh
```

Skrip itu menjalankan `git pull`, `composer install`, migrasi database, cache
Laravel, build frontend, dan memuat ulang PHP-FPM (tanpa mengganggu website lain).

---

## Reset total (hapus semua milik v2, mulai dari awal)

Dipakai kalau pemasangan v2 sudah terlanjur jalan sebagian dan Anda ingin
membatalkannya lalu mulai lagi dari langkah 1 -- misalnya setelah mencoba jalur
database yang berbeda. Perintah di bawah **hanya menyentuh berkas milik v2**
(nama filenya selalu mengandung `tartila-press-v2`/`tartila-v2`/`tartila_press`,
tidak pernah nama yang dipakai website lama) dan aman dijalankan berulang atau
walau sebagian belum pernah dibuat. Folder `/var/www/tartila-press-v2` sendiri
(kode + riwayat git) TIDAK dihapus, cuma hasil pemasangannya.

```bash
PHPVER=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')

# 1) Nginx & PHP-FPM khusus v2
sudo rm -f /etc/nginx/sites-enabled/tartila-press-v2 /etc/nginx/sites-available/tartila-press-v2
sudo nginx -t && sudo systemctl reload nginx
sudo rm -f /etc/php/$PHPVER/fpm/pool.d/tartila-v2.conf
sudo systemctl reload php$PHPVER-fpm 2>/dev/null || true

# 2) Baris cron v2 (baris lain, termasuk milik website lama, tetap ada)
crontab -l 2>/dev/null | grep -v 'tartila-press-v2' | crontab -

# 3) Database. PostgreSQL (aman walau belum pernah dibuat):
sudo -u postgres psql -c "DROP DATABASE IF EXISTS tartila_press;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS tartila;" 2>/dev/null || true

#    Kalau sebelumnya sempat mencoba jalur MySQL, buang juga (aman walau
#    belum pernah dibuat; TIDAK menyentuh database website lama):
sudo mysql -e "DROP DATABASE IF EXISTS tartila_press_v2; DROP USER IF EXISTS 'tartila_v2'@'localhost';" 2>/dev/null || true

# 4) Berkas hasil pemasangan (dibuat ulang otomatis di langkah 3 dan 4 nanti)
cd /var/www/tartila-press-v2
[ -f tartila-press_backend/.env ] && mv tartila-press_backend/.env ~/tartila-press_backend.env.bak-$(date +%F)
rm -rf tartila-press_backend/vendor
rm -f tartila-press_backend/bootstrap/cache/*.php
rm -rf tartila-press-frontend/node_modules tartila-press-frontend/dist tartila-press-frontend/.env.production.local
```

`.env` lama dipindah (bukan dihapus) ke `~/tartila-press_backend.env.bak-TANGGAL`
di folder rumah Anda -- masih bisa dilihat kalau perlu, mis. sandi database yang
lama.

**Opsional, hapus juga unggahan uji coba** (cover/PDF yang sempat diunggah
selama mencoba). Lihat dulu isinya sebelum menghapus:

```bash
ls tartila-press_backend/storage/app/public tartila-press_backend/storage/app/private
```

```bash
rm -rf tartila-press_backend/storage/app/public/* tartila-press_backend/storage/app/private/*
```

Setelah ini, folder v2 kembali seperti baru di-`clone`. Lanjutkan lagi dari
**langkah 1** (paket) sampai **langkah 2B** (PostgreSQL), lalu **langkah 3** dan
seterusnya seperti biasa.

---

## Masalah umum

- **Halaman putih / galat 500 dari API** — lihat log:
  `tail -n 60 /var/www/tartila-press-v2/tartila-press_backend/storage/logs/laravel-*.log`
  dan `sudo tail -n 30 /var/log/nginx/error.log`.
- **502 Bad Gateway** — pool PHP-FPM v2 mati atau soketnya salah:
  `ls /run/php/` (harus ada `tartila-v2.sock`) lalu `sudo php-fpm$PHPVER -t` dan
  `sudo systemctl status php$PHPVER-fpm`.
- **`could not find driver`** — ekstensi PHP untuk database belum ada:
  `php -m | grep -E "pdo_mysql|pdo_pgsql"`. Pasang `php$PHPVER-mysql` atau
  `php$PHPVER-pgsql`, lalu `sudo systemctl reload php$PHPVER-fpm`. Ingat: `php`
  di terminal dan PHP-FPM yang melayani situs bisa berbeda versi; keduanya harus
  8.2 atau lebih baru.
- **`Access denied for user` (MySQL)** — periksa `DB_USERNAME`/`DB_PASSWORD` di
  `.env`, lalu `php artisan config:cache`.
- **`Connection refused` ke database** — server database mati atau `DB_HOST` /
  `DB_PORT` salah: `sudo systemctl status mysql` (atau `postgresql`).
- **Mengubah `.env` tidak berpengaruh** — konfigurasi di-cache:
  `cd tartila-press_backend && php artisan config:cache`.
- **"Permission denied" di `storage` atau `bootstrap/cache`** —
  `sudo chown -R $USER:$(id -gn) tartila-press_backend/storage tartila-press_backend/bootstrap/cache`
  lalu `chmod -R ug+rwX` pada dua folder itu.
- **Gambar/PDF unggahan 404** — tautan `public/storage` belum ada:
  `php artisan storage:link`.
- **Unggah gagal (413 / "terlalu besar")** — periksa `client_max_body_size` di
  Nginx dan `upload_max_filesize`/`post_max_size` di
  `/etc/php/$PHPVER/fpm/pool.d/tartila-v2.conf`, lalu reload PHP-FPM dan Nginx.
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
mysqldump -u tartila_v2 -p tartila_press_v2 > ~/tartila_press_v2-$(date +%F).sql
tar -czf ~/storage-$(date +%F).tar.gz -C /var/www/tartila-press-v2/tartila-press_backend storage/app
```

(PostgreSQL: `pg_dump -h 127.0.0.1 -U tartila -d tartila_press --no-owner --no-acl -f ~/tartila_press-$(date +%F).sql`.)
