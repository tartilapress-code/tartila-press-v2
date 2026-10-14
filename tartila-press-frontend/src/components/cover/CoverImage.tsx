import { useEffect, useState } from 'react';
import * as coverApi from '@/data/cover/coverApi';

/**
 * Gambar cover dari endpoint terautentikasi (tag <img> biasa tidak bisa membawa token).
 * Cover yang berkasnya sudah dihapus menampilkan keterangan.
 */
export default function CoverImage({
    coverId,
    publicUrl,
    purged = false,
    className = '',
}: {
    coverId: number;
    publicUrl?: string | null;
    purged?: boolean;
    className?: string;
}) {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState<boolean>(false);

    useEffect(() => {
        if (purged) {
            return;
        }

        let objectUrl: string | null = null;
        let active = true;

        coverApi
            .image(coverId)
            .then((blob) => {
                if (!active) return;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch(() => active && setFailed(true));

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [coverId, purged]);

    const src = url ?? publicUrl ?? null;

    if (src) {
        return (
            <img
                src={src}
                alt="Pilihan cover"
                className={`rounded-lg bg-forest-moss-50 object-contain ring-1 ring-forest-moss-100 ${className}`}
            />
        );
    }

    return (
        <div
            className={`flex items-center justify-center rounded-lg bg-forest-moss-50 p-2 text-center text-xs text-oxford-navy-900/60 ring-1 ring-forest-moss-100 ${className}`}
        >
            {purged || failed
                ? 'Berkas sudah dihapus dari sistem'
                : 'Memuat gambar...'}
        </div>
    );
}
