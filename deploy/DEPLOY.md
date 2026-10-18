# Deploy Tartila Press v2 ke VPS

Panduan untuk server **Ubuntu + Nginx + PHP-FPM**, dengan kode di
`/var/www/tartila-press-v2`, di server yang **sudah menjalankan website lama**
(`/var/www/tartila-press`, database MySQL). Langkah-langkahnya sudah dicoba di
komputer pengembang (instalasi produksi Laravel, migrasi dari nol di MariaDB,
seluruh tes di MariaDB, pemindahan data lokal, pencadangan dan pemulihan, build
frontend), tetapi belum di server Anda, jadi kalau ada langkah yang gagal, salin
pesan galatnya dan tanyakan.

**Database: MariaDB/MySQL, di mana-mana** (komputer pengembangan, tes, dan server),
supaya perilakunya sama. PostgreSQL tidak dipakai lagi (alatnya diarsipkan di
`deploy/arsip-postgresql/`).

Satu alamat melayani semuanya:

| Alamat                     | Dilayani oleh                                           |
| -------------------------- | ------------------------------------------------------- |
| `https://DOMAIN/`          | Frontend React (`tartila-press-frontend/dist`)          |
| `https://DOMAIN/api/…`     | Backend Laravel (API + halaman katalog/abstrak Scholar) |
| `https://DOMAIN/storage/…` | Unggahan (cover, foto, PDF preview)                     |

Karena satu alamat, tidak ada urusan CORS, dan halaman Google Scholar
(`/api/katalog`) berada di domain yang sama dengan situsnya.

