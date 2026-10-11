// Halaman & kategori notifikasi tiap bagian menu dashboard, untuk menentukan
// grup mana yang terbuka dan angka merah grup yang tertutup.

function matches(pathname: string, paths: string[]): boolean {
    return paths.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
}

// Profil: Data Akun, Data Pribadi, Profil Publik.
export const PROFILE_PATHS = [
    '/dashboard/akun',
    '/dashboard/data-pribadi',
    '/dashboard/profil-publik',
];
export const PROFILE_CATEGORIES = ['role'];

// Panel Penulis: naskah (termasuk detail & kirim naskah), buku terbit,
// royalti, paket custom / ambil paket / beli slot bab, surat ISBN.
export const WRITER_PATHS = [
    '/dashboard/naskah',
    '/dashboard/submit-naskah',
    '/dashboard/buku-terbit',
    '/dashboard/royalti',
    '/dashboard/paket-custom',
    '/dashboard/ambil-paket',
    '/dashboard/beli-slot-bab',
    '/dashboard/isbn',
];
export const WRITER_CATEGORIES = ['manuscript', 'isbn', 'book'];

// Panel Editor.
export const EDITOR_PATHS = [
    '/dashboard/profil-editor',
    '/dashboard/pool-naskah',
    '/dashboard/naskah-ditugaskan',
    '/dashboard/fee-saya',
    '/dashboard/proyek-bab-buku-saya',
];
export const EDITOR_CATEGORIES = ['pool', 'assigned_manuscript'];

export const isProfilePage = (pathname: string) =>
    matches(pathname, PROFILE_PATHS);
export const isWriterPage = (pathname: string) =>
    matches(pathname, WRITER_PATHS);
export const isEditorPage = (pathname: string) =>
    matches(pathname, EDITOR_PATHS);
