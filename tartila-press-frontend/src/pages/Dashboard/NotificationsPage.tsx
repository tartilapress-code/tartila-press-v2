import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import { timeAgo } from '@/components/notification/timeAgo';
import { useNotifications } from '@/context/useNotifications';
import * as notificationApi from '@/data/notification/notificationApi';
import { describeApiError } from '@/lib/apiErrors';

/** Semua notifikasi user: belum dibaca ditandai merah, bisa dibuka satu per satu. */
export default function NotificationsPage() {
    const navigate = useNavigate();
    const { summary, markRead } = useNotifications();
    const [items, setItems] = useState<notificationApi.AppNotification[]>([]);
    const [page, setPage] = useState<number>(1);
    const [lastPage, setLastPage] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<string>('');

    function fetchPage(nextPage: number) {
        return notificationApi
            .list(nextPage, 20)
            .then((response) => {
                setItems((previous) =>
                    nextPage === 1
                        ? response.data
                        : [...previous, ...response.data]
                );
                setPage(response.meta.current_page);
                setLastPage(response.meta.last_page);
            })
            .catch((caught) => setMessage(describeApiError(caught)))
            .finally(() => setIsLoading(false));
    }

    function load(nextPage: number) {
        setIsLoading(true);

        return fetchPage(nextPage);
    }

    useEffect(() => {
        void fetchPage(1);
         
    }, []);

    function open(item: notificationApi.AppNotification) {
        if (!item.read_at) {
            void markRead({ ids: [item.id] });
        }

        if (item.link) {
            navigate(item.link);
        }
    }

    async function markAll() {
        await markRead({ all: true });
        setItems((previous) =>
            previous.map((item) => ({
                ...item,
                read_at: item.read_at ?? new Date().toISOString(),
            }))
        );
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Notifikasi
                    </h5>
                    <p className="text-oxford-navy-900/65 text-sm">
                        {summary.unread_total > 0
                            ? `${summary.unread_total} notifikasi belum dibaca.`
                            : 'Semua notifikasi sudah dibaca.'}
                    </p>
                </div>
                {summary.unread_total > 0 && (
                    <Button variant="outline2" onClick={markAll}>
                        Tandai semua dibaca
                    </Button>
                )}
            </div>

            {message && <p className="text-red-600 text-sm">{message}</p>}

            {!isLoading && items.length === 0 && !message && (
                <p className="text-oxford-navy-900/65 text-sm">
                    Belum ada notifikasi.
                </p>
            )}

            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => open(item)}
                            className={`flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left ring-1 transition-colors hover:bg-forest-moss-50 ${
                                item.read_at
                                    ? 'bg-white ring-forest-moss-100'
                                    : 'bg-red-50/60 ring-red-200'
                            }`}
                        >
                            <span
                                aria-hidden
                                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-forest-moss-200' : 'bg-red-600'}`}
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span
                                    className={`text-oxford-navy-900 ${item.read_at ? '' : 'font-semibold'}`}
                                >
                                    {item.title}
                                    {!item.read_at && (
                                        <span className="sr-only">
                                            {' '}
                                            (belum dibaca)
                                        </span>
                                    )}
                                </span>
                                {item.body && (
                                    <span className="text-sm text-oxford-navy-900/70">
                                        {item.body}
                                    </span>
                                )}
                                <span className="text-xs text-oxford-navy-900/55">
                                    {timeAgo(item.created_at)}
                                </span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>

            {page < lastPage && (
                <Button
                    variant="outline2"
                    className="self-center"
                    disabled={isLoading}
                    onClick={() => void load(page + 1)}
                >
                    {isLoading ? 'Memuat...' : 'Muat lebih banyak'}
                </Button>
            )}
        </div>
    );
}
