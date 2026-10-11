import { useState } from 'react';
import SummaryTab from '@/components/finance/SummaryTab';
import TransactionsTab from '@/components/finance/TransactionsTab';
import {
    BooksTab,
    EbooksTab,
    EventsTab,
    PackagesTab,
    SettingsTab,
} from '@/components/finance/BreakdownTabs';

const TABS = [
    { key: 'summary', label: 'Ringkasan' },
    { key: 'transactions', label: 'Transaksi' },
    { key: 'packages', label: 'Paket & Book Chapter' },
    { key: 'books', label: 'Buku' },
    { key: 'ebooks', label: 'Tartila Book' },
    { key: 'events', label: 'Event' },
    { key: 'settings', label: 'Pengaturan' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** Keuangan admin: saldo, arus kas, omzet, rincian estimasi laba. */
export default function FinancePage() {
    const [tab, setTab] = useState<TabKey>('summary');

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                    Keuangan
                </h5>
                <p className="text-sm text-oxford-navy-900/65">
                    Pemasukan dari pesanan yang sudah dibayar, pengeluaran
                    (penarikan saldo & transaksi manual), saldo tiap rekening,
                    dan estimasi laba per paket, Book Chapter, buku, ebook
                    Tartila Book, dan event. Status <strong>Hold</strong> =
                    sudah dibayar tetapi prosesnya belum selesai.
                </p>
            </div>

            <div
                role="tablist"
                aria-label="Bagian keuangan"
                className="flex gap-2 overflow-x-auto pb-1"
            >
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        id={`finance-tab-${item.key}`}
                        aria-selected={tab === item.key}
                        aria-controls="finance-panel"
                        onClick={() => setTab(item.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            tab === item.key
                                ? 'bg-oxford-navy-700 text-white'
                                : 'bg-white text-oxford-navy-900 ring-1 ring-forest-moss-100 hover:bg-forest-moss-50'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div
                id="finance-panel"
                role="tabpanel"
                aria-labelledby={`finance-tab-${tab}`}
            >
                {tab === 'summary' && <SummaryTab />}
                {tab === 'transactions' && <TransactionsTab />}
                {tab === 'packages' && <PackagesTab />}
                {tab === 'books' && <BooksTab />}
                {tab === 'ebooks' && <EbooksTab />}
                {tab === 'events' && <EventsTab />}
                {tab === 'settings' && <SettingsTab />}
            </div>
        </div>
    );
}
