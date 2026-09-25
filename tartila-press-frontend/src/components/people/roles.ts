export type PeopleRole = 'penulis' | 'editor';

// Peran (nama di database) yang tampil sebagai lencana. Peran lain (User,
// Admin, dst.) tidak relevan bagi pengunjung. Teks tampilannya ada di berkas
// terjemahan (`people.roleLabels.<peran>`).
const VISIBLE_ROLES = ['Penulis', 'Editor'] as const;

export type VisibleRole = (typeof VISIBLE_ROLES)[number];

/** Peran pada halaman daftar/profil, dalam nama peran di database. */
export const ROLE_NAME: Record<PeopleRole, VisibleRole> = {
    penulis: 'Penulis',
    editor: 'Editor',
};

export function displayRoles(roles: string[]): VisibleRole[] {
    return VISIBLE_ROLES.filter((role) => roles.includes(role));
}
