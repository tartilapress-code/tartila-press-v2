import { useEffect, useState } from 'react';
import * as customPackageItemApi from '@/data/customPackageItem/customPackageItemApi';
import type { CustomItem } from '@/data/customPackageItem/customPackageItemApi';

/** Item custom aktif (fasilitas lalu layanan, urut nama) dari API publik. */
export function useCustomItems() {
    const [items, setItems] = useState<CustomItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        customPackageItemApi
            .list()
            .then((response) => setItems(response.data))
            .catch(() => setItems([]))
            .finally(() => setIsLoading(false));
    }, []);

    return { items, isLoading };
}
