Alat uji beban Tartila (lihat docs/Laporan-Uji-Beban-Kapasitas-2026-10-13.txt, bagian 9).
- seed.sql / seed3.sql : data uji besar (1,1 juta pengguna, 20 juta bacaan). HANYA untuk database uji.
- loadtest.mjs         : pembangkit beban sesi Press + Book + admin (Node, tanpa paket tambahan).
- qprofile.php         : jumlah & waktu query per request (jalur C:/perf dapat diganti).
- admin_times.sh       : waktu endpoint admin berat satu per satu.