**Urutan**: 0 → 1 → 2 (termasuk 2C, penyetelan sesuai ukuran server) → 3 → 4 → 5
→ 8 (uji coba di port 8080) → 6 (pindah ke domain) → 7 → 9. Bagian 10 (membawa
data lokal) dikerjakan di tengah langkah 3, hanya kalau data lokal ingin ikut.
Cadangan otomatis (bagian "Cadangan" di akhir) dipasang setelah situs jalan.

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
echo "== Nginx:"; ls /etc/nginx/sites-enabled/; grep -RhE "server_name|^\s*root |fastcgi_pass" /etc/nginx/sites-enabled/; echo "== PHP:"; php -v | head -1; ls /usr/bin/php* /run/php/; php -m | grep -iE "pdo_mysql|mbstring|curl|zip|xml"; echo "== MySQL:"; mysql --version; echo "== HTTPS:"; certbot --version 2>&1 | head -1; echo "== cron:"; crontab -l 2>&1 | grep -v '^#'; echo "== memori/disk:"; free -h | head -2; df -h / | tail -1
```

---

## Server 2 GB (profil saat ini) dan naik ke 8 GB

Profil yang disiapkan di panduan ini:

| Profil | Spesifikasi | Cocok untuk |
| --- | --- | --- |
| `2gb` (sekarang) | 1 vCPU, 2 GB RAM, 60 GB disk, Ubuntu | Tartila Press sampai ±10 ribu pengunjung/hari (di uji beban ±15 ms CPU per permintaan). Tartila Book dengan trafik besar **tidak** cocok di sini. |
| `8gb` (rencana bulan depan) | 4 vCPU, 8 GB RAM, 80 GB NVMe | Press + Book dengan ruang tumbuh beberapa kali lipat. |

Pembagian memori profil 2 GB (total 2048 MB):

| Komponen | Jatah |
| --- | --- |
| Ubuntu + Nginx | ±300 MB |
| MariaDB (buffer pool 512 MB) | ±600–700 MB |
| PHP-FPM (5 worker × ±50 MB, permintaan berat bisa 200 MB) | ±300–400 MB |
| Website lama (v1) + cadangan lonjakan | sisanya |
| **Swap 2 GB** (disk, pengaman kalau memori penuh) | di luar RAM |

Semua setelan itu dipasang oleh **satu skrip** (`deploy/pasang-server.sh`, langkah
2C): swap, `/etc/mysql/mariadb.conf.d/99-tartila.cnf`, pool PHP-FPM `tartila-v2`, dan
OPcache. Naik ke 8 GB nanti cukup menjalankannya lagi dengan `8gb`: skrip yang
sama menimpa setelan 2 GB (tidak bertumpuk).

**Pilih sistem operasi yang masih didukung.** Kalau penyedia VPS membolehkan
memilih/instal ulang OS, pilih **Ubuntu 24.04 LTS**: PHP 8.3 dan MariaDB 10.11 sudah
ada di repositori resmi (Laravel 12 butuh PHP 8.2+), tanpa Launchpad. **Ubuntu 20.04
sudah tidak mendapat pembaruan keamanan gratis** (dukungan standar berakhir April
2025; aktifkan *Ubuntu Pro* gratis untuk sampai 5 mesin kalau tetap memakainya) dan
repositorinya hanya berisi PHP 7.4, jadi PHP 8.2 harus dari `ppa:ondrej/php` di
Launchpad (lihat langkah 1; beberapa server tidak bisa menjangkaunya).

**Build frontend di komputer Anda, bukan di server.** `vite build` memakan memori
besar dan membuat server 2 GB macet ("Killed"). Skrip `deploy/unggah-frontend.ps1`
membangun frontend di komputer lalu mengunggah `dist`-nya; di server cukup
`SKIP_FRONTEND_BUILD=1 bash deploy/deploy.sh`. Dengan cara ini Node.js tidak perlu
dipasang di server sama sekali (langkah 4 menjelaskan caranya).

**Kapan perlu naik paket?** Naikkan kalau salah satu terjadi terus-menerus: load
rata-rata di atas 1,0 (`uptime`), swap terpakai rutin (`free -h`), error 502 atau
timeout di jam ramai, atau `slow.log` (`sudo mysqldumpslow /var/log/mysql/slow.log`)
cepat bertambah. Halaman Keuangan/Ringkasan admin masih memuat semua pesanan lunas
(batas aman ±24 ribu pesanan lunas); itu butuh perbaikan kode (agregasi SQL), bukan
sekadar server lebih besar.

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
- Ekstensi PHP: `mbstring`, `xml`, `curl`, `zip`, dan `pdo_mysql` (MariaDB/MySQL)
- Ekstensi `gd` sangat disarankan: dipakai fitur sertifikat otomatis untuk
  mengubah gambar templat yang diunggah admin menjadi JPG dan memperkecilnya
  (tanpa `gd`, hanya JPG, atau PNG tanpa transparansi, yang diterima), dan
  untuk membuat versi kecil (WebP 400/900 px) setiap gambar unggahan supaya
  halaman ringan. Tanpa `gd` situs tetap jalan tetapi memakai gambar asli yang
  besar. Setelah `gd` terpasang, jalankan sekali `php artisan images:responsive`
  untuk gambar yang sudah ada (deploy.sh juga menjalankannya).

**Ubuntu 24.04 di server baru/kosong (jalan pintas, dipakai di pemasangan 2026-10-17).** Semua
paket ada di repositori resmi (PHP 8.3, MariaDB 10.11); Node.js tidak diperlukan kalau
frontend dibangun di komputer (langkah 4A):

```bash
sudo apt install -y nginx php8.3-fpm php8.3-cli php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-mysql php8.3-gd mariadb-server git unzip curl composer certbot python3-certbot-nginx
```

Lanjut ke langkah 2A (buat database dan user; `mysql_secure_installation` dulu), lalu 2C.

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
for m in pdo_mysql mbstring xml curl zip gd; do php -m | grep -qix "$m" && echo "ada     $m" || echo "belum   $m"; done
```

Pasang yang kurang; apt melewati yang sudah terpasang. Ekstensi harus sekelompok
dengan PHP Anda, karena itu memakai `$PHPVER`. (Ekstensi `gd` = paket
`php$PHPVER-gd`; sudah ada di baris `apt install` di bawah.)

```bash
sudo apt update
sudo apt install -y php$PHPVER-fpm php$PHPVER-cli php$PHPVER-mbstring php$PHPVER-xml php$PHPVER-curl php$PHPVER-zip php$PHPVER-mysql php$PHPVER-gd
```

Kalau apt menjawab `Unable to locate package` untuk paket `php8.2-…`, berarti repositori
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

## 2. Database: MariaDB (atau MySQL)

