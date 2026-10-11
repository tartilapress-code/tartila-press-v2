<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IsbnLetterSetting extends Model
{
    /**
     * Isi bawaan surat — mengikuti contoh "Surat Permohonan.docx". Teks yang
     * bisa diubah admin memakai penanda {judul}, {penulis}, {penerbit},
     * {penandatangan} (penulis / editor).
     */
    public const DEFAULTS = [
        'city' => 'Batam',
        'publisher_name' => 'Tartila Press',
        'publisher_address' => 'Jl. Sumatera Blok A1 No 3 RT 10 RW 5 Kelurahan Sadai Kec. Bengkong, Kota Batam, Prov. Kepulauan Riau',
        'website' => 'www.tartilapress.com',
        'email' => 'tartilapress@gmail.com',
        'responsible_name' => 'Rahima Tartila',
        'admin_name' => 'Ravina Sidqi',
        'letter_code' => 'PISBN/TP',
        'subject' => 'Permohonan ISBN/Barcode untuk buku',
        'recipient' => 'Yth. Kepala Pusat Bibliografi dan Pengolahan Bahan Perpustakaan Perpustakaan Nasional RI',
        'application_body' => 'Bersama ini kami lampirkan dummy buku dan surat pernyataan keaslian karya dari {penandatangan}. Penerbit akan bertanggungjawab terhadap isi buku dan bersedia menanggung segala bentuk risiko yang terjadi jika ada permasalahan setelah buku tersebut diterbitkan.',
        'application_closing' => 'Demikian permohonan ini kami ajukan, atas perhatian dan kerja samanya diucapkan terima kasih.',
        'statement_body' => 'Adalah benar merupakan karya asli yang dibuat untuk diterbitkan dan disebarluaskan secara umum, melalui :',
        'statement_closing' => 'Demikian surat ini dibuat dengan sebenar-benarnya serta akan menjadi pertanggungjawaban kami jika terdapat penyalahgunaan dan akibat yang ditimbulkan.',
    ];

    /** Kolom teks yang boleh diubah admin (selain berkas gambar). */
    public const TEXT_FIELDS = [
        'city', 'publisher_name', 'publisher_address', 'website', 'email',
        'responsible_name', 'admin_name', 'letter_code', 'subject', 'recipient',
        'application_body', 'application_closing', 'statement_body', 'statement_closing',
    ];

    protected $fillable = [
        ...self::TEXT_FIELDS,
        'logo_path',
        'signature_path',
        'stamp_path',
    ];

    public static function current(): self
    {
        return static::query()->first() ?? static::create(self::DEFAULTS);
    }
}
