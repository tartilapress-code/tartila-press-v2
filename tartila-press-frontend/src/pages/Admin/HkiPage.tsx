import { Fragment, useCallback, useEffect, useState } from 'react';
import Pagination from '@/components/ui/Pagination';
import type { PageMeta } from '@/lib/pagination';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import * as hkiApi from '@/data/hki/hkiApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';

const STATUS_CLASS: Record<hkiApi.HkiStatus, string> = {
    pending: 'bg-oxford-navy-900/10 text-oxford-navy-900',
    submitted: 'bg-amber-100 text-amber-900',
    registered: 'bg-forest-moss-100 text-forest-moss-800',
};

const inputClass =
    'rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

function formatDate(iso: string | null): string {
    return iso ? dateFormatter.format(new Date(iso)) : '-';
}

/** Formulir status & nomor HKI satu karya. */
function HkiEditor({
    entry,
    statuses,
    onSaved,
    onCancel,
}: {
    entry: hkiApi.HkiEntry;
    statuses: Record<string, string>;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState<hkiApi.HkiUpdatePayload>({
        status: entry.hki.status,
        application_number: entry.hki.application_number,
        registration_number: entry.hki.registration_number,
        registered_at: entry.hki.registered_at,
        note: entry.hki.note,
    });
    const [error, setError] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    async function save() {
        setIsSaving(true);
        setError('');

        try {
            await hkiApi.adminUpdate(entry.subject_type, entry.subject_id, {
                ...form,
                application_number: form.application_number?.trim() || null,
                registration_number: form.registration_number?.trim() || null,
                registered_at: form.registered_at || null,
                note: form.note?.trim() || null,
            });
            onSaved();
        } catch (caught) {
            setError(describeApiError(caught));
            setIsSaving(false);
        }
    }

    return (
        <div className="grid gap-3 rounded-lg bg-white p-4 ring-1 ring-forest-moss-200 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                Status HKI
                <select
                    value={form.status}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            status: e.target.value as hkiApi.HkiStatus,
                        })
                    }
                    className={inputClass}
                >
                    {Object.entries(statuses).map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                No. permohonan
                <input
                    value={form.application_number ?? ''}
                    onChange={(e) =>
                        setForm({ ...form, application_number: e.target.value })
                    }
                    className={inputClass}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                No. pencatatan
                <input
                    value={form.registration_number ?? ''}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            registration_number: e.target.value,
                        })
                    }
                    className={inputClass}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                Tanggal terdaftar
                <input
                    type="date"
                    value={form.registered_at ?? ''}
                    onChange={(e) =>
                        setForm({ ...form, registered_at: e.target.value })
                    }
                    className={inputClass}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70 sm:col-span-2 lg:col-span-4">
                Catatan
                <input
                    value={form.note ?? ''}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className={inputClass}
                />
            </label>
            {error && (
                <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">
                    {error}
                </p>
            )}
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <Button variant="primary" disabled={isSaving} onClick={save}>
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button variant="outline2" onClick={onCancel}>
                    Batal
                </Button>
            </div>
        </div>
    );
}

