import { useEffect, useState } from 'react';
import * as eventApi from '@/data/event/eventApi';
import type { EventRegistration } from '@/data/event/eventApi';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

export default function MyEventsPage() {
    const [registrations, setRegistrations] = useState<EventRegistration[]>(
        []
    );
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        eventApi
            .mine()
            .then((response) => setRegistrations(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Event Saya</h5>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : registrations.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Anda belum terdaftar di event apa pun.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {registrations.map((registration) => {
                        const { event } = registration;
                        const isExpanded = expandedId === registration.id;

                        return (
                            <div
                                key={registration.id}
                                className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedId(
                                            isExpanded ? null : registration.id
                                        )
                                    }
                                    className="flex flex-row items-center justify-between gap-4 text-left"
                                >
                                    <div>
                                        <p className="text-oxford-navy-900 font-semibold">
                                            {event.title}
                                        </p>
                                        <p className="text-oxford-navy-900/65 text-sm">
                                            {dateFormatter.format(
                                                new Date(event.starts_at)
                                            )}{' '}
                                            WIB
                                        </p>
                                    </div>
                                    <span className="text-forest-moss-700 text-sm shrink-0">
                                        {isExpanded ? 'Tutup' : 'Detail'}
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="flex flex-col gap-3 border-t border-forest-moss-200 pt-3">
                                        {event.description && (
                                            <p className="text-oxford-navy-900/80 text-sm whitespace-pre-line">
                                                {event.description}
                                            </p>
                                        )}

                                        {event.requires_meet_link &&
                                            event.meet_link && (
                                                <a
                                                    href={event.meet_link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-forest-moss-700 text-sm hover:text-forest-moss-800 underline self-start"
                                                >
                                                    Buka Link Meeting
                                                </a>
                                            )}

                                        {event.certificate_url && (
                                            <a
                                                href={event.certificate_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-forest-moss-700 text-sm hover:text-forest-moss-800 underline self-start"
                                            >
                                                Lihat/Unduh Sertifikat
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
