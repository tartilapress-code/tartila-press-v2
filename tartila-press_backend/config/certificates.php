<?php

/*
|--------------------------------------------------------------------------
| Sertifikat otomatis
|--------------------------------------------------------------------------
| Pengaturan pembuat sertifikat PDF (App\Support\Certificates). Admin
| mengunggah gambar templat dan menandai posisi teks; PDF dibuat di server
| dengan tFPDF, gambar templat sebagai latar dan teks sebagai vektor.
*/

return [

    /*
    | Zona waktu untuk tanggal yang dicetak di sertifikat (tanggal pelaksanaan
    | event, tanggal diterbitkan). Server menyimpan UTC; sertifikat Indonesia
    | memakai WIB supaya tanggalnya tidak bergeser sehari untuk acara pagi hari.
    */
    'timezone' => 'Asia/Jakarta',

    /*
    | Awalan nomor sertifikat, mis. TP-EVT-2026-000012 / TP-PUB-2026-000013.
    */
    'number_prefix' => 'TP',

    /*
    | Ukuran halaman PDF. Sisi terpanjang gambar templat dipetakan ke angka ini
    | (poin; 841,89 = sisi panjang A4), sisi lainnya mengikuti rasio gambar.
    | Ukuran huruf di templat (pt) mengacu pada ukuran halaman ini. Editor di
    | frontend memakai angka yang sama (diambil dari endpoint meta), jadi
    | jangan diubah setelah ada templat tersimpan.
    */
    'page_long_side_pt' => 841.89,

    /*
    | Aturan tata letak teks. HARUS sama dengan frontend
    | (src/lib/certificateLayout.ts), karena pratinjau di editor menghitung
    | baris dan ukuran huruf dengan algoritma yang sama.
    */
    'line_height' => 1.25,
    'min_font_size_ratio' => 0.4,
    'min_font_size_pt' => 6,

    /*
    | Batas gambar templat yang diunggah.
    */
    'template_image' => [
        'max_kb' => 10240,
        'max_pixels' => 20_000_000,
        // Sisi terpanjang setelah diperkecil (kalau GD tersedia).
        'max_side_px' => 3508,
        'jpeg_quality' => 90,
        'disk' => 'public',
        'directory' => 'certificate-templates',
    ],

    /*
    | Folder font (berisi subfolder unifont/ yang dibaca tFPDF).
    */
    'font_path' => resource_path('fonts'),

    /*
    | Keluarga font yang bisa dipilih admin. `file` = awalan nama berkas di
    | resources/fonts/unifont ({file}-Regular.ttf, {file}-Bold.ttf kalau
    | `bold` true). `ascent`/`descent` (satuan em, dari tabel hhea) dipakai
    | untuk menaruh garis dasar teks; frontend memakai angka yang sama.
    |
    | Font ini diturunkan dari google/fonts (SIL OFL) -- lihat
    | resources/fonts/LICENSES.txt. Mengganti isi sebuah berkas TTF berarti
    | cache metrik tFPDF-nya (*.mtx.php, *.cw.dat) harus dihapus.
    */
    'fonts' => [
        'cinzel' => [
            'label' => 'Cinzel',
            'category' => 'serif',
            'file' => 'Cinzel',
            'bold' => true,
            'ascent' => 0.976,
            'descent' => 0.372,
        ],
        'cormorant' => [
            'label' => 'Cormorant Garamond',
            'category' => 'serif',
            'file' => 'CormorantGaramond',
            'bold' => true,
            'ascent' => 0.924,
            'descent' => 0.287,
        ],
        'ebgaramond' => [
            'label' => 'EB Garamond',
            'category' => 'serif',
            'file' => 'EBGaramond',
            'bold' => true,
            'ascent' => 1.007,
            'descent' => 0.298,
        ],
        'crimson' => [
            'label' => 'Crimson Pro',
            'category' => 'serif',
            'file' => 'CrimsonPro',
            'bold' => true,
            'ascent' => 0.896,
            'descent' => 0.215,
        ],
        'caslon' => [
            'label' => 'Libre Caslon Text',
            'category' => 'serif',
            'file' => 'LibreCaslonText',
            'bold' => true,
            'ascent' => 0.970,
            'descent' => 0.260,
        ],
        'greatvibes' => [
            'label' => 'Great Vibes',
            'category' => 'script',
            'file' => 'GreatVibes',
            'bold' => false,
            'ascent' => 0.851,
            'descent' => 0.401,
        ],
        'allura' => [
            'label' => 'Allura',
            'category' => 'script',
            'file' => 'Allura',
            'bold' => false,
            'ascent' => 0.800,
            'descent' => 0.450,
        ],
        'pinyon' => [
            'label' => 'Pinyon Script',
            'category' => 'script',
            'file' => 'PinyonScript',
            'bold' => false,
            'ascent' => 0.863,
            'descent' => 0.384,
        ],
        'montserrat' => [
            'label' => 'Montserrat',
            'category' => 'sans',
            'file' => 'Montserrat',
            'bold' => true,
            'ascent' => 0.968,
            'descent' => 0.251,
        ],
        'opensans' => [
            'label' => 'Open Sans',
            'category' => 'sans',
            'file' => 'OpenSans',
            'bold' => true,
            'ascent' => 1.069,
            'descent' => 0.293,
        ],
        'poppins' => [
            'label' => 'Poppins',
            'category' => 'sans',
            'file' => 'Poppins',
            'bold' => true,
            'ascent' => 1.050,
            'descent' => 0.350,
        ],
    ],

];
