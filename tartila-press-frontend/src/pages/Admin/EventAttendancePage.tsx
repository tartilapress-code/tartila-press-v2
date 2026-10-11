import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    RiArrowDownLine,
    RiArrowUpLine,
    RiDeleteBinLine,
} from '@remixicon/react';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import * as certificateApi from '@/data/certificate/certificateApi';
import type {
    AdminAttendance,
    AdminAttendanceSettings,
    AttendanceField,
    AttendanceFieldPayload,
    AttendanceFieldType,
    CertificateTemplate,
} from '@/data/certificate/certificateApi';
import { describeApiError } from '@/lib/apiErrors';
import { toIso, toLocalInput } from '@/lib/dateInput';
import { saveBlob } from '@/lib/download';
import { EVENT_DATE_TIME } from '@/lib/eventTime';

type FieldDraft = {
    /** Local key for React; the server id is kept in `id`. */
    uid: string;
    id?: number;
    key?: string;
    label: string;
    type: AttendanceFieldType;
    optionsText: string;
    required: boolean;
    helpText: string;
};

const typeLabels: Record<AttendanceFieldType, string> = {
    text: 'Teks singkat',
    textarea: 'Teks panjang',
    number: 'Angka',
    email: 'Email',
    phone: 'Nomor telepon',
    date: 'Tanggal',
    select: 'Pilihan (dropdown)',
    radio: 'Pilihan (tombol radio)',
    checkbox: 'Kotak centang (ya/tidak)',
};

const choiceTypes: AttendanceFieldType[] = ['select', 'radio'];

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

const selectClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', EVENT_DATE_TIME);

let draftCounter = 0;

function toDraft(field: AttendanceField): FieldDraft {
    draftCounter += 1;

    return {
        uid: `field-${draftCounter}`,
        id: field.id,
        key: field.key,
        label: field.label,
        type: field.type,
        optionsText: (field.options ?? []).join('\n'),
        required: field.required,
        helpText: field.help_text ?? '',
    };
}

function emptyDraft(): FieldDraft {
    draftCounter += 1;

    return {
        uid: `field-${draftCounter}`,
        label: '',
        type: 'text',
        optionsText: '',
        required: true,
        helpText: '',
    };
}

function toPayload(draft: FieldDraft): AttendanceFieldPayload {
    return {
        ...(draft.id ? { id: draft.id } : {}),
        label: draft.label.trim(),
        type: draft.type,
        ...(choiceTypes.includes(draft.type)
            ? {
                  options: draft.optionsText
                      .split('\n')
                      .map((option) => option.trim())
                      .filter(Boolean),
              }
            : {}),
        required: draft.required,
        help_text: draft.helpText.trim() || undefined,
    };
}

type FormState = {
    enabled: boolean;
    opensAt: string;
    closesAt: string;
    templateId: string;
    drafts: FieldDraft[];
};

const emptyForm: FormState = {
    enabled: false,
    opensAt: '',
    closesAt: '',
    templateId: '',
    drafts: [],
};

function formFromSettings(data: AdminAttendanceSettings): FormState {
    return {
        enabled: data.attendance_enabled,
        opensAt: toLocalInput(data.attendance_opens_at),
        closesAt: toLocalInput(data.attendance_closes_at),
        templateId: data.certificate_template_id
            ? String(data.certificate_template_id)
            : '',
        drafts: data.fields.map(toDraft),
    };
}

function answerText(answer: string | boolean | undefined): string {
    if (typeof answer === 'boolean') {
        return answer ? 'Ya' : 'Tidak';
    }

    return answer ?? '';
}

