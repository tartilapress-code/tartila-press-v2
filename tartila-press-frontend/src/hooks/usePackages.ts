import { useEffect, useState } from 'react';
import * as packageApi from '@/data/package/packageApi';
import type { PackageSummary } from '@/data/package/packageApi';

/** Paket aktif dari katalog publik (yang terbaru lebih dulu). */
export function usePackages() {
    const [packages, setPackages] = useState<PackageSummary[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        packageApi
            .list()
            .then((response) => setPackages(response.data))
            .catch(() => setPackages([]))
            .finally(() => setIsLoading(false));
    }, []);

    return { packages, isLoading };
}