Dipakai MariaDB/MySQL karena: server Anda sudah punya MySQL (website lama);
komputer pengembangan kini juga MariaDB (data dan tes sama); lebih ringan di server
kecil; dan untuk pola beban Tartila Press (baca katalog, tulis pesanan) selisih
kecepatannya dengan PostgreSQL kecil dibanding pengaruh indeks, pagination, dan
cache. Diuji di MariaDB 10.4: migrasi dari nol, **seluruh 747 tes lulus**, dan data
lokal (82 tabel, 713 baris) dipindahkan identik. MySQL 8 dan MariaDB 10.11 belum
diuji langsung, tetapi kode memakai fitur standar (cabang khusus per mesin hanya ada
di satu fungsi tanggal `FinanceService`, dan cabang MySQL-nya adalah yang bawaan).

Database v2 selalu **terpisah** dari database website lama.

### 2A. Server sudah punya MySQL/MariaDB (website lama memakainya)

Pakai yang ada; jangan memasang yang kedua. Buat database dan user khusus v2
(`sudo mysql` bekerja kalau root memakai login sistem; kalau root punya sandi, pakai
`mysql -u root -p`):

```bash
sudo mysql -e "CREATE DATABASE tartila_press_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'tartila_v2'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_DATABASE';"
sudo mysql -e "CREATE USER 'tartila_v2'@'127.0.0.1' IDENTIFIED BY 'GANTI_PASSWORD_DATABASE';"
sudo mysql -e "GRANT ALL PRIVILEGES ON tartila_press_v2.* TO 'tartila_v2'@'localhost'; GRANT ALL PRIVILEGES ON tartila_press_v2.* TO 'tartila_v2'@'127.0.0.1'; FLUSH PRIVILEGES;"
```

(Dua user `localhost` dan `127.0.0.1` karena `DB_HOST=127.0.0.1` terhubung lewat TCP,
yang dicocokkan dengan host `127.0.0.1` pada sebagian konfigurasi.) Ganti
`GANTI_PASSWORD_DATABASE` dengan sandi kuat (`openssl rand -base64 24`) dan samakan
di `.env` (langkah 3).

### 2B. Server belum punya database

Pasang MariaDB. Di **Ubuntu 24.04** versinya sudah 10.11 dari repositori resmi:

```bash
sudo apt install -y mariadb-server
sudo mysql_secure_installation
```

Di Ubuntu 20.04/22.04 versi bawaannya lama (10.3/10.6); ambil 10.11 dari repositori
MariaDB sendiri (bukan Launchpad) lebih dahulu:

```bash
curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | sudo bash -s -- --mariadb-server-version=10.11
sudo apt install -y mariadb-server
sudo mysql_secure_installation
```

Lalu buat database dan user seperti di 2A. Pastikan ekstensinya ada (harus
menampilkan `pdo_mysql`):

```bash
php -m | grep pdo_mysql
```

### 2C. Setel server sesuai ukurannya (swap, database, PHP-FPM, OPcache)

Dari folder proyek di server (setelah `git pull`; PHP-FPM dan database sudah
terpasang). `--simulasi` hanya menampilkan apa yang akan dikerjakan:

```bash
cd /var/www/tartila-press-v2
bash deploy/pasang-server.sh 2gb --simulasi
bash deploy/pasang-server.sh 2gb
```

Skrip ini me-restart database (website lama terputus beberapa detik; ia bertanya
dulu) dan kalau database gagal start dengan setelan barunya, berkasnya dicabut
otomatis. Isi setelannya ada di `deploy/server/` (`mariadb-2gb.cnf`,
`mariadb-8gb.cnf`, `php-tuning.ini`) dan dapat dibaca/diubah sebelum dipasang.
Setelah naik ke paket 8 GB, jalankan lagi dengan `8gb`.

Cek hasilnya:

```bash
sudo mysql -e "SELECT @@innodb_buffer_pool_size/1024/1024 AS buffer_mb, @@sql_mode, @@collation_server;"
free -h; swapon --show; ls /run/php/
```

---

## 3. Backend (Laravel)

### 3.1 Pasang

