import { RiArrowUpLine } from '@remixicon/react';
import { HashLink } from 'react-router-hash-link';

/** Tombol "Go Up" melayang untuk kembali ke bagian atas beranda. */
export default function Top(): React.ReactNode {
    return (
        <>
            <HashLink to="#home" smooth>
                <div className="flex h-fit w-fit cursor-pointer flex-row items-center gap-2 rounded-full bg-forest-moss-600 py-2 pl-2 pr-4 text-white shadow-lg transition-colors hover:bg-forest-moss-700">
                    <span className="flex size-7 items-center justify-center rounded-full bg-white text-forest-moss-700">
                        <RiArrowUpLine aria-hidden className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">Go Up</span>
                </div>
            </HashLink>
        </>
    );
}