/** Admin: karya yang memiliki layanan HKI, status buku, status HKI, sertifikat. */
export default function HkiPage() {
    const [entries, setEntries] = useState<hkiApi.HkiEntry[]>([]);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [filter, setFilter] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
        null
    );
    const [viewer, setViewer] = useState<{ url: string; title: string } | null>(
        null
    );
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});

    // Status, pencarian & halaman dikerjakan server.
    const fetchEntries = useCallback(() => {
        return hkiApi
            .adminList({ status: filter, search: search.trim(), page })
            .then((response) => {
                setEntries(response.data);
                setMeta(response.meta ?? null);
                setStatuses(response.meta?.statuses ?? {});
                setCounts(response.meta?.counts ?? {});
            })
            .catch((caught) =>
                setNotice({ ok: false, text: describeApiError(caught) })
            )
            .finally(() => setIsLoading(false));
    }, [filter, search, page]);

    useEffect(() => {
        const timeout = setTimeout(() => void fetchEntries(), 300);

        return () => clearTimeout(timeout);
    }, [fetchEntries]);

    async function upload(entry: hkiApi.HkiEntry, file: File | undefined) {
        if (!file) return;

        setBusyKey(entry.key);
        setNotice(null);

        try {
            const response = await hkiApi.adminUploadCertificate(
                entry.subject_type,
                entry.subject_id,
                file
            );
            setNotice({ ok: true, text: response.message });
            await fetchEntries();
        } catch (caught) {
            setNotice({ ok: false, text: describeApiError(caught) });
        } finally {
            setBusyKey(null);
        }
    }

    async function open(entry: hkiApi.HkiEntry, inline: boolean) {
        if (!entry.hki.id) return;

        setBusyKey(entry.key);

        try {
            const { blob, filename } = await hkiApi.adminCertificateFile(
                entry.hki.id,
                inline
            );

            if (inline) {
                setViewer({
                    url: URL.createObjectURL(blob),
                    title: `Sertifikat HKI — ${entry.title}`,
                });
            } else {
                saveBlob(blob, filename ?? 'sertifikat-hki');
            }
        } catch (caught) {
            setNotice({ ok: false, text: describeApiError(caught) });
        } finally {
            setBusyKey(null);
        }
    }

    async function remove(entry: hkiApi.HkiEntry) {
        if (
            !entry.hki.id ||
            !window.confirm(`Hapus sertifikat HKI "${entry.title}"?`)
        ) {
            return;
        }

        try {
            await hkiApi.adminDeleteCertificate(entry.hki.id);
            await fetchEntries();
        } catch (caught) {
            setNotice({ ok: false, text: describeApiError(caught) });
        }
    }

    const visible = entries;

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                    HKI
                </h5>
                <p className="text-sm text-oxford-navy-900/65">
                    Karya dengan layanan HKI: paket/paket custom yang memuat
                    HKI, proyek Book Chapter ber-HKI, dan buku bertanda HKI.
                    Sertifikat yang diunggah muncul di "Sertifikat Saya" milik
                    semua penulis karya tersebut.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Status HKI
                    <select
                        value={filter}
                        onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                        }}
                        className={inputClass}
                    >
                        <option value="">Semua ({counts.all ?? 0})</option>
                        {Object.entries(statuses).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label} ({counts[key] ?? 0})
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Cari judul / penulis
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className={inputClass}
                    />
                </label>
            </div>

            {notice && (
                <p
                    role={notice.ok ? 'status' : 'alert'}
                    className={`text-sm ${notice.ok ? 'text-forest-moss-700' : 'text-red-700'}`}
                >
                    {notice.text}
                </p>
            )}

            <div className="overflow-x-auto rounded-xl ring-1 ring-forest-moss-100">
                <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-forest-moss-50 text-left text-xs uppercase tracking-wide text-oxford-navy-900/70">
                        <tr>
                            <th className="p-3">Karya</th>
                            <th className="p-3">Penulis</th>
                            <th className="p-3">Status buku</th>
                            <th className="p-3">Status HKI</th>
                            <th className="p-3">Sertifikat</th>
                            <th className="p-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && visible.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="p-6 text-center text-oxford-navy-900/60"
                                >
                                    Tidak ada karya ber-HKI untuk filter ini.
                                </td>
                            </tr>
                        )}
                        {visible.map((entry) => (
                            <Fragment key={entry.key}>
                                <tr className="border-t border-forest-moss-100 align-top">
                                    <td className="p-3">
                                        <p className="font-semibold text-oxford-navy-900">
                                            {entry.title}
                                        </p>
                                        <p className="text-xs text-oxford-navy-900/60">
                                            {entry.source} ·{' '}
                                            {formatDate(entry.date)}
                                        </p>
                                    </td>
                                    <td className="p-3 text-oxford-navy-900/80">
                                        {entry.authors.length > 0
                                            ? entry.authors
                                                  .map((author) => author.name)
                                                  .join(', ')
                                            : '-'}
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={
                                                entry.published
                                                    ? 'font-semibold text-forest-moss-700'
                                                    : 'text-oxford-navy-900/80'
                                            }
                                        >
                                            {entry.book_status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[entry.hki.status]}`}
                                        >
                                            {entry.hki.status_label}
                                        </span>
                                        {entry.hki.application_number && (
                                            <p className="mt-1 text-xs text-oxford-navy-900/60">
                                                Permohonan{' '}
                                                {entry.hki.application_number}
                                            </p>
                                        )}
                                        {entry.hki.registration_number && (
                                            <p className="text-xs text-oxford-navy-900/60">
                                                Pencatatan{' '}
                                                {entry.hki.registration_number}
                                                {entry.hki.registered_at
                                                    ? ` · ${formatDate(entry.hki.registered_at)}`
                                                    : ''}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {entry.hki.has_certificate ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs text-oxford-navy-900/70">
                                                    {entry.hki.certificate_name}
                                                </span>
                                                <span className="flex gap-3 text-xs font-semibold">
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            busyKey ===
                                                            entry.key
                                                        }
                                                        onClick={() =>
                                                            open(entry, true)
                                                        }
                                                        className="text-forest-moss-700 hover:underline"
                                                    >
                                                        Lihat
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            busyKey ===
                                                            entry.key
                                                        }
                                                        onClick={() =>
                                                            open(entry, false)
                                                        }
                                                        className="text-forest-moss-700 hover:underline"
                                                    >
                                                        Unduh
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            remove(entry)
                                                        }
                                                        className="text-red-700 hover:underline"
                                                    >
                                                        Hapus
                                                    </button>
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-oxford-navy-900/55">
                                                Belum diunggah
                                            </span>
                                        )}
                                        <label className="mt-2 inline-flex cursor-pointer text-xs font-semibold text-oxford-navy-700 hover:underline">
                                            {busyKey === entry.key
                                                ? 'Mengunggah...'
                                                : entry.hki.has_certificate
                                                  ? 'Ganti berkas'
                                                  : 'Unggah sertifikat'}
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                className="sr-only"
                                                disabled={busyKey === entry.key}
                                                onChange={(e) => {
                                                    void upload(
                                                        entry,
                                                        e.target.files?.[0]
                                                    );
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    </td>
                                    <td className="whitespace-nowrap p-3 text-right">
                                        <button
                                            type="button"
                                            aria-expanded={
                                                openKey === entry.key
                                            }
                                            onClick={() =>
                                                setOpenKey(
                                                    openKey === entry.key
                                                        ? null
                                                        : entry.key
                                                )
                                            }
                                            className="text-xs font-semibold text-forest-moss-700 hover:underline"
                                        >
                                            {openKey === entry.key
                                                ? 'Tutup'
                                                : 'Ubah'}
                                        </button>
                                    </td>
                                </tr>
                                {openKey === entry.key && (
                                    <tr className="bg-forest-moss-50/60">
                                        <td colSpan={6} className="p-3">
                                            <HkiEditor
                                                entry={entry}
                                                statuses={statuses}
                                                onSaved={() => {
                                                    setOpenKey(null);
                                                    void fetchEntries();
                                                }}
                                                onCancel={() =>
                                                    setOpenKey(null)
                                                }
                                            />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination meta={meta} onPageChange={setPage} />

            <p className="text-xs text-oxford-navy-900/60">
                Sertifikat: PDF/JPG/PNG maks. 10 MB. Mengunggah sertifikat
                otomatis mengubah status menjadi "Terdaftar" dan memberi
                notifikasi + email ke semua penulis. Biaya modal HKI diatur di
                Keuangan → Pengaturan.
            </p>

            {viewer && (
                <PdfPreviewModal
                    url={viewer.url}
                    title={viewer.title}
                    onClose={() => {
                        URL.revokeObjectURL(viewer.url);
                        setViewer(null);
                    }}
                />
            )}
        </div>
    );
}
