import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as eventApi from '@/data/event/eventApi';
import type { EventRegistration } from '@/data/event/eventApi';
import { useCertificateDownload } from '@/hooks/useCertificateDownload';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

function formatTime(iso: string | null): string {
    return iso ? `${dateFormatter.format(new Date(iso))} WIB` : '';
}

export default function MyEventsPage() {
    const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const { busyId, error: downloadError, download } = useCertificateDownload();

    useEffect(() => {
        eventApi
            .mine()
            .then((response) => setRegistrations(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Event Saya
            </h5>

            {downloadError && (
                <p role="alert" className="text-red-600 text-sm">
                    {downloadError}
                </p>
            )}

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
                        const attendance = registration.attendance_info;
                        const needsAttendance =
                            attendance?.state === 'open' &&
                            !attendance.submitted;
                        const certificateId =
                            attendance?.certificate_id ?? null;

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
                                            {formatTime(event.starts_at)}
                                        </p>
                                        {needsAttendance && (
                                            <span className="bg-forest-moss-600 mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white">
                                                Absensi dibuka
                                            </span>
                                        )}
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

                                        {attendance?.enabled && (
                                            <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
                                                <p className="text-oxford-navy-900 text-sm font-semibold">
                                                    Absensi
                                                </p>

                                                {attendance.submitted ? (
                                                    <>
                                                        <p className="text-forest-moss-800 text-sm">
                                                            Anda sudah mengisi
                                                            absensi
                                                            {attendance.submitted_at
                                                                ? ` pada ${formatTime(attendance.submitted_at)}`
                                                                : ''}
                                                            .
                                                        </p>
                                                        {certificateId ? (
                                                            <div className="flex flex-row flex-wrap gap-2">
                                                                <Button
                                                                    variant="primary"
                                                                    onClick={() =>
                                                                        download(
                                                                            certificateId
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        busyId ===
                                                                        certificateId
                                                                    }
                                                                >
                                                                    {busyId ===
                                                                    certificateId
                                                                        ? 'Menyiapkan...'
                                                                        : 'Unduh Sertifikat'}
                                                                </Button>
                                                                <Link to="/dashboard/sertifikat-saya">
                                                                    <Button variant="outline2">
                                                                        Sertifikat
                                                                        Saya
                                                                    </Button>
                                                                </Link>
                                                            </div>
                                                        ) : (
                                                            <p className="text-oxford-navy-900/65 text-sm">
                                                                Event ini belum
                                                                menyediakan
                                                                sertifikat
                                                                otomatis.
                                                            </p>
                                                        )}
                                                    </>
                                                ) : attendance.state ===
                                                  'upcoming' ? (
                                                    <p className="text-oxford-navy-900/80 text-sm">
                                                        Absensi dibuka{' '}
                                                        {formatTime(
                                                            attendance.opens_at
                                                        )}{' '}
                                                        sampai{' '}
                                                        {formatTime(
                                                            attendance.closes_at
                                                        )}
                                                        .
                                                    </p>
                                                ) : attendance.state ===
                                                  'closed' ? (
                                                    <p className="text-red-700 text-sm">
                                                        Absensi sudah ditutup
                                                        pada{' '}
                                                        {formatTime(
                                                            attendance.closes_at
                                                        )}
                                                        .
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-oxford-navy-900/80 text-sm">
                                                            Absensi sedang
                                                            dibuka sampai{' '}
                                                            {formatTime(
                                                                attendance.closes_at
                                                            )}
                                                            .
                                                            {attendance.has_certificate_template &&
                                                                ' Isi absensi untuk mendapatkan sertifikat.'}
                                                        </p>
                                                        <Link
                                                            to={`/dashboard/absensi-event/${event.slug}`}
                                                            className="self-start"
                                                        >
                                                            <Button variant="secondary">
                                                                Isi Absensi
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
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
