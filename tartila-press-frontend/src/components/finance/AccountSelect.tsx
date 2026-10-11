import { useEffect, useState } from 'react';
import * as adminApi from '@/data/admin/adminApi';

type Method = {
    id: number;
    bank_name: string;
    account_number: string;
    is_active: boolean;
};

let cache: Promise<Method[]> | null = null;

/** Daftar rekening (sekali dimuat per halaman). */
function loadAccounts(): Promise<Method[]> {
    cache ??= adminApi
        .listPaymentMethodsAdmin()
        .then((response) => response.data as Method[])
        .catch(() => {
            cache = null;

            return [];
        });

    return cache;
}

/**
 * Pilihan rekening penerima/sumber transfer (untuk saldo per rekening di
 * halaman Keuangan). Kosong = belum ditentukan.
 */
export default function AccountSelect({
    value,
    onChange,
    label = 'Rekening',
    className = '',
}: {
    value: number | null;
    onChange: (id: number | null) => void;
    label?: string;
    className?: string;
}) {
    const [accounts, setAccounts] = useState<Method[]>([]);

    useEffect(() => {
        let active = true;

        void loadAccounts().then((list) => {
            if (active) {
                setAccounts(list);
            }
        });

        return () => {
            active = false;
        };
    }, []);

    return (
        <label
            className={`flex flex-col gap-0.5 text-xs text-oxford-navy-900/70 ${className}`}
        >
            {label}
            <select
                value={value ?? ''}
                onChange={(e) => onChange(Number(e.target.value) || null)}
                className="rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1 text-xs text-oxford-navy-900 outline-none focus:border-forest-moss-500"
            >
                <option value="">Belum ditentukan</option>
                {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                        {account.bank_name} · {account.account_number}
                        {account.is_active ? '' : ' (nonaktif)'}
                    </option>
                ))}
            </select>
        </label>
    );
}
