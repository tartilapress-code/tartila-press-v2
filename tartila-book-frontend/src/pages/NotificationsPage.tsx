import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatDateTime } from '@/lib/format';

/** Notifikasi Tartila Book: buku tersimpan diperbarui / dibuka gratis, hasil pembayaran. */
export default function NotificationsPage() {
    const { refreshUnread } = useAuth();
    const [page, setPage] = useState<number>(1);
    const loader = useCallback(() => api.notifications(page), [page]);
    const { data, error, reload } = useLoad(loader);
    const list = data?.data ?? [];
    const unread = list.filter((item) => !item.read_at).length;

    async function read(payload: { all?: boolean; ids?: number[] }) {
        await api.markNotificationsRead(payload).catch(() => undefined);
        reload();
        void refreshUnread();
    }

    return (
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                    Notifikasi
                </h1>
                {unread > 0 && (
                    <button
                        type="button"
                        onClick={() => void read({ all: true })}
                        className="text-sm font-semibold text-forest-moss-700 hover:cursor-pointer hover:underline"
                    >
                        Tandai semua sudah dibaca
                    </button>
                )}
            </div>

            {error && <p className="text-red-600">{error}</p>}
            {data && list.length === 0 && (
                <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                    Belum ada notifikasi. Simpan buku ke rak untuk mendapat
                    kabar saat ada pembaruan.
                </p>
            )}

            <ul className="flex flex-col gap-2">
                {list.map((item) => {
                    const body = (
                        <>
                            <span className="flex items-start justify-between gap-3">
                                <span
                                    className={`text-[15px] ${item.read_at ? 'font-medium text-oxford-navy-900/80' : 'font-bold text-oxford-navy-700'}`}
                                >
                                    {item.title}
                                </span>
                                {!item.read_at && (
                                    <span
                                        aria-label="Belum dibaca"
                                        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-red-600"
                                    />
                                )}
                            </span>
                            {item.body && (
                                <span className="mt-0.5 block text-sm text-oxford-navy-900/70">
                                    {item.body}
                                </span>
                            )}
                            <span className="mt-1 block text-xs text-oxford-navy-900/50">
                                {formatDateTime(item.created_at)}
                            </span>
                        </>
                    );
                    const cls = `block rounded-xl p-4 ring-1 ${item.read_at ? 'bg-white ring-forest-moss-100' : 'bg-forest-moss-50 ring-forest-moss-200'}`;

                    return (
                        <li key={item.id}>
                            {item.link?.startsWith('/') ? (
                                <Link
                                    to={item.link}
                                    onClick={() =>
                                        !item.read_at &&
                                        void read({ ids: [item.id] })
                                    }
                                    className={`${cls} hover:ring-forest-moss-400`}
                                >
                                    {body}
                                </Link>
                            ) : (
                                <div className={cls}>{body}</div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {data && data.meta.last_page > 1 && (
                <div className="flex items-center justify-center gap-4 text-sm">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="font-semibold text-forest-moss-700 hover:cursor-pointer disabled:opacity-40"
                    >
                        ← Sebelumnya
                    </button>
                    <span className="text-oxford-navy-900/60">
                        {page} / {data.meta.last_page}
                    </span>
                    <button
                        type="button"
                        disabled={page >= data.meta.last_page}
                        onClick={() => setPage(page + 1)}
                        className="font-semibold text-forest-moss-700 hover:cursor-pointer disabled:opacity-40"
                    >
                        Berikutnya →
                    </button>
                </div>
            )}
        </div>
    );
}