/** /admin/events/:id/absensi */
export default function EventAttendancePage() {
    const { id } = useParams();
    const eventId = Number(id);

    const [settings, setSettings] = useState<AdminAttendanceSettings | null>(
        null
    );
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [attendances, setAttendances] = useState<AdminAttendance[]>([]);
    const [error, setError] = useState<string>('');

    const [form, setForm] = useState<FormState>(emptyForm);

    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<{
        kind: 'error' | 'success';
        text: string;
    } | null>(null);

    function loadAttendances() {
        certificateApi
            .adminListAttendances(eventId)
            .then((response) => setAttendances(response.data))
            .catch(() => setAttendances([]));
    }

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            certificateApi.adminGetAttendance(eventId),
            certificateApi.adminList('event'),
            certificateApi.adminListAttendances(eventId),
        ])
            .then(
                ([settingsResponse, templatesResponse, attendanceResponse]) => {
                    if (cancelled) {
                        return;
                    }

                    setSettings(settingsResponse.data);
                    setForm(formFromSettings(settingsResponse.data));
                    setTemplates(templatesResponse.data);
                    setAttendances(attendanceResponse.data);
                }
            )
            .catch((failure) => {
                if (!cancelled) {
                    setError(
                        describeApiError(
                            failure,
                            'Data absensi tidak bisa dimuat.'
                        )
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId]);

    function patchForm(patch: Partial<FormState>) {
        setForm((current) => ({ ...current, ...patch }));
    }

    function changeDrafts(change: (drafts: FieldDraft[]) => FieldDraft[]) {
        setForm((current) => ({ ...current, drafts: change(current.drafts) }));
    }

    function updateDraft(uid: string, patch: Partial<FieldDraft>) {
        changeDrafts((current) =>
            current.map((draft) =>
                draft.uid === uid ? { ...draft, ...patch } : draft
            )
        );
    }

    function moveDraft(index: number, direction: -1 | 1) {
        changeDrafts((current) => {
            const target = index + direction;

            if (target < 0 || target >= current.length) {
                return current;
            }

            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });
    }

    async function handleSave() {
        setMessage(null);

        for (const draft of form.drafts) {
            if (draft.label.trim() === '') {
                setMessage({
                    kind: 'error',
                    text: 'Setiap kolom absensi harus punya label.',
                });

                return;
            }

            if (
                choiceTypes.includes(draft.type) &&
                toPayload(draft).options!.length < 2
            ) {
                setMessage({
                    kind: 'error',
                    text: `Kolom "${draft.label}" butuh minimal 2 pilihan (satu per baris).`,
                });

                return;
            }
        }

        setIsSaving(true);

        try {
            const response = await certificateApi.adminSaveAttendance(eventId, {
                attendance_enabled: form.enabled,
                attendance_opens_at: toIso(form.opensAt),
                attendance_closes_at: toIso(form.closesAt),
                certificate_template_id: form.templateId
                    ? Number(form.templateId)
                    : null,
                fields: form.drafts.map(toPayload),
            });

            setSettings(response.data);
            setForm(formFromSettings(response.data));
            setMessage({
                kind: 'success',
                text: 'Pengaturan absensi tersimpan.',
            });
        } catch (failure) {
            setMessage({ kind: 'error', text: describeApiError(failure) });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleExport() {
        try {
            const { blob, filename } =
                await certificateApi.adminExportAttendances(eventId);

            saveBlob(blob, filename ?? 'absensi.csv');
        } catch (failure) {
            setMessage({ kind: 'error', text: describeApiError(failure) });
        }
    }

    async function handleDeleteAttendance(attendance: AdminAttendance) {
        if (
            !window.confirm(
                `Hapus absensi ${attendance.user.name}? Sertifikatnya ikut terhapus dan peserta bisa mengisi ulang.`
            )
        ) {
            return;
        }

        try {
            await certificateApi.adminDeleteAttendance(eventId, attendance.id);
            loadAttendances();
        } catch (failure) {
            setMessage({ kind: 'error', text: describeApiError(failure) });
        }
    }

    if (error) {
        return (
            <div className={cardClass}>
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
                <Link
                    to="/admin/events"
                    className="text-forest-moss-700 hover:text-forest-moss-800 self-start text-sm underline"
                >
                    Kembali ke daftar event
                </Link>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className={cardClass}>
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            </div>
        );
    }

    const eventTemplates = templates.filter(
        (template) =>
            template.is_active || String(template.id) === form.templateId
    );
    const { drafts } = form;
    const savedFields = drafts.filter((draft) => draft.key);

    return (
        <div className="flex flex-col gap-6">
            <div className={cardClass}>
                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                            Absensi & Sertifikat
                        </h5>
                        <p className="text-oxford-navy-900/70 text-sm">
                            {settings.event.title}
                        </p>
                    </div>
                    <Link
                        to="/admin/events"
                        className="text-forest-moss-700 hover:text-forest-moss-800 text-sm underline"
                    >
                        Kembali ke daftar event
                    </Link>
                </div>

                <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={(event) =>
                            patchForm({ enabled: event.target.checked })
                        }
                    />
                    Aktifkan absensi untuk event ini
                </label>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <Input
                        label="Absensi dibuka"
                        type="datetime-local"
                        value={form.opensAt}
                        onChange={(event) =>
                            patchForm({ opensAt: event.target.value })
                        }
                    />
                    <Input
                        label="Absensi ditutup"
                        type="datetime-local"
                        value={form.closesAt}
                        onChange={(event) =>
                            patchForm({ closesAt: event.target.value })
                        }
                    />
                </div>
                <small className="text-oxford-navy-900/60 -mt-2">
                    Peserta hanya bisa mengisi absensi di antara dua waktu ini
                    (wajib diisi kalau absensi diaktifkan). Waktu mengikuti jam
                    di perangkat Anda.
                </small>

                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="certificate-template"
                        className="text-sm font-medium text-oxford-navy-900"
                    >
                        Templat sertifikat
                    </label>
                    <select
                        id="certificate-template"
                        value={form.templateId}
                        onChange={(event) =>
                            patchForm({ templateId: event.target.value })
                        }
                        className={selectClass}
                    >
                        <option value="">Tanpa sertifikat otomatis</option>
                        {eventTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                                {template.is_active ? '' : ' (nonaktif)'}
                            </option>
                        ))}
                    </select>
                    <small className="text-oxford-navy-900/60">
                        Peserta yang sudah mengisi absensi bisa mengunduh
                        sertifikatnya kapan saja dari menu Sertifikat Saya.{' '}
                        <Link
                            to="/admin/certificate-templates"
                            className="text-forest-moss-700 underline"
                        >
                            Kelola templat
                        </Link>
                    </small>
                </div>
            </div>

            <div className={cardClass}>
                <div className="flex flex-col gap-1">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Formulir Absensi
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Kolom yang harus diisi peserta saat absen. Nama dan
                        email peserta otomatis diambil dari akunnya. Jawaban
                        bisa dicetak di sertifikat dengan menulis{' '}
                        <code>{'{answer_kunci}'}</code> di kolom teks templat.
                    </p>
                </div>

                {drafts.length === 0 && (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada kolom — peserta cukup menekan tombol absen.
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    {drafts.map((draft, index) => (
                        <div
                            key={draft.uid}
                            className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <div className="flex-1">
                                    <Input
                                        label={`Kolom ${index + 1}`}
                                        value={draft.label}
                                        onChange={(event) =>
                                            updateDraft(draft.uid, {
                                                label: event.target.value,
                                            })
                                        }
                                        placeholder="mis. Asal instansi"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 sm:w-64">
                                    <label
                                        htmlFor={`type-${draft.uid}`}
                                        className="text-sm font-medium text-oxford-navy-900"
                                    >
                                        Jenis isian
                                    </label>
                                    <select
                                        id={`type-${draft.uid}`}
                                        value={draft.type}
                                        onChange={(event) =>
                                            updateDraft(draft.uid, {
                                                type: event.target
                                                    .value as AttendanceFieldType,
                                            })
                                        }
                                        className={selectClass}
                                    >
                                        {(
                                            Object.keys(
                                                typeLabels
                                            ) as AttendanceFieldType[]
                                        ).map((type) => (
                                            <option key={type} value={type}>
                                                {typeLabels[type]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {choiceTypes.includes(draft.type) && (
                                <div className="flex flex-col gap-2">
                                    <label
                                        htmlFor={`options-${draft.uid}`}
                                        className="text-sm font-medium text-oxford-navy-900"
                                    >
                                        Pilihan (satu per baris, minimal 2)
                                    </label>
                                    <textarea
                                        id={`options-${draft.uid}`}
                                        rows={4}
                                        value={draft.optionsText}
                                        onChange={(event) =>
                                            updateDraft(draft.uid, {
                                                optionsText: event.target.value,
                                            })
                                        }
                                        className="w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 bg-transparent text-oxford-navy-900 focus:ring-1 focus:ring-oxford-navy-500"
                                    />
                                </div>
                            )}

                            <Input
                                label="Petunjuk pengisian (opsional)"
                                value={draft.helpText}
                                onChange={(event) =>
                                    updateDraft(draft.uid, {
                                        helpText: event.target.value,
                                    })
                                }
                            />

                            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="flex flex-row items-center gap-2 text-oxford-navy-900 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={draft.required}
                                            onChange={(event) =>
                                                updateDraft(draft.uid, {
                                                    required:
                                                        event.target.checked,
                                                })
                                            }
                                        />
                                        Wajib diisi
                                    </label>
                                    {draft.key ? (
                                        <span className="text-oxford-navy-900/60 text-xs">
                                            Penanda di sertifikat:{' '}
                                            <code>{`{answer_${draft.key}}`}</code>
                                        </span>
                                    ) : (
                                        <span className="text-oxford-navy-900/60 text-xs">
                                            Penanda di sertifikat dibuat saat
                                            disimpan.
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-row gap-1">
                                    <button
                                        type="button"
                                        onClick={() => moveDraft(index, -1)}
                                        disabled={index === 0}
                                        aria-label="Naikkan kolom"
                                        className="text-oxford-navy-700 hover:bg-white rounded-lg p-2 disabled:opacity-40"
                                    >
                                        <RiArrowUpLine
                                            aria-hidden
                                            className="size-5"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveDraft(index, 1)}
                                        disabled={index === drafts.length - 1}
                                        aria-label="Turunkan kolom"
                                        className="text-oxford-navy-700 hover:bg-white rounded-lg p-2 disabled:opacity-40"
                                    >
                                        <RiArrowDownLine
                                            aria-hidden
                                            className="size-5"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            changeDrafts((current) =>
                                                current.filter(
                                                    (item) =>
                                                        item.uid !== draft.uid
                                                )
                                            )
                                        }
                                        aria-label="Hapus kolom"
                                        className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                                    >
                                        <RiDeleteBinLine
                                            aria-hidden
                                            className="size-5"
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-row">
                    <Button
                        variant="outline2"
                        onClick={() =>
                            changeDrafts((current) => [
                                ...current,
                                emptyDraft(),
                            ])
                        }
                        disabled={drafts.length >= 25}
                    >
                        Tambah kolom
                    </Button>
                </div>

                {savedFields.length > 0 && (
                    <p className="text-oxford-navy-900/60 text-xs">
                        Mengubah label kolom tidak mengubah penandanya (jawaban
                        lama tetap terhubung); menghapus kolom tidak menghapus
                        jawaban yang sudah tersimpan.
                    </p>
                )}

                {message && (
                    <p
                        role={message.kind === 'error' ? 'alert' : 'status'}
                        className={`text-sm ${
                            message.kind === 'error'
                                ? 'text-red-600'
                                : 'text-forest-moss-700'
                        }`}
                    >
                        {message.text}
                    </p>
                )}

                <div className="flex flex-row">
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving
                            ? 'Menyimpan...'
                            : 'Simpan Pengaturan Absensi'}
                    </Button>
                </div>
            </div>

            <div className={cardClass}>
                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                            Peserta yang Sudah Absen
                        </h5>
                        <p className="text-oxford-navy-900/70 text-sm">
                            {attendances.length} dari{' '}
                            {settings.confirmed_registrations_count} peserta
                            terkonfirmasi.
                        </p>
                    </div>
                    <Button
                        variant="outline2"
                        onClick={handleExport}
                        disabled={attendances.length === 0}
                    >
                        Unduh CSV
                    </Button>
                </div>

                {attendances.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada yang mengisi absensi.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-max text-left text-sm">
                            <thead>
                                <tr className="text-oxford-navy-900/70 border-b border-forest-moss-200 text-xs uppercase">
                                    <th className="px-3 py-2">Nama</th>
                                    <th className="px-3 py-2">Waktu absen</th>
                                    <th className="px-3 py-2">Sertifikat</th>
                                    {settings.fields.map((field) => (
                                        <th
                                            key={field.key}
                                            className="px-3 py-2"
                                        >
                                            {field.label}
                                        </th>
                                    ))}
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {attendances.map((attendance) => (
                                    <tr
                                        key={attendance.id}
                                        className="border-b border-forest-moss-100 align-top"
                                    >
                                        <td className="px-3 py-2">
                                            <p className="text-oxford-navy-900 font-semibold">
                                                {attendance.user.name}
                                            </p>
                                            <p className="text-oxford-navy-900/60 text-xs">
                                                {attendance.user.email}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {dateTimeFormatter.format(
                                                new Date(
                                                    attendance.submitted_at
                                                )
                                            )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {attendance.certificate?.number ??
                                                '—'}
                                        </td>
                                        {settings.fields.map((field) => (
                                            <td
                                                key={field.key}
                                                className="max-w-64 px-3 py-2 whitespace-pre-line"
                                            >
                                                {answerText(
                                                    attendance.answers[
                                                        field.key
                                                    ]
                                                ) || '—'}
                                            </td>
                                        ))}
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDeleteAttendance(
                                                        attendance
                                                    )
                                                }
                                                aria-label={`Hapus absensi ${attendance.user.name}`}
                                                className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                                            >
                                                <RiDeleteBinLine
                                                    aria-hidden
                                                    className="size-5"
                                                />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