```bash
cd /var/www/tartila-press-v2
cp deploy/backend.env.example tartila-press_backend/.env
nano tartila-press_backend/.env        # ganti semua yang berawalan GANTI_ (sandi database = yang dibuat di langkah 2)
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
berisi peran dan akun) dan kerjakan **bagian 10**, lalu kembali ke 3.3.

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

### 4A. Server kecil (2 GB): bangun di komputer Anda (disarankan)

Dari komputer Anda (PowerShell, folder proyek). `Domain` adalah alamat akhir situs
(atau `http://IP_SERVER:8080` untuk uji coba); tambahkan `-BookDomain` kalau
Tartila Book (bagian 12) ikut dibangun:

```powershell
cd "C:\Users\HP OMEN\Documents\NEW SOFTWARE_TARTILA PRESS"
powershell -ExecutionPolicy Bypass -File deploy\unggah-frontend.ps1 -Server USER@IP_SERVER -Domain https://DOMAIN_ANDA
```

Skrip membangun, membuat arsip, mengunggah, dan memasang `dist` di server dengan
menukar folder (situs tidak pernah setengah terganti). Alamat API dibenamkan lewat
variabel `VITE_API_URL`, jadi `.env.production.local` tidak diperlukan. Pada
pembaruan berikutnya, di server jalankan `SKIP_FRONTEND_BUILD=1 bash deploy/deploy.sh`
dan di komputer jalankan lagi perintah di atas. Node.js tidak perlu dipasang di server.
Lewati 4B.

### 4B. Server besar (4 GB ke atas): bangun di server

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

**Kalau langkah 2C (`pasang-server.sh`) sudah dijalankan, pool ini SUDAH terpasang**;
lewati perintah di bawah dan langsung ke `ls /run/php/`. Cara manual (angka untuk
server 2 GB; untuk 8 GB: 16, 4, 4, 8):

```bash
cd /var/www/tartila-press-v2
sed -e "s|__USER__|$USER|g" -e "s|__GROUP__|$(id -gn)|g" -e "s|__MAX_CHILDREN__|5|g" -e "s|__START_SERVERS__|2|g" -e "s|__MIN_SPARE__|1|g" -e "s|__MAX_SPARE__|3|g" deploy/php-fpm-pool-v2.conf | sudo tee /etc/php/$PHPVER/fpm/pool.d/tartila-v2.conf > /dev/null
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

### 6C. Satu alamat resmi (www) dan pengalihan tanpa-www

Pilih satu alamat resmi (di pemasangan 2026-10-17: `https://www.tartilapress.com`) dan
alihkan yang lain ke sana: login di `www` dan tanpa-www dianggap dua situs berbeda oleh
browser, dan mesin pencari menganggapnya duplikat. Alamat resmi dipakai di `APP_URL`,
`FRONTEND_URL`, dan `-Domain` saat membangun frontend. Pengalihannya: lihat petunjuk di
`deploy/nginx-apex-redirect.conf` (empat perintah; sudah diuji, hasilnya `301` ke `www`).

Pembaruan sertifikat otomatis sudah diatur certbot; cek dengan
`sudo certbot renew --dry-run`. Tutup port uji coba kalau tadi dibuka:
`sudo ufw delete allow 8080/tcp`.

Tanpa domain (hanya IP), lewati bagian ini dan tetap pakai `http://IP:8080`.

---

## 7. Jadwal otomatis (cron)

Ada tugas harian (mengembalikan proyek Book Chapter yang kedaluwarsa dan
mengonfirmasi otomatis pengiriman buku) dan tugas tiap 10 menit
(`orders:cancel-unpaid`: membatalkan pesanan yang belum mengunggah bukti
transfer dalam 1×24 jam sesuai invoice). Laravel hanya menjalankannya kalau
`schedule:run` dipanggil tiap menit — **tanpa cron ini pesanan tidak dibatalkan
otomatis**. Baris ini **menambah**; baris website lama (kalau ada) tetap:

```bash
(crontab -l 2>/dev/null; echo "* * * * * cd /var/www/tartila-press-v2/tartila-press_backend && php artisan schedule:run >> /dev/null 2>&1") | crontab -
crontab -l
```

Tidak perlu worker antrean: aplikasi ini tidak memakai queue (notifikasi dan email
dikirim langsung setelah halaman selesai).

