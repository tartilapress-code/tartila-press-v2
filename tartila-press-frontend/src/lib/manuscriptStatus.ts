/**
 * Status khusus naskah bab Book Chapter: bab disetujui admin menunggu bab
 * lain, lalu digabung menjadi satu naskah buku yang dikerjakan editor.
 */
export const CHAPTER_STATUS_LABELS: Record<string, string> = {
    awaiting_compilation: 'Disetujui — Menunggu Bab Lain Terkumpul',
    compiled: 'Sudah Digabung ke Naskah Buku',
};

/** Label singkat status naskah untuk daftar bab. */
export const SHORT_STATUS_LABELS: Record<string, string> = {
    submitted: 'Menunggu review admin',
    revision_requested: 'Perlu revisi penulis',
    pending_coauthor_assignment: 'Menunggu co-author',
    in_coauthoring: 'Disusun co-author',
    coauthor_revision_requested: 'Revisi co-author',
    pending_admin_review_coauthor: 'Review admin (susunan co-author)',
    pending_author_review_coauthor: 'Menunggu persetujuan penulis',
    pending_editor_assignment: 'Menunggu editor',
    in_editing: 'Sedang diedit',
    pending_admin_review_editor: 'Review admin (hasil editor)',
    editor_revision_requested: 'Revisi editor',
    pending_penulis_review: 'Review akhir penulis',
    completed: 'Selesai',
    awaiting_compilation: 'Siap digabung',
    compiled: 'Sudah digabung',
};
