import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import * as certificateApi from '@/data/certificate/certificateApi';
import type {
    AttendanceAnswers,
    AttendanceField,
    ParticipantAttendance,
} from '@/data/certificate/certificateApi';
import { useCertificateDownload } from '@/hooks/useCertificateDownload';
import { describeApiError } from '@/lib/apiErrors';
import { EVENT_DATE_TIME } from '@/lib/eventTime';

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', EVENT_DATE_TIME);

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

const textareaClass =
    'w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 focus:ring-1 focus:ring-oxford-navy-500';

const selectClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

function formatTime(iso: string | null): string {
    return iso ? `${dateTimeFormatter.format(new Date(iso))} WIB` : '';
}

/** What an untouched field holds. */
function emptyAnswer(field: AttendanceField): string | boolean {
    return field.type === 'checkbox' ? false : '';
}

/** /dashboard/absensi-event/:slug — the attendance form of an event. */
export default function EventAttendanceFormPage() {
    const { slug = '' } = useParams();

    const [data, setData] = useState<ParticipantAttendance | null>(null);
    const [loadError, setLoadError] = useState<string>('');
    const [answers, setAnswers] = useState<AttendanceAnswers>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string>('');

    const { busyId, error: downloadError, download } = useCertificateDownload();

    useEffect(() => {
        let cancelled = false;

        certificateApi
            .getAttendance(slug)
            .then((response) => {
                if (!cancelled) {
                    setData(response.data);
                }
            })
            .catch((failure) => {
                if (!cancelled) {
                    setLoadError(
                        describeApiError(failure, 'Absensi tidak bisa dimuat.')
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [slug]);

    function answerOf(field: AttendanceField): string | boolean {
        return answers[field.key] ?? emptyAnswer(field);
    }

    function setAnswer(field: AttendanceField, value: string | boolean) {
        setAnswers((current) => ({ ...current, [field.key]: value }));
    }

    function firstMissingField(
        fields: AttendanceField[]
    ): AttendanceField | null {
        for (const field of fields) {
            if (!field.required) {
                continue;
            }

            const value = answerOf(field);

            if (
                field.type === 'checkbox'
                    ? value !== true
                    : String(value).trim() === ''
            ) {
                return field;
            }
        }

        return null;
    }

    async function handleSubmit() {
        if (!data) {
            return;
        }

        const missing = firstMissingField(data.fields);

        if (missing) {
            setSubmitError(
                missing.type === 'checkbox'
                    ? `"${missing.label}" harus dicentang.`
                    : `"${missing.label}" wajib diisi.`
            );

            return;
        }

        setIsSubmitting(true);
        setSubmitError('');

        const payload: AttendanceAnswers = {};
        for (const field of data.fields) {
            payload[field.key] = answerOf(field);
        }

        try {
            const response = await certificateApi.submitAttendance(
                slug,
                payload
            );

            setData(response.data);
        } catch (failure) {
            setSubmitError(describeApiError(failure));
        } finally {
            setIsSubmitting(false);
        }
    }

    if (loadError) {
        return (
            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Absensi Event
                </h5>
                <p role="alert" className="text-red-600 text-sm">
                    {loadError}
                </p>
                <Link
                    to="/dashboard/event-saya"
                    className="text-forest-moss-700 hover:text-forest-moss-800 self-start text-sm underline"
                >
                    Kembali ke Event Saya
                </Link>
            </div>
        );
    }

    if (!data) {
        return (
            <div className={cardClass}>
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            </div>
        );
    }

    const windowText = `${formatTime(data.opens_at)} – ${formatTime(data.closes_at)}`;
    const certificate = data.certificate;

    return (
        <div className={cardClass}>
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Absensi Event
                </h5>
                <p className="text-oxford-navy-900 font-semibold">
                    {data.event.title}
                </p>
                <p className="text-oxford-navy-900/65 text-sm">
                    Absensi dibuka: {windowText}
                </p>
            </div>

            {data.submitted ? (
                <div className="flex flex-col gap-3">
                    <p
                        role="status"
                        className="bg-forest-moss-50 text-forest-moss-800 ring-1 ring-forest-moss-200 rounded-lg p-4 text-sm"
                    >
                        Terima kasih, absensi Anda sudah tercatat
                        {data.submitted_at
                            ? ` pada ${formatTime(data.submitted_at)}`
                            : ''}
                        .
                    </p>

                    {certificate ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-oxford-navy-900/80 text-sm">
                                Sertifikat Anda sudah tersedia (No.{' '}
                                {certificate.number}) dan bisa diunduh kapan
                                saja dari menu Sertifikat Saya.
                            </p>
                            <div className="flex flex-row flex-wrap gap-2">
                                <Button
                                    variant="primary"
                                    onClick={() => download(certificate.id)}
                                    disabled={busyId === certificate.id}
                                >
                                    {busyId === certificate.id
                                        ? 'Menyiapkan...'
                                        : 'Unduh Sertifikat'}
                                </Button>
                                <Link to="/dashboard/sertifikat-saya">
                                    <Button variant="outline2">
                                        Buka Sertifikat Saya
                                    </Button>
                                </Link>
                            </div>
                            {downloadError && (
                                <p
                                    role="alert"
                                    className="text-red-600 text-sm"
                                >
                                    {downloadError}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-oxford-navy-900/70 text-sm">
                            Event ini belum menyediakan sertifikat otomatis.
                        </p>
                    )}

                    <Link
                        to="/dashboard/event-saya"
                        className="text-forest-moss-700 hover:text-forest-moss-800 self-start text-sm underline"
                    >
                        Kembali ke Event Saya
                    </Link>
                </div>
            ) : data.state === 'upcoming' ? (
                <p className="text-oxford-navy-900/80 text-sm">
                    Absensi belum dibuka. Silakan kembali pada{' '}
                    {formatTime(data.opens_at)}.
                </p>
            ) : data.state === 'closed' ? (
                <p className="text-red-700 text-sm">
                    Absensi sudah ditutup pada {formatTime(data.closes_at)}.
                </p>
            ) : (
                <div className="flex flex-col gap-4">
                    {data.fields.length === 0 && (
                        <p className="text-oxford-navy-900/80 text-sm">
                            Tekan tombol di bawah untuk mencatat kehadiran Anda.
                        </p>
                    )}

                    {data.fields.map((field) => (
                        <div key={field.id} className="flex flex-col gap-1">
                            {field.type === 'checkbox' ? (
                                <label className="flex flex-row items-start gap-2 text-oxford-navy-900">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={answerOf(field) === true}
                                        onChange={(event) =>
                                            setAnswer(
                                                field,
                                                event.target.checked
                                            )
                                        }
                                    />
                                    <span>
                                        {field.label}
                                        {field.required && ' *'}
                                    </span>
                                </label>
                            ) : field.type === 'textarea' ? (
                                <div className="flex flex-col gap-2">
                                    <label
                                        htmlFor={`answer-${field.key}`}
                                        className="text-sm font-medium text-oxford-navy-900"
                                    >
                                        {field.label}
                                        {field.required && ' *'}
                                    </label>
                                    <textarea
                                        id={`answer-${field.key}`}
                                        rows={4}
                                        value={String(answerOf(field))}
                                        onChange={(event) =>
                                            setAnswer(field, event.target.value)
                                        }
                                        className={textareaClass}
                                    />
                                </div>
                            ) : field.type === 'select' ? (
                                <div className="flex flex-col gap-2">
                                    <label
                                        htmlFor={`answer-${field.key}`}
                                        className="text-sm font-medium text-oxford-navy-900"
                                    >
                                        {field.label}
                                        {field.required && ' *'}
                                    </label>
                                    <select
                                        id={`answer-${field.key}`}
                                        value={String(answerOf(field))}
                                        onChange={(event) =>
                                            setAnswer(field, event.target.value)
                                        }
                                        className={selectClass}
                                    >
                                        <option value="">Pilih...</option>
                                        {(field.options ?? []).map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : field.type === 'radio' ? (
                                <fieldset className="flex flex-col gap-2">
                                    <legend className="text-sm font-medium text-oxford-navy-900">
                                        {field.label}
                                        {field.required && ' *'}
                                    </legend>
                                    {(field.options ?? []).map((option) => (
                                        <label
                                            key={option}
                                            className="flex flex-row items-center gap-2 text-oxford-navy-900"
                                        >
                                            <input
                                                type="radio"
                                                name={`answer-${field.key}`}
                                                checked={
                                                    answerOf(field) === option
                                                }
                                                onChange={() =>
                                                    setAnswer(field, option)
                                                }
                                            />
                                            {option}
                                        </label>
                                    ))}
                                </fieldset>
                            ) : (
                                <Input
                                    label={`${field.label}${field.required ? ' *' : ''}`}
                                    type={
                                        field.type === 'phone'
                                            ? 'tel'
                                            : field.type
                                    }
                                    value={String(answerOf(field))}
                                    onChange={(event) =>
                                        setAnswer(field, event.target.value)
                                    }
                                />
                            )}
                            {field.help_text && (
                                <small className="text-oxford-navy-900/60">
                                    {field.help_text}
                                </small>
                            )}
                        </div>
                    ))}

                    {submitError && (
                        <p role="alert" className="text-red-600 text-sm">
                            {submitError}
                        </p>
                    )}

                    <div className="flex flex-row flex-wrap items-center gap-3">
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Mengirim...' : 'Kirim Absensi'}
                        </Button>
                        <Link
                            to="/dashboard/event-saya"
                            className="text-forest-moss-700 hover:text-forest-moss-800 text-sm underline"
                        >
                            Batal
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
