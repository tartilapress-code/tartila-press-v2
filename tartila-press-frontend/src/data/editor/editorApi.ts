import { http } from '@/lib/http';

export type EditorProfilePayload = Partial<{
    fee: number | string;
    bio: string;
    is_available: boolean;
}>;

export const directory = () => http.get('/editors');

export const getMyProfile = () => http.get('/editor/profile');

export const upsertMyProfile = (payload: EditorProfilePayload) =>
    http.post('/editor/profile', payload);

export const manuscriptPool = () => http.get('/editor/manuscript-pool');

export const claimManuscript = (id: number | string) =>
    http.post(`/editor/manuscript-pool/${id}/claim`);

export const myManuscripts = () => http.get('/editor/manuscripts');

export const myFees = () => http.get('/editor/fees');

export type ChapterInput = {
    title: string;
    price?: number | string | null;
    discount?: number | null;
    sop_terms?: string | null;
};

export type BookChapterProjectPayload = Partial<{
    title: string;
    book_category_id: number | string;
    field_category_id: number | string;
    price: number | string;
    discount: number;
    description: string;
    about: string;
    facilities: string[];
    services: string[];
    front_cover: string;
    back_cover: string;
    estimated_publish_date: string;
    submission_deadline: string;
    chapters: ChapterInput[];
    includes_hki: boolean;
    includes_isbn_print: boolean;
    includes_isbn_electronic: boolean;
    package_item_ids: number[];
}>;

export const getBookChapterSettings = () => http.get('/editor/book-chapter-settings');

// Fasilitas & layanan (item paket custom) yang bisa dicentang, beserta biaya
// khusus Book Chapter (null = gratis).
export const getBookChapterPackageItems = () =>
    http.get('/editor/book-chapter-package-items');

export const myBookChapterProjects = () => http.get('/editor/book-chapter-projects');

export const getMyBookChapterProject = (id: number | string) =>
    http.get(`/editor/book-chapter-projects/${id}`);

export const createMyBookChapterProject = (payload: BookChapterProjectPayload) =>
    http.post('/editor/book-chapter-projects', payload);

export const updateMyBookChapterProject = (
    id: number | string,
    payload: BookChapterProjectPayload
) => http.patch(`/editor/book-chapter-projects/${id}`, payload);

export const addMyBookChapterProjectChapter = (
    projectId: number | string,
    payload: ChapterInput
) => http.post(`/editor/book-chapter-projects/${projectId}/chapters`, payload);

export const updateMyBookChapterProjectChapter = (
    chapterId: number | string,
    payload: Partial<ChapterInput>
) => http.patch(`/editor/book-chapter-projects/chapters/${chapterId}`, payload);

export const deleteMyBookChapterProjectChapter = (chapterId: number | string) =>
    http.delete(`/editor/book-chapter-projects/chapters/${chapterId}`);
