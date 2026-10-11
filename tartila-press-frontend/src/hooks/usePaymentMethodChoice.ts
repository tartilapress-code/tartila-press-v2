import { useEffect, useState } from 'react';
import * as paymentMethodApi from '@/data/paymentMethod/paymentMethodApi';
import type { PaymentMethod } from '@/data/paymentMethod/paymentMethodApi';

export type PaymentMethodChoice = {
    methods: PaymentMethod[];
    selectedId: number | null;
    setSelectedId: (id: number) => void;
    isLoading: boolean;
    // Ada rekening aktif tetapi belum dipilih (pesanan belum boleh dikirim).
    isMissing: boolean;
};

/**
 * Pilihan rekening tujuan transfer di halaman pemesanan. Bila hanya ada satu
 * rekening aktif, rekening itu langsung terpilih.
 */
export function usePaymentMethodChoice(): PaymentMethodChoice {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;

        paymentMethodApi
            .list()
            .then((response) => {
                if (cancelled) return;
                const list = response.data as PaymentMethod[];
                setMethods(list);
                if (list.length === 1) setSelectedId(list[0].id);
            })
            .catch(() => {
                if (!cancelled) setMethods([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return {
        methods,
        selectedId,
        setSelectedId,
        isLoading,
        isMissing: methods.length > 0 && selectedId === null,
    };
}