Cadangan otomatis juga lewat cron: lihat bagian "Cadangan" di akhir panduan.

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

Email notifikasi juga memakai SMTP yang sama: pesanan masuk dikirim ke
`ORDER_NOTIFICATION_EMAIL` (kosong = email kontak di halaman Tentang Kami), dan setiap
update naskah dikirim ke email penulis serta editornya. Email dikirim langsung
setelah halaman selesai (tanpa worker antrean); kalau SMTP gagal, aksi user tetap
berhasil dan kegagalannya tercatat di `storage/logs/laravel.log`. Ganti juga
`APP_NAME="Tartila Press"` dan `MAIL_FROM_ADDRESS` supaya pengirim email benar.

---

## 10. Membawa data dari komputer lokal (opsional)

Lewati bagian ini kalau situs boleh mulai dari kosong. Yang ikut dibawa: semua
isi database lokal (buku, artikel, event, paket, layanan, profil, **pengguna,
pesanan**, dan seterusnya) serta berkas unggahan. Tidak ikut: token login, sesi,
cache, dan antrean, jadi semua orang cukup login ulang (dan token pengembangan
tidak bocor ke server). Database lokal juga berisi akun dan pesanan uji (mis. akun
berakhiran `@example.com`) dan log login pengembangan; bersihkan lewat panel admin
sesudahnya, atau mulai dari kosong kalau tidak diinginkan.

**Berkas unggahan.** Dari komputer Anda (PowerShell, folder proyek); `USER` adalah
user login server:

```powershell
cd "C:\Users\HP OMEN\Documents\NEW SOFTWARE_TARTILA PRESS"
scp -r tartila-press_backend\storage\app\public USER@IP_SERVER:/var/www/tartila-press-v2/tartila-press_backend/storage/app/
scp -r tartila-press_backend\storage\app\private USER@IP_SERVER:/var/www/tartila-press-v2/tartila-press_backend/storage/app/
```

`public` berisi cover/foto/PDF preview, `private` berisi naskah pengguna (ukurannya
bertambah sesuai pemakaian; per 2026-10-17 total ±80 MB).

### 10A. Ekspor data (di komputer Anda)

MariaDB lokal harus hidup (XAMPP). `-Base` adalah alamat **akhir** situs (atau
`http://IP_SERVER:8080` untuk uji coba); alamat lokal `http://127.0.0.1:8000` dan
`http://localhost:5173` di data otomatis diganti dengannya. Database lokal hanya
dibaca.

```powershell
cd "C:\Users\HP OMEN\Documents\NEW SOFTWARE_TARTILA PRESS"
powershell -ExecutionPolicy Bypass -File deploy\ekspor-data-lokal.ps1 -Base https://DOMAIN_ANDA -Out tartila_press_data.sql
scp tartila_press_data.sql USER@IP_SERVER:~/
```

Skrip menampilkan jumlah alamat yang diganti dan memperingatkan kalau masih ada
alamat web lokal lain (mis. port `5174` Tartila Book, yang harus Anda ganti sendiri
dengan alamat Tartila Book).

### 10B. Muat di server

Tabel dibuat dulu lewat migrasi, lalu `muat-data.sh` mengosongkan tabel (migrasi
sudah mengisi beberapa baris bawaan yang juga ada di data lokal) dan memuat seluruh
data dalam satu transaksi (kalau ada galat, tidak ada data setengah jadi; cukup
ulangi). Ia meminta Anda mengetik `GANTI` sebagai konfirmasi:

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan migrate --force
cd .. && bash deploy/muat-data.sh ~/tartila_press_data.sql
```

Hasilnya diuji pada 2026-10-17: ekspor → database kosong hasil migrasi → muat,
jumlah baris dan isi setiap tabel identik (hanya 8 tabel berisi alamat gambar yang
berbeda, sesuai penggantian alamat).

### Sesudah membawa data lokal: ganti akun bawaan

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
Di server 2 GB, frontend dibangun di komputer (langkah 4A), jadi jalankan:

```bash
SKIP_FRONTEND_BUILD=1 bash deploy/deploy.sh
```

---

## 12. Tartila Book (situs baca buku, terpisah)

Tartila Book adalah situs React kedua (`tartila-book-frontend`) yang memakai
**backend, database, dan akun yang sama** dengan Tartila Press. Hanya tampilannya
yang terpisah, jadi cukup satu backend di server.

**Yang perlu disiapkan**

1. Nama (sub)domain baru, mis. `book.tartilapress.com` — tambahkan *A record* ke IP server.
2. Isi `TARTILA_BOOK_URL=https://$DOMAIN_BOOK` di `.env` backend (tautan beli ebook di Tartila Press = alamat itu + `/buku/{judul}`), lalu `php artisan config:cache`.
   Backend sudah terbaru (`git pull`) dan migrasinya jalan: `bash deploy/deploy.sh`
   (membuat tabel `reader_*`). Cron di langkah 7 sudah cukup; tugas
   `reader:cancel-unpaid` ikut berjalan lewat `schedule:run`.
