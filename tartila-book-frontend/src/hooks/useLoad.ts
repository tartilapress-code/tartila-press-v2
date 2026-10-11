import { useCallback, useEffect, useState } from 'react';
import { describeApiError } from '@/lib/apiErrors';

type Result<T> = {
    loader: unknown;
    tick: number;
    data?: T;
    error?: string;
};

/**
 * Memuat data dari `loader` (harus stabil: bungkus dengan useCallback).
 * Data lama tetap tampil selama memuat ulang; `reload()` mengulang pemuatan.
 */
export function useLoad<T>(loader: () => Promise<T>) {
    const [tick, setTick] = useState<number>(0);
    const [result, setResult] = useState<Result<T> | null>(null);

    useEffect(() => {
        let active = true;

        loader()
            .then((data) => active && setResult({ loader, tick, data }))
            .catch(
                (caught) =>
                    active &&
                    setResult({ loader, tick, error: describeApiError(caught) })
            );

        return () => {
            active = false;
        };
    }, [loader, tick]);

    const reload = useCallback(() => setTick((value) => value + 1), []);

    return {
        data: result?.data ?? null,
        error: result?.loader === loader ? (result.error ?? '') : '',
        loading: !result || result.loader !== loader || result.tick !== tick,
        reload,
    };
}
