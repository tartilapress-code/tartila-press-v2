# Arsip: alat PostgreSQL (tidak dipakai lagi)

Sampai 2026-10-17 komputer pengembangan memakai PostgreSQL sedangkan server memakai
MySQL/MariaDB. Sejak itu **semuanya MariaDB** (pengembangan, tes, dan server), jadi
alat di folder ini tidak diperlukan lagi. Disimpan hanya sebagai arsip.

| Berkas                | Dulu dipakai untuk                                                         |
| --------------------- | -------------------------------------------------------------------------- |
| `pg-ke-mysql.php`     | Memindahkan isi database PostgreSQL lokal ke berkas SQL untuk MySQL/MariaDB (dipakai sekali pada 2026-10-17 untuk pindah ke MariaDB lokal) |
| `ganti-url-lokal.sql` | Mengganti alamat gambar lokal di database PostgreSQL yang dibawa ke server |
| `pasang-pgsql-ext.sh` | Memasang ekstensi `pdo_pgsql` di server yang tidak bisa menjangkau Launchpad |

Penggantinya untuk membawa data lokal ke server: `deploy/ekspor-data-lokal.ps1`
(di komputer) dan `deploy/muat-data.sh` (di server). Lihat `deploy/DEPLOY.md` bagian 10.

Cadangan PostgreSQL lokal terakhir (sebelum pindah) ada di
`C:\Users\HP OMEN\Documents\cadangan-db\` (di luar proyek).
