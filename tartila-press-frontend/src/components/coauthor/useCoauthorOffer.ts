import { useEffect, useState } from 'react';
import type { EditorOption } from '@/components/editor/EditorPicker';
import * as editorApi from '@/data/editor/editorApi';

/**
 * Pilihan layanan co-author di halaman ambil paket: centang "Saya ingin dibantu
 * co-author", keterangan royalti tetap + penambahan nama, dan (opsional) memilih
 * sendiri co-author-nya. Tidak memilih = admin yang menentukan co-author.
 */
export function useCoauthorOffer() {
    const [wants, setWants] = useState<boolean>(false);
    const [choosesOwn, setChoosesOwn] = useState<boolean>(false);
    const [coauthors, setCoauthors] = useState<EditorOption[]>([]);
    const [royaltyPercent, setRoyaltyPercent] = useState<number>(5);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        if (wants && coauthors.length === 0) {
            editorApi.coauthorDirectory().then((response) => {
                setCoauthors(response.data);
                setRoyaltyPercent(
                    Number(response.meta?.royalty_percent ?? royaltyPercent)
                );
            });
        }
        // Dimuat sekali saat layanan pertama kali dicentang.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wants]);

    const selected = coauthors.find((item) => item.user_id === selectedId);
    const fee = wants && choosesOwn && selected ? Number(selected.fee) : 0;

    return {
        wants,
        setWants: (value: boolean) => {
            setWants(value);
            setChoosesOwn(false);
            setSelectedId(null);
        },
        choosesOwn,
        setChoosesOwn: (value: boolean) => {
            setChoosesOwn(value);
            setSelectedId(null);
        },
        coauthors,
        royaltyPercent,
        selectedId,
        setSelectedId,
        fee,
        /** Bagian payload `orderApi.create`. */
        payload: {
            wants_coauthor: wants || undefined,
            coauthor_id:
                wants && choosesOwn && selectedId ? selectedId : undefined,
        },
    };
}

export type CoauthorOfferState = ReturnType<typeof useCoauthorOffer>;