3. Batas unggah ebook (admin): di repo sudah dinaikkan ke 210 MB
   (`deploy/php-fpm-pool-v2.conf` dan `deploy/nginx-tartila-press-v2.conf`). Di server
   yang sudah terpasang, salin ulang kedua berkas itu ke tempatnya lalu
   `sudo systemctl reload php*-fpm nginx`. Validasi Laravel membatasi ebook 200 MB.

**Build frontend.** Di server 2 GB bangun di komputer: jalankan
`deploy\unggah-frontend.ps1` dengan tambahan `-BookDomain https://$DOMAIN_BOOK`
(langkah 4A); lewati blok di bawah. Di server besar:

```bash
cd /var/www/tartila-press-v2/tartila-book-frontend
cat > .env.production.local <<EOF
VITE_API_URL=https://$DOMAIN_PRESS/api/v1
VITE_PRESS_URL=https://$DOMAIN_PRESS
EOF
npm ci
npx vite build
```

`DOMAIN_PRESS` = alamat Tartila Press (API-nya dipakai bersama). Berkas
`.env.production.local` itu juga tanda bagi `deploy.sh` untuk ikut membangun
Tartila Book pada pembaruan berikutnya.

**Nginx + HTTPS**

```bash
cd /var/www/tartila-press-v2
sed -e "s|__LISTEN__|80|g" -e "s|__SERVER_NAME__|$DOMAIN_BOOK|g" deploy/nginx-tartila-book.conf | sudo tee /etc/nginx/sites-available/tartila-book > /dev/null
sudo ln -sf /etc/nginx/sites-available/tartila-book /etc/nginx/sites-enabled/tartila-book
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d $DOMAIN_BOOK
```

**Setelah online**

1. Masuk sebagai admin di Tartila Book → menu **Taksonomi** (isi bidang pendidikan,
   kategori, genre) → **Paket langganan** → **Royalti & pengaturan** (persen pembelian
   dan biaya per bacaan) → **Buku & ebook** (tambah buku terbit, klasifikasi, harga).
   **Ebook tidak diunggah di Tartila Book**: unggah sekali di Tartila Press (Admin → Buku →
   *Ebook lengkap*, format PDF); Tartila Book membaca berkas yang sama.
2. Rekening pembayaran memakai daftar **Metode Pembayaran** di Tartila Press.
3. Akun pembaca = akun Tartila Press (pendaftaran dan lupa kata sandi dialihkan ke sana).
   Token login Tartila Book disimpan terpisah, jadi masuk di satu situs tidak otomatis
   masuk di situs lain.

---

## Reset total (hapus semua milik v2, mulai dari awal)

Dipakai kalau pemasangan v2 sudah terlanjur jalan sebagian dan Anda ingin
membatalkannya lalu mulai lagi dari langkah 1 -- misalnya setelah mencoba jalur
database yang berbeda. Sudah disiapkan skripnya (`deploy/reset-v2.sh`) supaya di
konsol yang tidak bisa tempel (paste), cukup ketik satu baris pendek:

```bash
cd /var/www/tartila-press-v2 && git pull && bash deploy/reset-v2.sh
```

