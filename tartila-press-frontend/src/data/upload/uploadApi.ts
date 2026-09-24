import { http } from '@/lib/http';

export type ImageFolder =
    | 'covers'
    | 'profiles'
    | 'bio-photos'
    | 'packages'
    | 'articles';

export type DocumentFolder = 'event-documents' | 'event-banners' | 'certificates';

export const uploadImage = (file: File, folder?: ImageFolder) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
        formData.append('folder', folder);
    }

    return http.upload('/auth/uploads/images', formData);
};

export const uploadDocument = (file: File, folder?: DocumentFolder) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
        formData.append('folder', folder);
    }

    return http.upload('/auth/uploads/documents', formData);
};
