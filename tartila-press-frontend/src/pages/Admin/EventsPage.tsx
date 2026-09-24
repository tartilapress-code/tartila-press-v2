import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import DocumentInput from '@/components/Input/DocumentInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import * as eventApi from '@/data/event/eventApi';
import type { CreateEventPayload, Event } from '@/data/event/eventApi';
import { ApiError } from '@/lib/http';

type CategoryOption = { id: number; name: string };

const emptyForm: CreateEventPayload = {
    title: '',
    description: '',
    event_category_id: '',
    banner: '',
    starts_at: '',
    ends_at: '',
    registration_deadline: '',
    requires_document: false,
    requires_meet_link: false,
    meet_link: '',
    youtube_url: '',
    certificate_url: '',
    fee: '0',
    is_active: true,
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

// Input datetime-local tidak membawa zona waktu; kirim sebagai ISO (UTC)
// supaya server tidak salah menafsirkannya, lalu tampil benar di semua
// browser.
function toIso(local: string | null | undefined): string | null {
    return local ? new Date(local).toISOString() : null;
}

function toLocalInput(iso: string): string {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [form, setForm] = useState<CreateEventPayload>(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function load() {
        eventApi
            .adminList()
            .then((response) => setEvents(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        eventApi
            .listCategories()
            .then((response) => setCategories(response.data));
    }, []);

    function resetForm() {
        setEditingId(null);
        setForm(emptyForm);
    }

    function handleEdit(event: Event) {
        setEditingId(event.id);
        setForm({
            title: event.title,
            description: event.description ?? '',
            event_category_id: event.category?.id ?? '',
            banner: event.banner ?? '',
            starts_at: toLocalInput(event.starts_at),
            ends_at: event.ends_at ? toLocalInput(event.ends_at) : '',
            registration_deadline: event.registration_deadline
                ? toLocalInput(event.registration_deadline)
                : '',
            requires_document: event.requires_document,
            requires_meet_link: event.requires_meet_link,
            meet_link: event.meet_link ?? '',
            youtube_url: event.youtube_url ?? '',
            certificate_url: event.certificate_url ?? '',
            fee: event.fee,
            is_active: event.is_active,
        });
    }

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        const payload: CreateEventPayload = {
            ...form,
            starts_at: toIso(form.starts_at) ?? undefined,
            ends_at: toIso(form.ends_at),
            registration_deadline: toIso(form.registration_deadline),
        };

        try {
            if (editingId) {
                await eventApi.adminUpdate(editingId, payload);
            } else {
                await eventApi.adminCreate(payload);
            }
            resetForm();
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: number) {
        await eventApi.adminDelete(id);
        load();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    {editingId ? 'Ubah Event' : 'Buat Event Baru'}
                </h5>

                <Input
                    label="Nama Event"
                    value={form.title}
                    onChange={(e) =>
                        setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    required
                />

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-oxford-navy-900">Deskripsi</label>
                    <textarea
                        className="w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 focus:ring-1 focus:ring-oxford-navy-500"
                        rows={5}
                        value={form.description}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                description: e.target.value,
                            }))
                        }
                    />
                </div>

                <Select
                    label="Kategori"
                    value={String(form.event_category_id ?? '')}
                    onChange={(e) =>
                        setForm((prev) => ({
                            ...prev,
                            event_category_id: e.target.value,
                        }))
                    }
                    option_data={[
                        { value: '', label: 'Tanpa kategori' },
                        ...categories.map((category) => ({
                            value: String(category.id),
                            label: category.name,
                        })),
                    ]}
                />

                <ImageInput
                    label="Gambar Spanduk"
                    value={form.banner ?? ''}
                    onChange={(value) =>
                        setForm((prev) => ({ ...prev, banner: value }))
                    }
                    folder="articles"
                />

                <div className="flex flex-col sm:flex-row gap-4">
                    <Input
                        label="Waktu Mulai"
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                starts_at: e.target.value,
                            }))
                        }
                        required
                    />
                    <Input
                        label="Waktu Selesai (opsional)"
                        type="datetime-local"
                        value={form.ends_at ?? ''}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                ends_at: e.target.value,
                            }))
                        }
                    />
                </div>

                <Input
                    label="Batas Akhir Pendaftaran (opsional)"
                    type="datetime-local"
                    value={form.registration_deadline ?? ''}
                    onChange={(e) =>
                        setForm((prev) => ({
                            ...prev,
                            registration_deadline: e.target.value,
                        }))
                    }
                />

                <Input
                    label="Biaya Pendaftaran (Rp, isi 0 kalau gratis)"
                    type="number"
                    min="0"
                    value={String(form.fee ?? '0')}
                    onChange={(e) =>
                        setForm((prev) => ({ ...prev, fee: e.target.value }))
                    }
                />

                <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={form.requires_document ?? false}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                requires_document: e.target.checked,
                            }))
                        }
                    />
                    Wajibkan peserta unggah dokumen saat mendaftar
                </label>

                <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={form.requires_meet_link ?? false}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                requires_meet_link: e.target.checked,
                            }))
                        }
                    />
                    Event ini punya link meeting online
                </label>

                {form.requires_meet_link && (
                    <Input
                        label="Link Meet"
                        value={form.meet_link ?? ''}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                meet_link: e.target.value,
                            }))
                        }
                        placeholder="https://meet.google.com/..."
                    />
                )}

                <Input
                    label="Link YouTube (opsional, tampil sebagai pemutar video di halaman event untuk pengunjung)"
                    value={form.youtube_url ?? ''}
                    onChange={(e) =>
                        setForm((prev) => ({
                            ...prev,
                            youtube_url: e.target.value,
                        }))
                    }
                    placeholder="https://youtube.com/watch?v=..."
                />

                <DocumentInput
                    label="Sertifikat (unggah file atau isi link di bawah)"
                    value={form.certificate_url ?? ''}
                    onChange={(value) =>
                        setForm((prev) => ({
                            ...prev,
                            certificate_url: value,
                        }))
                    }
                    folder="certificates"
                />
                <Input
                    label="atau Link Sertifikat"
                    value={form.certificate_url ?? ''}
                    onChange={(e) =>
                        setForm((prev) => ({
                            ...prev,
                            certificate_url: e.target.value,
                        }))
                    }
                    placeholder="https://..."
                />

                <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={form.is_active ?? true}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                is_active: e.target.checked,
                            }))
                        }
                    />
                    Tampilkan event ini secara publik
                </label>

                {statusMessage && (
                    <p className="text-red-600 text-sm">{statusMessage}</p>
                )}

                <div className="flex flex-row gap-2">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={
                            isSubmitting || !form.title || !form.starts_at
                        }
                    >
                        {isSubmitting
                            ? 'Menyimpan...'
                            : editingId
                              ? 'Simpan Perubahan'
                              : 'Buat Event'}
                    </Button>
                    {editingId && (
                        <Button variant="outline2" onClick={resetForm}>
                            Batal
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Daftar Event
                </h5>
                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : events.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">Belum ada event.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {events.map((event) => (
                            <div
                                key={event.id}
                                className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <div>
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {event.title}{' '}
                                        {!event.is_active && (
                                            <span className="text-oxford-navy-900/55 font-normal text-xs">
                                                (nonaktif)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        {event.category?.name ??
                                            'Tanpa kategori'}{' '}
                                        —{' '}
                                        {Number(event.fee) > 0
                                            ? rupiahFormatter.format(
                                                  Number(event.fee)
                                              )
                                            : 'Gratis'}{' '}
                                        — {event.confirmed_registrations_count}{' '}
                                        peserta terdaftar
                                    </p>
                                </div>
                                <div className="flex flex-row gap-2 shrink-0">
                                    <Button
                                        variant="outline2"
                                        onClick={() => handleEdit(event)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() =>
                                            handleDelete(event.id)
                                        }
                                    >
                                        Hapus
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