Skrip ini **hanya menyentuh berkas milik v2** (nama filenya selalu mengandung
`tartila-press-v2`/`tartila-v2`/`tartila_press`, tidak pernah nama yang dipakai
website lama) dan aman dijalankan berulang kali atau walau sebagian belum pernah
dibuat. Yang dikerjakan: membuang berkas Nginx dan pool PHP-FPM v2, baris cron
v2, database PostgreSQL dan/atau MySQL v2 (kalau pernah dibuat), lalu
`vendor/`, cache Laravel, `node_modules/`, dan hasil build frontend. Folder
`/var/www/tartila-press-v2` sendiri (kode + riwayat git) TIDAK dihapus. `.env`
lama dipindah (bukan dihapus) ke `~/tartila-press_backend.env.bak-...` di folder
rumah Anda, masih bisa dilihat kalau perlu.

Mau buang juga unggahan uji coba (cover/PDF yang sempat diunggah)? Tambahkan
`--hapus-unggahan`:

```bash
bash deploy/reset-v2.sh --hapus-unggahan
```

Setelah ini, folder v2 kembali seperti baru di-`clone`. Lanjutkan lagi dari
**langkah 1** (paket) sampai **langkah 2C** (database dan penyetelan server), lalu
**langkah 3** dan seterusnya seperti biasa.

---

## Masalah umum

