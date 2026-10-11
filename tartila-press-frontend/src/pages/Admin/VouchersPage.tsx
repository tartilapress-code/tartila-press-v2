import { useCallback, useEffect, useState } from 'react';
import DiscountsTab from '@/components/voucher/admin/DiscountsTab';
import GrantsTab from '@/components/voucher/admin/GrantsTab';
import VouchersTab from '@/components/voucher/admin/VouchersTab';
import * as voucherApi from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';

type TabKey = 'discounts' | 'vouchers' | 'grants';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'discounts', label: 'Diskon Produk' },
    { key: 'vouchers', label: 'Voucher' },
    { key: 'grants', label: 'Hak Voucher Penulis/Editor' },
];

export default function VouchersPage() {
    const [tab, setTab] = useState<TabKey>('discounts');
    const [discounts, setDiscounts] = useState<voucherApi.DiscountRow[]>([]);
    const [vouchers, setVouchers] = useState<voucherApi.Voucher[]>([]);
    const [grants, setGrants] = useState<voucherApi.VoucherGrant[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const load = useCallback(() => {
        return Promise.all([
            voucherApi.adminListDiscounts(),
            voucherApi.adminListVouchers(),
            voucherApi.adminListGrants(),
        ])
            .then(([discountResponse, voucherResponse, grantResponse]) => {
                setDiscounts(discountResponse.data);
                setVouchers(voucherResponse.data);
                setGrants(grantResponse.data);
            })
            .catch((caught) => setErrorMessage(describeApiError(caught)))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Voucher dan Diskon
                </h5>

                <div
                    role="tablist"
                    className="flex flex-row flex-wrap gap-2 border-b border-forest-moss-100 pb-3"
                >
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={tab === item.key}
                            onClick={() => setTab(item.key)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:cursor-pointer ${
                                tab === item.key
                                    ? 'bg-oxford-navy-700 text-white'
                                    : 'text-oxford-navy-700 hover:bg-forest-moss-50'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                )}

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : tab === 'discounts' ? (
                    <DiscountsTab onChanged={load} />
                ) : tab === 'vouchers' ? (
                    <VouchersTab
                        vouchers={vouchers}
                        items={discounts}
                        onChanged={load}
                    />
                ) : (
                    <GrantsTab
                        grants={grants}
                        items={discounts}
                        onChanged={load}
                    />
                )}
            </div>
        </div>
    );
}
