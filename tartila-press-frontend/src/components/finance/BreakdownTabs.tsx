import { useEffect, useState, type ReactNode } from 'react';
import Button from '@/components/Button/Button';
import * as financeApi from '@/data/finance/financeApi';
import { describeApiError } from '@/lib/apiErrors';
import BreakdownTable, { type Column } from './BreakdownTable';
import DetailEditor from './DetailEditor';
import {
    formatDate,
    profitClass,
    rupiah,
    STATUS_LABELS,
    statusClass,
} from './format';

const inputClass =
    'rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900';

function Status({ status }: { status: string }) {
    return (
        <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}
        >
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}

function Money({ value, minus = false }: { value: number; minus?: boolean }) {
    return (
        <span className={minus && value > 0 ? 'text-red-700' : ''}>
            {minus && value > 0 ? '− ' : ''}
            {rupiah(value)}
        </span>
    );
}

function Profit({ value }: { value: number }) {
    return <strong className={profitClass(value)}>{rupiah(value)}</strong>;
}

function Hint({ children }: { children: ReactNode }) {
    return (
        <span className="block text-xs text-oxford-navy-900/60">
            {children}
        </span>
    );
}

function RangeFilter({
    from,
    to,
    onChange,
}: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
}) {
    return (
        <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                Dibayar dari
                <input
                    type="date"
                    value={from}
                    onChange={(e) => onChange(e.target.value, to)}
                    className={inputClass}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                sampai
                <input
                    type="date"
                    value={to}
                    onChange={(e) => onChange(from, e.target.value)}
                    className={inputClass}
                />
            </label>
            {(from || to) && (
                <Button variant="outline2" onClick={() => onChange('', '')}>
                    Semua waktu
                </Button>
            )}
        </div>
    );
}

const PRICE_SOURCE: Record<string, string> = {
    admin: 'diisi admin',
    book: 'harga buku terbit',
    default: 'harga bawaan',
};

function printHint(row: {
    book_price: number;
    book_price_source: string;
    copies: { base: number; extra: number };
}) {
    return `${rupiah(row.book_price)} (${PRICE_SOURCE[row.book_price_source]}) × ${row.copies.base} + ${row.copies.extra} eks`;
}

// ===================================================================== Paket