- **Pemasangan nyata di Ubuntu 24.04 (2026-10-17/18), yang pernah tersandung:**
  - **`REMOTE HOST IDENTIFICATION HAS CHANGED`** setelah rebuild atau pemasangan kunci SSH
    di panel: ini wajar, tetapi verifikasi dulu. Di konsol web panel jalankan
    `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` dan cocokkan sidik jarinya, baru
    `ssh-keygen -R IP_SERVER` di komputer dan sambung lagi.
  - **`Permission denied (publickey)`**: server hanya menerima kunci SSH. Buat kunci
    (`ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\tartila-vps`) dan tambahkan kunci
    publiknya (`.pub`) di panel VPS atau di `~/.ssh/authorized_keys`. Kunci pribadi tidak
    pernah dikirim ke siapa pun.
  - **Konsol web panel tidak mengetik `\` dan memotong baris panjang**: pakai SSH dari
    PowerShell. Di konsol itu, hindari `\` (mis. di tinker: `$m = config("auth.providers.users.model"); $m::create([...])`).
  - **Perintah PowerShell tertempel di sesi server** (atau sebaliknya): cek promptnya,
    `PS C:\...>` = komputer, `user@host:...$` = server.
  - **`ufw` "ERROR: problem running" / status inactive**: pastikan aturan `OpenSSH`
    ditambahkan dulu, lalu `sudo ufw --force enable`; ulangi bila perlu. Jangan `ufw reset`.
  - **`scp ... "C:\folder\"`** (garis miring di akhir) gagal "Invalid argument" di
    PowerShell: hilangkan `\` terakhir.
  - **`sed`/`cp` dengan nama folder salah ketik** (`tartila-pres_backend`): periksa ejaan
    `tartila-press_backend` (dua huruf s).
- **Halaman putih / galat 500 dari API** — lihat log:
  `tail -n 60 /var/www/tartila-press-v2/tartila-press_backend/storage/logs/laravel-*.log`
  dan `sudo tail -n 30 /var/log/nginx/error.log`.
- **502 Bad Gateway** — pool PHP-FPM v2 mati atau soketnya salah:
  `ls /run/php/` (harus ada `tartila-v2.sock`) lalu `sudo php-fpm$PHPVER -t` dan
  `sudo systemctl status php$PHPVER-fpm`.
- **`could not find driver`** — ekstensi PHP untuk database belum ada:
  `php -m | grep pdo_mysql`. Pasang `php$PHPVER-mysql`, lalu
  `sudo systemctl reload php$PHPVER-fpm`. Ingat: `php`
  di terminal dan PHP-FPM yang melayani situs bisa berbeda versi; keduanya harus
  8.2 atau lebih baru.
- **`Access denied for user` (MySQL)** — periksa `DB_USERNAME`/`DB_PASSWORD` di
  `.env`, lalu `php artisan config:cache`.
- **`Connection refused` ke database** — server database mati atau `DB_HOST` /
  `DB_PORT` salah: `sudo systemctl status mariadb` (atau `mysql`).
- **`Access denied` padahal sandi benar, hanya lewat `127.0.0.1`** — user dibuat
  hanya untuk `'localhost'`; buat juga `'tartila_v2'@'127.0.0.1'` (langkah 2A).
- **Server lambat / swap penuh / 502 di jam ramai** — `free -h`, `uptime`, dan
  `sudo mysqldumpslow /var/log/mysql/slow.log | head -30` (query lambat → tambah
  indeks atau perbaiki query). Server 2 GB: pertimbangkan naik paket (bagian
  "Server 2 GB").
- **Setelah mengubah kode manual, tidak berubah** — OPcache tidak memeriksa berkas
  (sengaja, demi kecepatan): `sudo systemctl reload php$PHPVER-fpm`. `deploy.sh`
  sudah melakukannya.
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
- **Build frontend "Killed"** — memori kurang (server 2 GB). Bangun di komputer
  Anda (langkah 4A), atau pasang swap lewat `bash deploy/pasang-server.sh 2gb`.
- **Build frontend menolak versi Node** — `node -v` harus 20.19+ (lihat langkah 1).
- **Sertifikat (PDF) gagal dibuat atau unggah gambar templat ditolak** — lihat
  `storage/logs/laravel-*.log`. Pastikan `php -m | grep gd` menampilkan `gd`
  (untuk PNG transparan atau gambar besar) dan `memory_limit` PHP-FPM minimal
  256M (sudah diatur di pool `tartila-v2`). Font sertifikat ada di
  `tartila-press_backend/resources/fonts/unifont`; metrik font dibuat otomatis
  saat sertifikat pertama dibuat dan disimpan di folder itu juga (ikut `.gitignore`),
  jadi folder itu sebaiknya bisa ditulis user PHP-FPM -- kalau tidak, sertifikat
  tetap jadi tetapi sedikit lebih lambat.
- **`git pull` menolak karena `package-lock.json` berubah** —
  `git checkout -- tartila-press-frontend/package-lock.json` (gunakan `npm ci`,
  bukan `npm install`, di server).

## Cadangan (backup)

Yang perlu dicadangkan: database dan folder `tartila-press_backend/storage/app`
(unggahan dan naskah). Skrip `deploy/backup.sh` mengerjakannya: dump database
(dikompres, diperiksa utuh) setiap kali dijalankan, arsip `storage/app` seminggu
sekali (Minggu), lalu membuang cadangan lama (database 14 hari, berkas 35 hari).
Sandi database dibaca dari `.env` dan tidak muncul di daftar proses.

Coba sekali dulu:

```bash
cd /var/www/tartila-press-v2
bash deploy/backup.sh
ls -lh ~/cadangan-tartila
```

Lalu jadwalkan tiap malam pukul 02:30 (menambah baris cron; baris lain dibiarkan):

```bash
(crontab -l 2>/dev/null; echo "30 2 * * * /bin/bash /var/www/tartila-press-v2/deploy/backup.sh >> \$HOME/backup-tartila.log 2>&1") | crontab -
crontab -l
```

**Cadangan yang hanya ada di server yang sama tidak menyelamatkan Anda kalau diska
server rusak.** Salin keluar secara berkala: unduh ke komputer
(`scp -r USER@IP_SERVER:~/cadangan-tartila .`), atau otomatis ke server lain dengan
`BACKUP_REMOTE=user@host:/folder/` (rsync lewat SSH, mis. di baris cron).

**Memulihkan database** (ke database kosong/yang akan ditimpa; hentikan penulisan
dulu dengan `php artisan down`):

```bash
cd /var/www/tartila-press-v2/tartila-press_backend
php artisan down
zcat ~/cadangan-tartila/db-TANGGAL_JAM.sql.gz | mysql -u tartila_v2 -p tartila_press_v2
php artisan up
```

Dump sudah berisi struktur tabel, jadi tidak perlu `migrate` sebelumnya. **Memulihkan
berkas**: `tar -xzf ~/cadangan-tartila/storage-TANGGAL_JAM.tar.gz -C /var/www/tartila-press-v2/tartila-press_backend`.
Latihlah pemulihan sekali di database cadangan (bukan yang hidup) supaya Anda tahu
cadangannya bisa dipakai; pemulihan ini sudah diuji pada 2026-10-17 (hasilnya
identik dengan sumber).
