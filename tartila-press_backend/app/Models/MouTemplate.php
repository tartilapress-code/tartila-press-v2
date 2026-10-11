<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Template MOU distribusi buku per kategori paket: "regular" (paket biasa)
 * dan "chapter" (Book Chapter). Perubahan template hanya berlaku untuk MOU
 * yang belum ditandatangani siapa pun (berlaku maju).
 *
 * Penanda di teks: {judul}, {penerbit}.
 */
class MouTemplate extends Model
{
    public const CATEGORIES = ['regular', 'chapter'];

    public const CATEGORY_LABELS = [
        'regular' => 'Paket biasa',
        'chapter' => 'Book Chapter',
    ];

    public const MODES = ['one', 'all'];

    protected $fillable = [
        'category',
        'title',
        'opening',
        'distribution_options',
        'distribution_mode',
        'physical_royalty',
        'ebook_royalty',
        'first_party_terms',
        'second_party_terms',
        'closing_terms',
        'contact_note',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'distribution_options' => 'array',
            'physical_royalty' => 'float',
            'ebook_royalty' => 'float',
            'first_party_terms' => 'array',
            'second_party_terms' => 'array',
            'closing_terms' => 'array',
        ];
    }

    /** Template kategori ini (dibuat dari isi bawaan bila belum ada). */
    public static function current(string $category): self
    {
        return self::firstOrCreate(['category' => $category], self::defaults($category));
    }

    /** @return array<string, mixed> */
    public static function defaults(string $category): array
    {
        $chapter = $category === 'chapter';
        $work = $chapter ? 'naskah bab yang ditulisnya dalam buku Book Chapter {judul}' : 'naskah buku {judul}';

        return [
            'title' => 'PERJANJIAN KERJA SAMA (MOU) DISTRIBUSI BUKU',
            'opening' => 'Pihak Pertama dan Pihak Kedua sepakat mengadakan perjanjian kerja sama penerbitan dan distribusi buku {judul} dengan ketentuan sebagai berikut.',
            'distribution_options' => [
                ['key' => 'online', 'name' => 'Toko online & marketplace', 'description' => 'Penjualan melalui situs Tartila Press, marketplace, dan toko online mitra.'],
                ['key' => 'offline', 'name' => 'Toko buku & penjualan langsung', 'description' => 'Penjualan buku fisik melalui toko buku, pameran, dan penjualan langsung.'],
                ['key' => 'ebook', 'name' => 'Platform ebook', 'description' => 'Penjualan ebook melalui platform buku digital (mis. Google Play Books).'],
            ],
            'distribution_mode' => 'all',
            'physical_royalty' => 25,
            'ebook_royalty' => 25,
            'first_party_terms' => [
                'Menerbitkan dan mendistribusikan buku {judul} melalui saluran distribusi yang disepakati dalam perjanjian ini.',
                'Mencatat penjualan dan membayarkan royalti kepada Pihak Kedua sesuai persentase dalam perjanjian ini.',
                'Menyediakan laporan penjualan dan royalti yang dapat dilihat Pihak Kedua di menu Royalti Saya.',
                'Tidak mengubah isi buku tanpa persetujuan Pihak Kedua.',
            ],
            'second_party_terms' => [
                "Menjamin {$work} adalah karya asli dan tidak melanggar hak cipta pihak lain.",
                'Memberikan hak distribusi buku kepada Pihak Pertama sesuai hak distribusi dalam perjanjian ini.',
                'Menerima royalti sesuai persentase yang tercantum dalam perjanjian ini.',
                'Tidak menerbitkan atau mendistribusikan buku yang sama melalui pihak lain tanpa persetujuan tertulis Pihak Pertama.',
            ],
            'closing_terms' => [
                'Perubahan aturan oleh Pihak Pertama setelah perjanjian ini ditandatangani hanya berlaku untuk perjanjian berikutnya. Perjanjian yang sudah ditandatangani dan bermeterai tidak dapat diganggu gugat.',
                'Apabila Pihak Kedua ingin mengubah isi perjanjian, Pihak Kedua dapat mengajukan adendum secara resmi melalui email kepada Pihak Pertama.',
                'Adendum hanya berlaku apabila disetujui dan ditandatangani oleh kedua belah pihak.',
                'Pelanggaran terhadap perjanjian ini dapat ditindak sesuai hukum yang berlaku di Republik Indonesia.',
            ],
            'contact_note' => 'Jika ada isi yang perlu disesuaikan, hubungi admin melalui WhatsApp atau email sebelum menandatangani.',
        ];
    }

    /**
     * Isi template sebagai salinan untuk satu MOU.
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        return [
            'title' => $this->title,
            'opening' => $this->opening,
            'distribution_options' => array_values($this->distribution_options ?? []),
            'distribution_mode' => $this->distribution_mode,
            'royalty' => ['physical' => $this->physical_royalty, 'ebook' => $this->ebook_royalty],
            'first_party_terms' => array_values($this->first_party_terms ?? []),
            'second_party_terms' => array_values($this->second_party_terms ?? []),
            'closing_terms' => array_values($this->closing_terms ?? []),
            'contact_note' => $this->contact_note,
        ];
    }
}
