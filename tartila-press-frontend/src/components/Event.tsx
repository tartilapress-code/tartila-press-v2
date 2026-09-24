import { useEffect, useState } from 'react';
import EventCard from '@/components/event/EventCard';
import * as eventApi from '@/data/event/eventApi';
import type { Event as EventType } from '@/data/event/eventApi';

/** Event terbaru di beranda. */
export default function Event(): React.ReactNode {
    const [events, setEvents] = useState<EventType[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        eventApi
            .list()
            .then((response) => setEvents(response.data.slice(0, 4)))
            .catch(() => setEvents([]))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div aria-hidden className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-52 animate-pulse rounded-2xl border border-forest-moss-100 bg-white"
                    />
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                Belum ada event.
            </p>
        );
    }

    return (
        <section>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                ))}
            </div>
        </section>
    );
}
