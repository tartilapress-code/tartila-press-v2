import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiNotification3Line } from '@remixicon/react';
import { useNotifications } from '@/context/useNotifications';
import * as notificationApi from '@/data/notification/notificationApi';
import { UnreadBadge } from './UnreadBadge';
import { timeAgo } from './timeAgo';

/** Lonceng notifikasi di navbar: angka merah + daftar notifikasi terbaru. */
export default function NotificationBell() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { summary, markRead } = useNotifications();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [items, setItems] = useState<notificationApi.AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    function load() {
        setIsLoading(true);
        notificationApi
            .list(1, 8)
            .then((response) => setItems(response.data))
            .catch(() => setItems([]))
            .finally(() => setIsLoading(false));
    }

    function toggle() {
        if (!isOpen) {
            load();
        }

        setIsOpen(!isOpen);
    }

    // Tutup saat klik di luar atau tekan Escape.
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const onPointer = (event: PointerEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [isOpen]);

    async function open(item: notificationApi.AppNotification) {
        setIsOpen(false);

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

    const unread = summary.unread_total;

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`${t('nav.notifications.open')}${unread > 0 ? ` (${t('nav.notifications.unread', { count: unread })})` : ''}`}
                className="relative inline-flex size-11 items-center justify-center rounded-full text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-forest-moss-50"
            >
                <RiNotification3Line aria-hidden className="size-6" />
                <UnreadBadge
                    count={unread}
                    className="absolute -right-0.5 -top-0.5 ring-2 ring-white"
                />
            </button>

            {isOpen && (
                <div
                    role="dialog"
                    aria-label={t('nav.notifications.label')}
                    className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-forest-moss-100 bg-white shadow-[0_12px_40px_-12px_rgba(1,26,44,0.35)]"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-forest-moss-100 px-4 py-3">
                        <p className="font-semibold text-oxford-navy-700">
                            {t('nav.notifications.label')}
                        </p>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={markAll}
                                className="text-xs font-semibold text-forest-moss-700 hover:underline"
                            >
                                {t('nav.notifications.markAll')}
                            </button>
                        )}
                    </div>

                    <ul className="max-h-[60vh] overflow-y-auto">
                        {!isLoading && items.length === 0 && (
                            <li className="px-4 py-6 text-center text-sm text-oxford-navy-900/65">
                                {t('nav.notifications.empty')}
                            </li>
                        )}
                        {items.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => open(item)}
                                    className={`flex w-full items-start gap-3 border-b border-forest-moss-50 px-4 py-3 text-left transition-colors hover:bg-forest-moss-50 ${
                                        item.read_at ? '' : 'bg-red-50/60'
                                    }`}
                                >
                                    <span
                                        aria-hidden
                                        className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? 'bg-transparent' : 'bg-red-600'}`}
                                    />
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span
                                            className={`text-sm text-oxford-navy-900 ${item.read_at ? '' : 'font-semibold'}`}
                                        >
                                            {item.title}
                                        </span>
                                        {item.body && (
                                            <span className="line-clamp-2 text-xs text-oxford-navy-900/70">
                                                {item.body}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-oxford-navy-900/55">
                                            {timeAgo(item.created_at)}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <Link
                        to="/dashboard/notifikasi"
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-3 text-center text-sm font-semibold text-forest-moss-700 hover:bg-forest-moss-50"
                    >
                        {t('nav.notifications.viewAll')}
                    </Link>
                </div>
            )}
        </div>
    );
}
