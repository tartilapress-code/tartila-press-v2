import { useState } from 'react';

type PersonAvatarProps = {
    name: string;
    photo: string | null;
    // Ukuran ditentukan pemakai (mis. "size-24"); bentuknya selalu bulat.
    className?: string;
    // Foto di bagian atas halaman dimuat langsung, bukan menunggu digulir.
    eager?: boolean;
};

/**
 * Foto profil bulat. Tanpa foto (atau gagal dimuat) tampil huruf awal nama di
 * atas gradien hijau; ukuran hurufnya ikut ukuran lingkaran.
 */
export default function PersonAvatar({
    name,
    photo,
    className = '',
    eager = false,
}: PersonAvatarProps) {
    const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
    const showPhoto = Boolean(photo) && failedPhoto !== photo;

    if (showPhoto) {
        return (
            <img
                src={photo ?? undefined}
                alt={name}
                loading={eager ? 'eager' : 'lazy'}
                onError={() => setFailedPhoto(photo)}
                className={`rounded-full bg-forest-moss-100 object-cover ${className}`}
            />
        );
    }

    return (
        <div
            role="img"
            aria-label={name}
            className={`@container flex items-center justify-center rounded-full bg-linear-to-br from-forest-moss-200 to-forest-moss-400 ${className}`}
        >
            <span
                aria-hidden
                className="font-display text-[42cqw] font-semibold leading-none text-oxford-navy-700"
            >
                {name.trim().charAt(0).toUpperCase() || '?'}
            </span>
        </div>
    );
}
