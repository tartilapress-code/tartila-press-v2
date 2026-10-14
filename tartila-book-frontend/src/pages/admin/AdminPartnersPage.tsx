import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Button from '@/components/Button';
import * as api from '@/data/partnerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';

const field =
    'h-10 w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

/** Admin: daftar mitra + menambah mitra dari akun yang sudah ada. */
export default function AdminPartnersPage() {
    const { data, error, reload } = useLoad(
        useCallback(() => api.adminPartners(), [])
    );
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<{ id: number; name: string }[]>([]);
    const [chosen, setChosen] = useState<{ id: number; name: string } | null>(
        null
    );
    const [company, setCompany] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);

    useEffect(() => {
        if (query.trim().length < 2) {
            return;
        }

        const timer = window.setTimeout(() => {
            api.searchUsers(query.trim())
                .then((response) => setResults(response.data))
                .catch(() => setResults([]));
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query]);

    async function run(task: () => Promise<unknown>, done: string) {
        setBusy(true);
        setMessage('');
        setIsError(false);

        try {
            await task();
            setMessage(done);
            reload();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setBusy(false);
        }
    }

    function add(event: FormEvent) {
        event.preventDefault();

        if (!chosen) return;

        void run(async () => {
            await api.adminAddPartner({
                user_id: chosen.id,
                company_name: company.trim(),
            });
            setChosen(null);
            setCompany('');
            setQuery('');
        }, 'Mitra ditambahkan.');
    }

    return (
        <PartnersView
            data={data?.data ?? null}
            error={error}
            message={message}
            isError={isError}
            busy={busy}
            query={query}
            setQuery={setQuery}
            results={results.filter(() => query.trim().length >= 2)}
            chosen={chosen}
            setChosen={setChosen}
            company={company}
            setCompany={setCompany}
            onAdd={add}
            onToggle={(partner) =>
                run(
                    () =>
                        api.adminUpdatePartner(partner.id, {
                            is_active: !partner.is_active,
                        }),
                    'Status mitra diperbarui.'
                )
            }
            onRemove={(partner) => {
                if (!window.confirm(`Hapus mitra ${partner.company_name}?`))
                    return;
                void run(
                    () => api.adminDeletePartner(partner.id),
                    'Mitra dihapus.'
                );
            }}
            field={field}
        />
    );
}

function PartnersView(props: {
    data: api.Partner[] | null;
    error: string;
    message: string;
    isError: boolean;
    busy: boolean;
    query: string;
    setQuery: (value: string) => void;
    results: { id: number; name: string }[];
    chosen: { id: number; name: string } | null;
    setChosen: (value: { id: number; name: string } | null) => void;
    company: string;
    setCompany: (value: string) => void;
    onAdd: (event: FormEvent) => void;
    onToggle: (partner: api.Partner) => void;
    onRemove: (partner: api.Partner) => void;
    field: string;
}) {
    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Mitra
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Penerbit mitra mengunggah ebook sendiri (data buku, PDF,
                    Turnitin, surat keaslian, MOU) dan tampil di katalog setelah
                    Anda setujui. Di Tartila Press akun mitra hanya bisa membeli
                    buku fisik.
                </p>
            </div>

            <form
                onSubmit={props.onAdd}
                className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/70 p-4"
            >
                <p className="text-sm font-semibold text-oxford-navy-900">
                    Tambah mitra
                </p>
                <div className="relative">
                    <input
                        value={props.chosen ? props.chosen.name : props.query}
                        onChange={(e) => {
                            props.setChosen(null);
                            props.setQuery(e.target.value);
                        }}
                        placeholder="Cari akun (nama) yang akan jadi mitra"
                        aria-label="Cari akun mitra"
                        className={props.field}
                    />
                    {!props.chosen && props.results.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-forest-moss-200">
                            {props.results.map((result) => (
                                <button
                                    type="button"
                                    key={result.id}
                                    onClick={() => props.setChosen(result)}
                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-forest-moss-50"
                                >
                                    {result.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    value={props.company}
                    onChange={(e) => props.setCompany(e.target.value)}
                    placeholder="Nama penerbit / perusahaan mitra"
                    aria-label="Nama perusahaan mitra"
                    className={props.field}
                />
                <p className="text-xs text-oxford-navy-900/60">
                    Akun tidak boleh sudah berperan penulis, editor, atau admin
                    (mitra di Tartila Press hanya pengguna biasa).
                </p>
                <Button
                    type="submit"
                    className="self-start"
                    disabled={
                        props.busy ||
                        !props.chosen ||
                        props.company.trim() === ''
                    }
                >
                    Jadikan mitra
                </Button>
            </form>

            {props.message && (
                <p
                    role="status"
                    className={`text-sm ${props.isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {props.message}
                </p>
            )}
            {props.error && <p className="text-red-600">{props.error}</p>}

            <div className="flex flex-col gap-2">
                {props.data?.map((partner) => (
                    <div
                        key={partner.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-forest-moss-100"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold text-oxford-navy-700">
                                {partner.company_name}
                                {!partner.is_active && (
                                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                        Nonaktif
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-oxford-navy-900/65">
                                {partner.name} • {partner.email}
                            </p>
                            <p className="text-xs text-oxford-navy-900/65">
                                Ebook: {partner.books.approved ?? 0} disetujui •{' '}
                                {partner.books.submitted ?? 0} menunggu •{' '}
                                {partner.books.rejected ?? 0} ditolak •{' '}
                                {partner.books.draft ?? 0} draf
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline2"
                                className="h-9 py-0"
                                disabled={props.busy}
                                onClick={() => props.onToggle(partner)}
                            >
                                {partner.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <button
                                type="button"
                                className="text-sm font-semibold text-red-600 hover:underline"
                                onClick={() => props.onRemove(partner)}
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                ))}
                {props.data && props.data.length === 0 && (
                    <p className="rounded-xl bg-forest-moss-50 p-6 text-center text-oxford-navy-900/65">
                        Belum ada mitra.
                    </p>
                )}
            </div>
        </div>
    );
}
