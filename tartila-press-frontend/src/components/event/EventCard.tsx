import { Link } from 'react-router-dom';
import {
    RiArrowRightLine,
    RiCalendar2Line,
    RiCalendarEventLine,
    RiGroupLine,
} from '@remixicon/react';
import type { Event } from '@/data/event/eventApi';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
});

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function scheduleLabel(event: Event): string {
    const start = new Date(event.starts_at);
    const datePart = dateFormatter.format(start);
    const startTime = timeFormatter.format(start);

    if (!event.ends_at) {
        return `${datePart}, ${startTime} WIB`;
    }

    const end = new Date(event.ends_at);
    return `${datePart}, ${startTime}-${timeFormatter.format(end)} WIB`;
}

/**
 * Kartu event (tema terang): spanduk dengan kategori, jadwal, judul serif,
 * cuplikan deskripsi, biaya, dan jumlah peserta. Di layar lebar spanduk di kiri.
 */
export default function EventCard({ event }: { event: Event }) {
    const fee = Number(event.fee);

    return (
        <Link
            to={`/event/${event.slug}`}
            className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-forest-moss-100 bg-white shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-14px_rgba(1,26,44,0.34)] lg:flex-row"
        >
            <div className="relative h-44 w-full shrink-0 overflow-hidden bg-forest-moss-50 lg:h-auto lg:min-h-full lg:w-64">
                {event.banner ? (
                    <img
                        src={event.banner}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-forest-moss-50 to-forest-moss-100 text-forest-moss-500">
                        <RiCalendarEventLine aria-hidden className="size-12" />
                    </div>
                )}

                {event.category && (
                    <span className="absolute left-3 top-3 max-w-[80%] truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-forest-moss-800 shadow-sm">
                        {event.category.name}
                    </span>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
                <p className="flex items-center gap-2 text-sm font-medium text-forest-moss-700">
                    <RiCalendar2Line
                        aria-hidden
                        className="size-[18px] shrink-0"
                    />
                    {scheduleLabel(event)}
                </p>
                <h3 className="font-display line-clamp-2 text-xl font-bold leading-snug text-oxford-navy-700 transition-colors group-hover:text-oxford-navy-600">
                    {event.title}
                </h3>
                {event.description && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-oxford-navy-900/70">
                        {event.description}
                    </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-base font-bold text-oxford-navy-700">
                            {fee > 0 ? rupiahFormatter.format(fee) : 'Gratis'}
                        </span>
                        {event.confirmed_registrations_count > 0 && (
                            <span className="flex items-center gap-1.5 text-xs text-oxford-navy-900/55">
                                <RiGroupLine
                                    aria-hidden
                                    className="size-4 text-oxford-navy-700"
                                />
                                {event.confirmed_registrations_count} peserta
                            </span>
                        )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-oxford-navy-700">
                        Detail
                        <RiArrowRightLine
                            aria-hidden
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                        />
                    </span>
                </div>
            </div>
        </Link>
    );
}
