import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    RiArrowLeftLine,
    RiCalendar2Line,
    RiPriceTag3Line,
    RiTimeLine,
} from '@remixicon/react';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';
import Button from '@/components/Button/Button';
import PillBadge from '@/components/ui/PillBadge';
import * as eventApi from '@/data/event/eventApi';
import type { Event } from '@/data/event/eventApi';
import { useFormat } from '@/i18n/useFormat';
import { EVENT_DATE_TIME } from '@/lib/eventTime';
import { youtubeEmbedUrl } from '@/lib/youtube';

function InfoTile({
    icon,
    label,
    children,
}: {
    icon: ReactNode;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
            <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-oxford-navy-700 shadow-sm [&>svg]:size-5"
            >
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-xs font-medium text-oxford-navy-900/55">
                    {label}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-oxford-navy-900">
                    {children}
                </p>
            </div>
        </div>
    );
}

export default function EventDetailPage() {
    const { t } = useTranslation();
    const { date, rupiah } = useFormat();
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);
    const [isRegistering, setIsRegistering] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');

    useEffect(() => {
        eventApi
            .get(slug ?? '')
            .then((response) => setEvent(response.data))
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }, [slug]);

    if (isLoading) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <p className="text-oxford-navy-900/70">{t('common.loading')}</p>
            </div>
        );
    }

    if (notFound || !event) {
        return <ErrorPage />;
    }

    const fee = Number(event.fee);
    const embedUrl = event.youtube_url
        ? youtubeEmbedUrl(event.youtube_url)
        : null;
    const deadlinePassed = Boolean(
        event.registration_deadline &&
        new Date(event.registration_deadline) < new Date()
    );

    async function handleDaftar() {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        if (event!.requires_document || fee > 0) {
            navigate(`/dashboard/daftar-event/${event!.slug}`);
            return;
        }

        setIsRegistering(true);
        setErrorMessage('');

        try {
            await eventApi.register(event!.slug, {});
            setSuccessMessage(t('events.page.success'));
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : t('common.genericError')
            );
        } finally {
            setIsRegistering(false);
        }
    }

    return (
        // Keluar dari margin <main> supaya latar selebar halaman.
        <div className="-mx-10 -my-2 bg-white">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-20 pt-6 sm:px-6">
                <Link
                    to="/event"
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-moss-700 hover:underline"
                >
                    <RiArrowLeftLine aria-hidden className="size-4" />
                    {t('events.page.back')}
                </Link>

                {event.banner && (
                    <img
                        src={event.banner}
                        alt={event.title}
                        className="max-h-96 w-full rounded-2xl object-cover shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)]"
                    />
                )}

                <div className="flex flex-col gap-4">
                    {event.category && (
                        <PillBadge label={event.category.name} />
                    )}
                    <h1 className="font-display text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl">
                        {event.title}
                    </h1>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <InfoTile
                        icon={<RiCalendar2Line />}
                        label={t('events.page.when')}
                    >
                        {date(event.starts_at, EVENT_DATE_TIME)} WIB
                        {event.ends_at &&
                            ` — ${date(event.ends_at, EVENT_DATE_TIME)} WIB`}
                    </InfoTile>
                    <InfoTile
                        icon={<RiPriceTag3Line />}
                        label={t('events.page.fee')}
                    >
                        {fee > 0 ? rupiah(fee) : t('common.free')}
                    </InfoTile>
                    {event.registration_deadline && (
                        <InfoTile
                            icon={<RiTimeLine />}
                            label={t('events.page.deadline')}
                        >
                            {date(event.registration_deadline, EVENT_DATE_TIME)}{' '}
                            WIB
                        </InfoTile>
                    )}
                </div>

                {event.description && (
                    <p className="whitespace-pre-line text-lg leading-relaxed text-oxford-navy-900/85">
                        {event.description}
                    </p>
                )}

                {embedUrl && (
                    <div className="aspect-video w-full">
                        <iframe
                            src={embedUrl}
                            title={t('events.page.videoTitle', {
                                title: event.title,
                            })}
                            className="h-full w-full rounded-2xl"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        />
                    </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl border border-forest-moss-200 bg-forest-moss-100/70 p-6">
                    {successMessage ? (
                        <p className="font-semibold text-forest-moss-800">
                            {successMessage}
                        </p>
                    ) : deadlinePassed ? (
                        <p className="text-sm text-red-700">
                            {t('events.page.closed')}
                        </p>
                    ) : (
                        <>
                            {errorMessage && (
                                <p className="text-sm text-red-700">
                                    {errorMessage}
                                </p>
                            )}
                            <Button
                                variant="primary"
                                className="self-start"
                                onClick={handleDaftar}
                                disabled={isRegistering}
                            >
                                {isRegistering
                                    ? t('events.page.processing')
                                    : t('events.page.register')}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