export function PackagesTab() {
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');
    const [data, setData] = useState<{
        packages: financeApi.PackageRow[];
        book_chapters: financeApi.BookChapterRow[];
    } | null>(null);
    const [settings, setSettings] = useState<financeApi.FinanceSettings | null>(
        null
    );
    const [message, setMessage] = useState<string>('');

    function fetchRows(nextFrom: string, nextTo: string) {
        return financeApi
            .packages(nextFrom || undefined, nextTo || undefined)
            .then((response) => {
                setData(response.data);
                setSettings(response.settings);
            })
            .catch((caught) => setMessage(describeApiError(caught)));
    }

    useEffect(() => {
        void fetchRows(from, to);
    }, [from, to]);

    const packageColumns: Column<financeApi.PackageRow>[] = [
        {
            key: 'name',
            label: 'Pesanan',
            render: (row) => (
                <>
                    <span className="font-semibold text-oxford-navy-900">
                        {row.name}
                    </span>
                    <Hint>
                        {row.order_number} · {row.buyer ?? '-'} ·{' '}
                        {formatDate(row.date)}
                    </Hint>
                    {row.note && <Hint>Catatan: {row.note}</Hint>}
                </>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <Status status={row.status} />,
        },
        {
            key: 'price',
            label: 'Harga paket',
            align: 'right',
            sum: (r) => r.price,
            render: (row) => rupiah(row.price),
        },
        {
            key: 'discount',
            label: 'Diskon / voucher',
            align: 'right',
            sum: (r) => r.discount,
            render: (row) => <Money value={row.discount} minus />,
        },
        {
            key: 'editor_fee',
            label: 'Fee editor',
            align: 'right',
            sum: (r) => r.editor_fee,
            render: (row) => (
                <>
                    <Money value={row.editor_fee} minus />
                    <Hint>
                        {row.editor_fee_source === 'manuscript'
                            ? 'dari naskah'
                            : 'dari pesanan'}
                    </Hint>
                </>
            ),
        },
        {
            key: 'hki',
            label: 'HAKI',
            align: 'right',
            sum: (r) => r.hki,
            render: (row) =>
                row.includes_hki ? (
                    <Money value={row.hki} minus />
                ) : (
                    <Hint>tidak termasuk</Hint>
                ),
        },
        {
            key: 'print',
            label: 'Biaya cetak',
            align: 'right',
            sum: (r) => r.print_cost,
            render: (row) => (
                <>
                    <Money value={row.print_cost} minus />
                    <Hint>{printHint(row)}</Hint>
                </>
            ),
        },
        {
            key: 'admin',
            label: 'Adm & cover',
            align: 'right',
            sum: (r) => r.admin_cover,
            render: (row) => <Money value={row.admin_cover} minus />,
        },
        {
            key: 'other',
            label: 'Biaya lain',
            align: 'right',
            sum: (r) => r.other_costs,
            render: (row) => <Money value={row.other_costs} minus />,
        },
        {
            key: 'profit',
            label: 'Estimasi laba',
            align: 'right',
            sum: (r) => r.profit,
            render: (row) => <Profit value={row.profit} />,
        },
    ];

    const chapterColumns: Column<financeApi.BookChapterRow>[] = [
        {
            key: 'title',
            label: 'Proyek Book Chapter',
            render: (row) => (
                <>
                    <span className="font-semibold text-oxford-navy-900">
                        {row.title}
                    </span>
                    <Hint>
                        {row.sold_count}/{row.chapter_count} bab terjual
                        {row.owner_editor
                            ? ` · editor ${row.owner_editor}`
                            : ''}
                    </Hint>
                    {row.note && <Hint>Catatan: {row.note}</Hint>}
                </>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <Status status={row.status} />,
        },
        {
            key: 'price',
            label: 'Harga bab terjual',
            align: 'right',
            sum: (r) => r.price,
            render: (row) => rupiah(row.price),
        },
        {
            key: 'discount',
            label: 'Diskon / voucher',
            align: 'right',
            sum: (r) => r.discount,
            render: (row) => <Money value={row.discount} minus />,
        },
        {
            key: 'editor_fee',
            label: 'Fee editor',
            align: 'right',
            sum: (r) => r.editor_fee,
            render: (row) => <Money value={row.editor_fee} minus />,
        },
        {
            key: 'hki',
            label: 'HAKI',
            align: 'right',
            sum: (r) => r.hki,
            render: (row) =>
                row.includes_hki ? (
                    <Money value={row.hki} minus />
                ) : (
                    <Hint>tidak termasuk</Hint>
                ),
        },
        {
            key: 'print',
            label: 'Biaya cetak',
            align: 'right',
            sum: (r) => r.print_cost,
            render: (row) => (
                <>
                    <Money value={row.print_cost} minus />
                    <Hint>{printHint(row)}</Hint>
                </>
            ),
        },
        {
            key: 'admin',
            label: 'Adm & cover',
            align: 'right',
            sum: (r) => r.admin_cover,
            render: (row) => <Money value={row.admin_cover} minus />,
        },
        {
            key: 'other',
            label: 'Biaya lain',
            align: 'right',
            sum: (r) => r.other_costs,
            render: (row) => (
                <>
                    <Money value={row.other_costs} minus />
                    {row.auto_other_costs > 0 && (
                        <Hint>ISBN & item {rupiah(row.auto_other_costs)}</Hint>
                    )}
                </>
            ),
        },
        {
            key: 'profit',
            label: 'Estimasi laba',
            align: 'right',
            sum: (r) => r.profit,
            render: (row) => <Profit value={row.profit} />,
        },
    ];

    const reload = () => void fetchRows(from, to);

    return (
        <div className="flex flex-col gap-6">
            <RangeFilter
                from={from}
                to={to}
                onChange={(nextFrom, nextTo) => {
                    setFrom(nextFrom);
                    setTo(nextTo);
                }}
            />
            {settings && (
                <p className="text-xs text-oxford-navy-900/65">
                    Biaya cetak = {settings.print_cost_percent}% × harga jual
                    buku × ({settings.base_print_copies} + N eksemplar dari
                    fasilitas). HAKI {rupiah(settings.hki_cost)}. Administrasi &
                    cover {rupiah(settings.admin_cover_cost)}.
                    {settings.default_book_price <= 0 &&
                        ' Harga jual buku bawaan masih Rp 0 — isi di tab Pengaturan supaya biaya cetak terhitung.'}
                </p>
            )}
            {message && <p className="text-sm text-red-700">{message}</p>}

            <section className="flex flex-col gap-2">
                <h6 className="font-semibold text-oxford-navy-900">
                    Paket & paket custom
                </h6>
                <BreakdownTable
                    caption="Rincian paket"
                    rows={data?.packages ?? []}
                    columns={packageColumns}
                    rowKey={(row) => row.id}
                    emptyText="Belum ada pesanan paket yang dibayar."
                    editor={(row, close) => (
                        <DetailEditor
                            subjectType="order"
                            subjectId={row.id}
                            fields={[
                                'book_price',
                                'extra_copies',
                                'includes_hki',
                                'admin_cover_cost',
                                'other_costs',
                                'note',
                            ]}
                            overrides={row.overrides}
                            automatic={{
                                book_price:
                                    row.book_price_source === 'admin'
                                        ? (settings?.default_book_price ?? 0)
                                        : row.book_price,
                                extra_copies: row.copies.extra_auto,
                                includes_hki: row.hki_auto,
                                admin_cover_cost:
                                    settings?.admin_cover_cost ?? 0,
                            }}
                            onSaved={() => {
                                close();
                                reload();
                            }}
                            onCancel={close}
                        />
                    )}
                />
            </section>

            <section className="flex flex-col gap-2">
                <h6 className="font-semibold text-oxford-navy-900">
                    Book Chapter (per proyek)
                </h6>
                <BreakdownTable
                    caption="Rincian Book Chapter"
                    rows={data?.book_chapters ?? []}
                    columns={chapterColumns}
                    rowKey={(row) => row.id}
                    emptyText="Belum ada slot bab yang terjual."
                    editor={(row, close) => (
                        <DetailEditor
                            subjectType="book"
                            subjectId={row.id}
                            fields={[
                                'book_price',
                                'extra_copies',
                                'includes_hki',
                                'admin_cover_cost',
                                'other_costs',
                                'note',
                            ]}
                            overrides={row.overrides}
                            automatic={{
                                book_price: settings?.default_book_price ?? 0,
                                extra_copies: row.copies.extra_auto,
                                includes_hki: row.hki_auto,
                                admin_cover_cost:
                                    settings?.admin_cover_cost ?? 0,
                            }}
                            onSaved={() => {
                                close();
                                reload();
                            }}
                            onCancel={close}
                        />
                    )}
                />
            </section>
        </div>
    );
}

// ====================================================================== Buku

export function BooksTab() {
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');
    const [rows, setRows] = useState<financeApi.BookRow[]>([]);
    const [settings, setSettings] = useState<financeApi.FinanceSettings | null>(
        null
    );
    const [message, setMessage] = useState<string>('');

    function fetchRows(nextFrom: string, nextTo: string) {
        return financeApi
            .books(nextFrom || undefined, nextTo || undefined)
            .then((response) => {
                setRows(response.data);
                setSettings(response.settings);
            })
            .catch((caught) => setMessage(describeApiError(caught)));
    }

    useEffect(() => {
        void fetchRows(from, to);
    }, [from, to]);

    const columns: Column<financeApi.BookRow>[] = [
        {
            key: 'title',
            label: 'Buku',
            render: (row) => (
                <>
                    <span className="font-semibold text-oxford-navy-900">
                        {row.title}
                    </span>
                    <Hint>
                        {row.quantity} eks terjual
                        {row.hold_count > 0
                            ? ` · ${row.hold_count} pesanan hold`
                            : ''}
                    </Hint>
                    {row.note && <Hint>Catatan: {row.note}</Hint>}
                </>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <Status status={row.status} />,
        },
        {
            key: 'price',
            label: 'Harga',
            align: 'right',
            sum: (r) => r.price,
            render: (row) => rupiah(row.price),
        },
        {
            key: 'discount',
            label: 'Diskon / voucher',
            align: 'right',
            sum: (r) => r.discount,
            render: (row) => <Money value={row.discount} minus />,
        },
        {
            key: 'print',
            label: 'Biaya cetak',
            align: 'right',
            sum: (r) => r.print_cost,
            render: (row) => (
                <>
                    <Money value={row.print_cost} minus />
                    <Hint>
                        {settings?.print_cost_percent ?? 20}% harga jual
                    </Hint>
                </>
            ),
        },
        {
            key: 'royalty',
            label: 'Royalti',
            align: 'right',
            sum: (r) => r.royalty,
            render: (row) => (
                <>
                    <Money value={row.royalty} minus />
                    <Hint>{row.royalty_rate}%</Hint>
                </>
            ),
        },
        {
            key: 'other',
            label: 'Biaya lain',
            align: 'right',
            sum: (r) => r.other_costs,
            render: (row) => <Money value={row.other_costs} minus />,
        },
        {
            key: 'profit',
            label: 'Estimasi laba',
            align: 'right',
            sum: (r) => r.profit,
            render: (row) => <Profit value={row.profit} />,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <RangeFilter
                from={from}
                to={to}
                onChange={(nextFrom, nextTo) => {
                    setFrom(nextFrom);
                    setTo(nextTo);
                }}
            />
            {message && <p className="text-sm text-red-700">{message}</p>}
            <BreakdownTable
                caption="Rincian penjualan buku"
                rows={rows}
                columns={columns}
                rowKey={(row) => row.id}
                emptyText="Belum ada penjualan buku yang dibayar."
                editor={(row, close) => (
                    <DetailEditor
                        subjectType="book"
                        subjectId={row.id}
                        fields={['other_costs', 'note']}
                        overrides={row.overrides}
                        automatic={{ other_costs: 0 }}
                        onSaved={() => {
                            close();
                            void fetchRows(from, to);
                        }}
                        onCancel={close}
                    />
                )}
            />
        </div>
    );
}

// ============================================================== Tartila Book

export function EbooksTab() {
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');
    const [rows, setRows] = useState<financeApi.EbookRow[]>([]);
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        financeApi
            .ebooks(from || undefined, to || undefined)
            .then((response) => setRows(response.data))
            .catch((caught) => setMessage(describeApiError(caught)));
    }, [from, to]);

    const columns: Column<financeApi.EbookRow>[] = [
        {
            key: 'title',
            label: 'Ebook / langganan',
            render: (row) => (
                <>
                    <span className="font-semibold text-oxford-navy-900">
                        {row.title}
                    </span>
                    <Hint>
                        {row.kind === 'subscription'
                            ? `${row.orders} langganan dibayar`
                            : `${row.orders} pembelian · ${row.read_events} bacaan dari ${row.readers} pembaca`}
                    </Hint>
                </>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <Status status={row.status} />,
        },
        {
            key: 'price',
            label: 'Pendapatan',
            align: 'right',
            sum: (r) => r.price,
            render: (row) => rupiah(row.price),
        },
        {
            key: 'purchase',
            label: 'Royalti pembelian',
            align: 'right',
            sum: (r) => r.purchase_royalty,
            render: (row) => (
                <>
                    <Money value={row.purchase_royalty} minus />
                    {row.kind === 'book' && (
                        <Hint>{row.purchase_percent}% pembelian</Hint>
                    )}
                </>
            ),
        },
        {
            key: 'reads',
            label: 'Royalti bacaan',
            align: 'right',
            sum: (r) => r.read_royalty,
            render: (row) => (
                <>
                    <Money value={row.read_royalty} minus />
                    {row.kind === 'book' && (
                        <Hint>
                            {row.read_events} × {rupiah(row.read_fee)}
                        </Hint>
                    )}
                </>
            ),
        },
        {
            key: 'profit',
            label: 'Estimasi laba',
            align: 'right',
            sum: (r) => r.profit,
            render: (row) => <Profit value={row.profit} />,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-oxford-navy-900/65">
                Pembelian dan langganan di Tartila Book yang sudah dikonfirmasi.
                Royalti penulis (pembelian + bacaan) dihitung dari pengaturan
                yang berlaku sekarang dan sudah masuk ke Dompet Saya penulis.
                Biaya cetak tidak ada karena ebook.
            </p>
            <RangeFilter
                from={from}
                to={to}
                onChange={(nextFrom, nextTo) => {
                    setFrom(nextFrom);
                    setTo(nextTo);
                }}
            />
            {message && <p className="text-sm text-red-700">{message}</p>}
            <BreakdownTable
                caption="Rincian Tartila Book"
                rows={rows}
                columns={columns}
                rowKey={(row) => `${row.kind}-${row.id}`}
                emptyText="Belum ada pembelian atau bacaan di Tartila Book."
            />
        </div>
    );
}

// ===================================================================== Event

export function EventsTab() {
    const [rows, setRows] = useState<financeApi.EventRow[]>([]);
    const [message, setMessage] = useState<string>('');

    function fetchRows() {
        return financeApi
            .events()
            .then((response) => setRows(response.data))
            .catch((caught) => setMessage(describeApiError(caught)));
    }

    useEffect(() => {
        void fetchRows();
    }, []);

    const columns: Column<financeApi.EventRow>[] = [
        {
            key: 'title',
            label: 'Event',
            render: (row) => (
                <>
                    <span className="font-semibold text-oxford-navy-900">
                        {row.title}
                    </span>
                    <Hint>{formatDate(row.date)}</Hint>
                    {row.note && <Hint>Catatan: {row.note}</Hint>}
                </>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <Status status={row.status} />,
        },
        {
            key: 'fee',
            label: 'Harga',
            align: 'right',
            render: (row) => (row.fee > 0 ? rupiah(row.fee) : 'Gratis'),
        },
        {
            key: 'participants',
            label: 'Peserta',
            align: 'right',
            render: (row) => (
                <>
                    {row.participants}
                    {row.fee > 0 && <Hint>{row.paid_count} bayar</Hint>}
                </>
            ),
        },
        {
            key: 'price',
            label: 'Pendapatan',
            align: 'right',
            sum: (r) => r.price,
            render: (row) => rupiah(row.price),
        },
        {
            key: 'discount',
            label: 'Diskon / voucher',
            align: 'right',
            sum: (r) => r.discount,
            render: (row) => <Money value={row.discount} minus />,
        },
        {
            key: 'speaker',
            label: 'Fee pemateri',
            align: 'right',
            sum: (r) => r.speaker_fee,
            render: (row) => <Money value={row.speaker_fee} minus />,
        },
        {
            key: 'other',
            label: 'Biaya lainnya',
            align: 'right',
            sum: (r) => r.other_costs,
            render: (row) => <Money value={row.other_costs} minus />,
        },
        {
            key: 'profit',
            label: 'Estimasi laba',
            align: 'right',
            sum: (r) => r.profit,
            render: (row) => <Profit value={row.profit} />,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            {message && <p className="text-sm text-red-700">{message}</p>}
            <BreakdownTable
                caption="Rincian biaya pendaftaran event"
                rows={rows}
                columns={columns}
                rowKey={(row) => row.id}
                emptyText="Belum ada event."
                editor={(row, close) => (
                    <DetailEditor
                        subjectType="event"
                        subjectId={row.id}
                        fields={['speaker_fee', 'other_costs', 'note']}
                        overrides={row.overrides}
                        automatic={{ speaker_fee: 0, other_costs: 0 }}
                        onSaved={() => {
                            close();
                            void fetchRows();
                        }}
                        onCancel={close}
                    />
                )}
            />
        </div>
    );
}

// ================================================================ Pengaturan

export function SettingsTab() {
    const [form, setForm] = useState<financeApi.FinanceSettings | null>(null);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
        null
    );
    const [isSaving, setIsSaving] = useState<boolean>(false);

    useEffect(() => {
        financeApi
            .settings()
            .then((response) => setForm(response.data))
            .catch((caught) =>
                setNotice({ ok: false, text: describeApiError(caught) })
            );
    }, []);

    if (!form) {
        return <p className="text-sm text-oxford-navy-900/70">Memuat...</p>;
    }

    async function save() {
        if (!form) return;

        setIsSaving(true);
        setNotice(null);

        try {
            const response = await financeApi.saveSettings({
                admin_cover_cost: form.admin_cover_cost,
                print_cost_percent: form.print_cost_percent,
                base_print_copies: form.base_print_copies,
                default_book_price: form.default_book_price,
                hki_cost: form.hki_cost,
            });
            setForm(response.data);
            setNotice({ ok: true, text: 'Pengaturan keuangan disimpan.' });
        } catch (caught) {
            setNotice({ ok: false, text: describeApiError(caught) });
        } finally {
            setIsSaving(false);
        }
    }

    const field = (
        key: keyof financeApi.FinanceSettings,
        label: string,
        hint: string
    ) => (
        <label className="flex flex-col gap-1 text-sm text-oxford-navy-900">
            {label}
            <input
                type="number"
                min={0}
                value={form[key]}
                onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                }
                className={inputClass}
            />
            <span className="text-xs text-oxford-navy-900/60">{hint}</span>
        </label>
    );

    return (
        <div className="flex max-w-2xl flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-forest-moss-100">
            {field(
                'admin_cover_cost',
                'Administrasi & cover (Rp)',
                'Biaya tetap per paket / proyek Book Chapter.'
            )}
            {field(
                'print_cost_percent',
                'Biaya cetak (% harga jual buku)',
                'Biaya cetak satu eksemplar = persen ini × harga jual buku.'
            )}
            {field(
                'base_print_copies',
                'Eksemplar dasar per paket',
                'Biaya cetak paket = persen × harga jual × (eksemplar dasar + N eksemplar dari fasilitas).'
            )}
            {field(
                'default_book_price',
                'Harga jual buku bawaan (Rp)',
                'Dipakai bila buku dari paket belum terbit dan admin belum mengisi harga jualnya di rincian.'
            )}
            {field(
                'hki_cost',
                'Biaya modal HKI (Rp)',
                'Biaya pengurusan HKI per karya yang memuat layanan HKI (bawaan Rp 220.000).'
            )}
            <p className="text-xs text-oxford-navy-900/65">
                Jumlah eksemplar gratis (N) diisi di Paket dan Item Custom.
            </p>
            {notice && (
                <p
                    className={`text-sm ${notice.ok ? 'text-forest-moss-700' : 'text-red-700'}`}
                >
                    {notice.text}
                </p>
            )}
            <Button
                variant="primary"
                className="self-start"
                disabled={isSaving}
                onClick={save}
            >
                {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
        </div>
    );
}
