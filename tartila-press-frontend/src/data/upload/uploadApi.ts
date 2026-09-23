import { http } from '@/lib/http';

export type ImageFolder = 'covers' | 'profiles' | 'bio-photos' | 'packages';

export const uploadImage = (file: File, folder?: ImageFolder) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
        formData.append('folder', folder);
    }

    return http.upload('/auth/uploads/images', formData);
};
