export type PeopleRole = 'penulis' | 'editor';

export type RoleCopy = {
    label: string;
    heroTitle: [string, string];
    heroText: string;
    script: [string, string];
    directoryTitle: string;
    searchPlaceholder: string;
    emptyText: string;
    listQuote: string;
    profileQuote: string;
    aboutTitle: string;
};

export const roleCopy: Record<PeopleRole, RoleCopy> = {
    penulis: {
        label: 'Penulis',
        heroTitle: ['List ', 'Penulis Lainnya'],
        heroText:
            'Temukan para penulis hebat lainnya yang bergabung bersama Tartila Press. Mereka adalah bagian dari ekosistem literasi yang terus tumbuh untuk menghadirkan karya-karya terbaik.',
        script: ['Bersama Penulis,', 'Membangun Literasi'],
        directoryTitle: 'Daftar Penulis',
        searchPlaceholder: 'Cari nama penulis...',
        emptyText: 'Belum ada penulis yang ditampilkan.',
        listQuote:
            'Setiap penulis memiliki cerita unik, dan setiap cerita layak untuk dibaca.',
        profileQuote: 'Buku adalah jembatan menuju masa depan yang lebih baik.',
        aboutTitle: 'Tentang Penulis',
    },
    editor: {
        label: 'Editor',
        heroTitle: ['List ', 'Editor Lainnya'],
        heroText:
            'Kenali para editor profesional yang menyempurnakan setiap naskah bersama Tartila Press. Mereka membaca dengan teliti, merapikan gagasan, dan memastikan karya siap sampai ke pembaca.',
        script: ['Bersama Editor,', 'Menyempurnakan Karya'],
        directoryTitle: 'Daftar Editor',
        searchPlaceholder: 'Cari nama editor...',
        emptyText: 'Belum ada editor yang ditampilkan.',
        listQuote:
            'Di balik setiap buku yang baik, ada editor yang membaca dengan teliti.',
        profileQuote: 'Naskah yang baik lahir dari tangan editor yang teliti.',
        aboutTitle: 'Tentang Editor',
    },
};

// Peran yang ditampilkan sebagai lencana. Peran lain (User, Admin, dst.)
// tidak relevan bagi pengunjung.
const VISIBLE_ROLES = ['Penulis', 'Editor'];

export function displayRoles(roles: string[]): string[] {
    return VISIBLE_ROLES.filter((role) => roles.includes(role));
}
