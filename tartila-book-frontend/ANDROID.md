# Tartila Book untuk Android (Capacitor)

Aplikasi = situs Tartila Book yang sama, dibungkus WebView. **Hanya login dan membaca** (katalog, rak, baca,
suka, simpan, komentar, penanda, notifikasi, royalti penulis). Pembelian, langganan, pesanan, dan panel admin
tidak ada di aplikasi (`isApp` di `src/lib/platform.ts`); semuanya dikelola di situs web.

## Yang dibutuhkan di komputer
- Node 20+ (sudah ada), **JDK 21**, **Android Studio** (Panduan: SDK Platform 36 + Build-Tools). Capacitor 8.
- Backend produksi di **HTTPS** (aplikasi menolak lalu lintas polos).

## Langkah pertama kali
1. `cp .env.app.example .env.app` lalu isi `VITE_API_URL` (HTTPS), `VITE_PRESS_URL`, `VITE_WEB_URL`.
2. `npm install`
3. `npm run app:sync`  (build mode `app` + salin ke `android/`)
4. `npm run app:open`  (membuka Android Studio) -> Run di emulator/HP, atau `npm run app:run`.
5. Setiap ubah kode web: ulangi `npm run app:sync`.

Uji lokal dengan emulator: API di komputer = `http://10.0.2.2:8000/api/v1` (HTTP). Untuk itu tambahkan
`android:usesCleartextTraffic="true"` di `AndroidManifest.xml` HANYA untuk percobaan, jangan untuk rilis.

## Membuat berkas rilis (AAB untuk Play Store)
Android Studio -> Build -> Generate Signed Bundle / APK -> Android App Bundle. Buat *keystore* baru dan
SIMPAN cadangannya (tanpa keystore yang sama, pembaruan aplikasi tidak bisa diunggah). Naikkan
`versionCode`/`versionName` di `android/app/build.gradle` setiap rilis.

## Daftar periksa Play Store
- Akun Google Play Developer (sekitar US$25 sekali bayar), kebijakan privasi (URL), formulir Data safety.
- **Pembayaran:** aplikasi tidak menampilkan harga/tombol beli/langganan. Tautan "buka situs web" mati bawaan
  (`VITE_APP_SHOW_WEB_LINK=false`) karena kebijakan Play untuk konten digital bisa melarang mengarahkan
  pengguna ke pembayaran luar. Cek kebijakan terbaru di Play Console sebelum menyalakannya.
- Ikon dan splash: saat ini memakai ikon bawaan Capacitor. Siapkan `assets/icon-only.png` (1024x1024),
  `assets/icon-foreground.png`, `assets/icon-background.png`, `assets/splash.png` (2732x2732) lalu
  `npx @capacitor/assets generate --android`. (`public/logo.png` hanya 298x330, terlalu kecil.)
- Tangkapan layar, deskripsi, kategori Buku & Referensi, batas usia.

## Catatan teknis
- Tautan keluar domain (daftar akun / lupa kata sandi di Tartila Press) dibuka di peramban sistem
  (`initNativeApp`), tombol kembali Android mengikuti riwayat halaman.
- Token login disimpan di penyimpanan WebView milik aplikasi (tidak bisa dibaca aplikasi lain).
- Pembaca PDF (PDF.js) berjalan di WebView; PDF dimuat bertahap lewat HTTP Range seperti di web.
- Belum dibuat: notifikasi push, unduh ebook untuk offline, pemblokiran tangkapan layar (FLAG_SECURE).
- Saran kinerja sebelum aplikasi dirilis luas: kelompokkan pengiriman bacaan/progres (laporan uji beban,
  optimasi O1) agar beban API tidak berlipat saat banyak pembaca.
