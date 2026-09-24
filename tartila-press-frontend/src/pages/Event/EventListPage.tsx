import { useEffect, useState } from 'react';
import EventCard from '@/components/event/EventCard';
import ListHero from '@/components/ui/ListHero';
import SectionTitle from '@/components/ui/SectionTitle';
import * as eventApi from '@/data/event/eventApi';
import type { Event } from '@/data/event/eventApi';

function EventCardSkeleton() {
    return (
        <div
            aria-hidden
            className="flex h-52 animate-pulse flex-col overflow-hidden rounded-2xl border border-forest-moss-100 bg-white lg:flex-row"
        >
            <div className="h-44 w-full bg-forest-moss-50 lg:h-auto lg:w-64" />
            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="h-4 w-1/2 rounded bg-forest-moss-100" />
                <div className="h-5 w-4/5 rounded bg-forest-moss-100" />
                <div className="h-4 w-full rounded bg-forest-moss-50" />
            </div>
        </div>
    );
}

export default function EventListPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        eventApi
            .list()
            .then((response) => setEvents(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge="Event"
                title={{
                    before: 'Belajar Bersama di ',
                    accent: 'Event Kami',
                }}
                text="Ikuti seminar, webinar, dan lokakarya dari Tartila Press."
                script={['Tumbuh Bersama,', 'Belajar Bersama']}
            />

            <div className="mx-auto max-w-[1232px] px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                <section
                    aria-labelledby="event-title"
                    className="flex min-w-0 flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <SectionTitle id="event-title">
                        Semua Event
                        {!isLoading && events.length > 0 && (
                            <span className="font-sans text-sm font-normal text-oxford-navy-900/50">
                                {events.length} event
                            </span>
                        )}
                    </SectionTitle>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <EventCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : events.length === 0 ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            Belum ada event.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            {events.map((event) => (
                                <EventCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
