// Tipe & fungsi bantu untuk halaman publik proyek Book Chapter (daftar dan
// detail). Bentuk datanya mengikuti `GET /book-chapter-projects[/{id}]`.

import defaultChapterCover from '@/assets/cover/book-chapter-default.svg';

/**
 * Sampul bawaan untuk semua Book Chapter (berkas
 * `src/assets/cover/book-chapter-default.svg`, rasio A5). Ganti isi berkas itu
 * bila ingin memakai desain sampul lain.
 */
export const DEFAULT_CHAPTER_COVER: string = defaultChapterCover;

export type SlotStatus = 'open' | 'reserved' | 'submitted' | 'completed';

export type ChapterSlot = {
    id: number;
    chapter_number: number;
    title: string;
    // Disembunyikan server untuk pengunjung yang belum login.
    sop_terms?: string | null;
    effective_price: string | number;
    effective_discount: number;
    final_price: number;
    slot_status: SlotStatus;
};

type NamedItem = { id: number; name: string };

export type ChapterProject = {
    id: number;
    title: string;
    front_cover: string | null;
    // Disembunyikan server untuk pengunjung yang belum login.
    description?: string | null;
    about: string | null;
    // Bahasa isi buku (kode); kosong bila belum diisi.
    languages: string[];
    // Daftar teks lama (sebelum fasilitas/layanan dicentang dari Paket Custom).
    facilities: string[] | null;
    services: string[] | null;
    // Yang dicentang admin/editor — nama dari daftar item Paket Custom.
    package_facilities?: string[];
    package_services?: string[];
    includes_hki?: boolean;
    includes_isbn_print?: boolean;
    includes_isbn_electronic?: boolean;
    price: string;
    discount: number;
    final_price: number;
    estimated_publish_date: string | null;
    submission_deadline: string | null;
    category: NamedItem | null;
    field_category: NamedItem | null;
    owner_editor: { id: number; name: string } | null;
    chapters: ChapterSlot[];
};

export function isPast(date: string | null): boolean {
    return date !== null && new Date(date).getTime() < Date.now();
}

/** Jumlah slot: total, masih terbuka, dan sudah terisi/dipesan. */
export function summarizeSlots(chapters: ChapterSlot[]) {
    const total = chapters.length;
    const open = chapters.filter((c) => c.slot_status === 'open').length;

    return { total, open, taken: total - open };
}

/**
 * Harga slot yang masih terbuka: harga termurah (`from`), harga aslinya bila
 * ada diskon, dan apakah harga tiap bab berbeda (`hasRange`). Null bila tak
 * ada slot terbuka.
 */
export function openPrice(chapters: ChapterSlot[]) {
    const open = chapters.filter((c) => c.slot_status === 'open');

    if (open.length === 0) {
        return null;
    }

    const cheapest = open.reduce((min, c) =>
        c.final_price < min.final_price ? c : min
    );
    const highest = Math.max(...open.map((c) => c.final_price));

    return {
        from: cheapest.final_price,
        original:
            cheapest.effective_discount > 0
                ? Number(cheapest.effective_price)
                : null,
        hasRange: highest !== cheapest.final_price,
    };
}

/** Nama kategori buku & bidang keilmuan proyek (yang terisi saja). */
export function categoryNames(project: ChapterProject): string[] {
    return [project.category?.name, project.field_category?.name].filter(
        (name): name is string => Boolean(name)
    );
}
