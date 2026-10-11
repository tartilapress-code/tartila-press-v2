import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
    RiArrowDownLine,
    RiArrowUpLine,
    RiEyeLine,
    RiEyeOffLine,
    RiUserLine,
} from '@remixicon/react';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import * as aboutApi from '@/data/about/aboutApi';
import type {
    AdminAbout,
    AdminTeamMember,
    AboutLegality,
    LegalityPayload,
    MemberPayload,
    ProfilePayload,
    SocialPlatform,
} from '@/data/about/aboutApi';
import { invalidateAboutPage } from '@/hooks/useAboutPage';
import { describeApiError } from '@/lib/apiErrors';
import { SOCIAL_META, mapEmbedUrl } from '@/lib/siteContact';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';
const textareaClass =
    'w-full rounded-xl p-3 text-sm outline-none ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 focus:bg-forest-moss-50 focus:ring-oxford-navy-500';
const iconButton =
    'flex size-9 items-center justify-center rounded-lg text-oxford-navy-700 ring-1 ring-forest-moss-200 transition-colors hover:bg-forest-moss-50 disabled:opacity-35';

function Textarea({
    label,
    value,
    onChange,
    rows = 4,
    hint,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    hint?: string;
}) {
    const id = useId();

    return (
        <div className="flex flex-col gap-2">
            <label
                htmlFor={id}
                className="text-sm font-medium text-oxford-navy-900"
            >
                {label}
            </label>
            <textarea
                id={id}
                rows={rows}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={textareaClass}
            />
            {hint && (
                <small className="text-xs text-oxford-navy-900/65">
                    {hint}
                </small>
            )}
        </div>
    );
}

/** Tombol naik/turun untuk mengurutkan daftar. */
function OrderButtons({
    index,
    count,
    disabled,
    onMove,
    name,
}: {
    index: number;
    count: number;
    disabled: boolean;
    onMove: (from: number, to: number) => void;
    name: string;
}) {
    return (
        <div className="flex shrink-0 flex-col gap-1">
            <button
                type="button"
                className={iconButton}
                onClick={() => onMove(index, index - 1)}
                disabled={disabled || index === 0}
                aria-label={`Naikkan ${name}`}
            >
                <RiArrowUpLine size={18} aria-hidden />
            </button>
            <button
                type="button"
                className={iconButton}
                onClick={() => onMove(index, index + 1)}
                disabled={disabled || index === count - 1}
                aria-label={`Turunkan ${name}`}
            >
                <RiArrowDownLine size={18} aria-hidden />
            </button>
        </div>
    );
}

function moved<T extends { id: number }>(
    items: T[],
    from: number,
    to: number
): number[] {
    const ids = items.map((item) => item.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);

    return ids;
}

const emptyLegality: LegalityPayload = {
    name: '',
    description: '',
    image_url: '',
};

const emptyMember: MemberPayload = {
    name: '',
    photo_url: '',
    position: '',
    expertise: '',
    is_visible: true,
};

function toProfileForm(data: AdminAbout): ProfilePayload {
    const { profile } = data;

    return {
        ...profile,
        vision: profile.vision ?? '',
        mission: profile.mission ?? '',
        profile: profile.profile ?? '',
        contact_email: profile.contact_email ?? '',
        phone: profile.phone ?? '',
        whatsapp: profile.whatsapp ?? '',
        address: profile.address ?? '',
        map_query: profile.map_query ?? '',
        social_links: { ...profile.social_links },
    };
}

/**
 * Kelola halaman "Tentang Kami": profil (visi, misi, profil, kontak, sosial
 * media, alamat + peta), legalitas, dan Tim Kami. Legalitas & tim bisa
 * diurutkan; anggota tim bisa ditampilkan/disembunyikan.
 */
export default function AboutSettingsPage() {
    const [data, setData] = useState<AdminAbout | null>(null);
    const [form, setForm] = useState<ProfilePayload | null>(null);
    const [message, setMessage] = useState<{
        tone: 'ok' | 'error';
        text: string;
    } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const [legalityForm, setLegalityForm] =
        useState<LegalityPayload>(emptyLegality);
    const [editingLegality, setEditingLegality] = useState<number | null>(null);
    const [memberForm, setMemberForm] = useState<MemberPayload>(emptyMember);
    const [editingMember, setEditingMember] = useState<number | null>(null);

    // Selalu dari nilai terbaru, supaya beberapa perubahan beruntun (mis.
    // isian otomatis browser) tidak saling menimpa.
    function updateForm(patch: Partial<ProfilePayload>) {
        setForm((current) => (current ? { ...current, ...patch } : current));
    }

    function updateSocial(platform: SocialPlatform, url: string) {
        setForm((current) =>
            current
                ? {
                      ...current,
                      social_links: {
                          ...current.social_links,
                          [platform]: url,
                      },
                  }
                : current
        );
    }

    function apply(next: AdminAbout) {
        setData(next);
        invalidateAboutPage();
    }

    useEffect(() => {
        aboutApi
            .adminGet()
            .then((response) => {
                setData(response.data);
                setForm(toProfileForm(response.data));
            })
            .catch((failure) =>
                setMessage({
                    tone: 'error',
                    text: describeApiError(
                        failure,
                        'Data Tentang Kami tidak bisa dimuat.'
                    ),
                })
            );
    }, []);

    async function run(
        key: string,
        task: () => Promise<{ data: AdminAbout; message: string }>,
        after?: () => void
    ) {
        setBusy(key);
        setMessage(null);

        try {
            const response = await task();
            apply(response.data);
            after?.();
            setMessage({ tone: 'ok', text: response.message });
        } catch (failure) {
            setMessage({ tone: 'error', text: describeApiError(failure) });
        } finally {
            setBusy(null);
        }
    }

    if (!data || !form) {
        return (
            <div className={cardClass}>
                {message ? (
                    <p role="alert" className="text-sm text-red-600">
                        {message.text}
                    </p>
                ) : (
                    <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
                )}
            </div>
        );
    }

    const mapPreview = mapEmbedUrl({
        ...data.profile,
        map_query: form.map_query,
        address: form.address,
    });

    function saveProfile(event: FormEvent) {
        event.preventDefault();
        run('profile', () =>
            aboutApi.adminUpdateProfile({
                ...form!,
                map_query: form!.map_query || null,
            })
        );
    }

    function submitLegality(event: FormEvent) {
        event.preventDefault();
        const payload = {
            ...legalityForm,
            description: legalityForm.description || null,
            image_url: legalityForm.image_url || null,
        };

        run(
            'legality',
            () =>
                editingLegality
                    ? aboutApi.adminUpdateLegality(editingLegality, payload)
                    : aboutApi.adminCreateLegality(payload),
            () => {
                setLegalityForm(emptyLegality);
                setEditingLegality(null);
            }
        );
    }

    function startEditLegality(item: AboutLegality) {
        setEditingLegality(item.id);
        setLegalityForm({
            name: item.name,
            description: item.description ?? '',
            image_url: item.image_url ?? '',
        });
    }

    function submitMember(event: FormEvent) {
        event.preventDefault();
        const payload = {
            ...memberForm,
            photo_url: memberForm.photo_url || null,
            position: memberForm.position || null,
            expertise: memberForm.expertise || null,
        };

        run(
            'member',
            () =>
                editingMember
                    ? aboutApi.adminUpdateMember(editingMember, payload)
                    : aboutApi.adminCreateMember(payload),
            () => {
                setMemberForm(emptyMember);
                setEditingMember(null);
            }
        );
    }

    function startEditMember(member: AdminTeamMember) {
        setEditingMember(member.id);
        setMemberForm({
            name: member.name,
            photo_url: member.photo_url ?? '',
            position: member.position ?? '',
            expertise: member.expertise ?? '',
            is_visible: member.is_visible,
        });
    }

    function toggleMember(member: AdminTeamMember) {
        run(`visible-${member.id}`, () =>
            aboutApi.adminUpdateMember(member.id, {
                name: member.name,
                photo_url: member.photo_url,
                position: member.position,
                expertise: member.expertise,
                is_visible: !member.is_visible,
            })
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                            Tentang Kami
                        </h5>
                        <p className="text-sm text-oxford-navy-900/70">
                            Isi halaman Tentang Kami. Kontak dan sosial media di
                            sini juga dipakai di footer dan tombol WhatsApp
                            seluruh situs.
                        </p>
                    </div>
                    <Link
                        to="/tentang-kami"
                        target="_blank"
                        className="text-sm font-semibold text-forest-moss-700 hover:text-forest-moss-800"
                    >
                        Lihat halaman →
                    </Link>
                </div>
                {message && (
                    <p
                        role={message.tone === 'error' ? 'alert' : 'status'}
                        className={
                            message.tone === 'error'
                                ? 'text-sm text-red-600'
                                : 'text-sm text-forest-moss-700'
                        }
                    >
                        {message.text}
                    </p>
                )}
            </div>

            {/* Profil, visi, misi, kontak, sosial media, alamat */}
            <form onSubmit={saveProfile} className={cardClass}>
                <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                    Profil, Visi & Misi
                </h6>
                <Textarea
                    label="Profil"
                    rows={5}
                    value={form.profile ?? ''}
                    onChange={(value) => updateForm({ profile: value })}
                />
                <Textarea
                    label="Visi"
                    rows={3}
                    value={form.vision ?? ''}
                    onChange={(value) => updateForm({ vision: value })}
                />
                <Textarea
                    label="Misi"
                    rows={5}
                    value={form.mission ?? ''}
                    onChange={(value) => updateForm({ mission: value })}
                    hint="Satu misi per baris; tampil sebagai daftar bernomor."
                />

                <h6 className="mt-2 font-display text-lg font-bold text-oxford-navy-700">
                    Kontak & Alamat
                </h6>
                <div className="grid gap-4 md:grid-cols-3">
                    <Input
                        label="Email"
                        type="email"
                        value={form.contact_email ?? ''}
                        onChange={(event) =>
                            updateForm({ contact_email: event.target.value })
                        }
                    />
                    <Input
                        label="Telepon"
                        value={form.phone ?? ''}
                        onChange={(event) =>
                            updateForm({ phone: event.target.value })
                        }
                    />
                    <div className="flex flex-col gap-1">
                        <Input
                            label="Nomor WhatsApp"
                            inputMode="numeric"
                            placeholder="6281234567890"
                            value={form.whatsapp ?? ''}
                            onChange={(event) =>
                                updateForm({ whatsapp: event.target.value })
                            }
                        />
                        <small className="text-xs text-oxford-navy-900/65">
                            Dengan kode negara, tanpa + atau spasi.
                        </small>
                    </div>
                </div>
                <Textarea
                    label="Alamat"
                    rows={3}
                    value={form.address ?? ''}
                    onChange={(value) => updateForm({ address: value })}
                />
                <div className="flex flex-col gap-1">
                    <Input
                        label="Kata kunci peta (opsional)"
                        placeholder="mis. Tartila Press, Padang atau -0.9471,100.4172"
                        value={form.map_query ?? ''}
                        onChange={(event) =>
                            updateForm({ map_query: event.target.value })
                        }
                    />
                    <small className="text-xs text-oxford-navy-900/65">
                        Nama tempat di Google Maps atau koordinat. Kosongkan
                        untuk memakai alamat di atas.
                    </small>
                </div>
                {mapPreview && (
                    <iframe
                        title="Pratinjau peta"
                        src={mapPreview}
                        loading="lazy"
                        className="aspect-[16/7] w-full rounded-xl border-0 ring-1 ring-forest-moss-100"
                    />
                )}

                <h6 className="mt-2 font-display text-lg font-bold text-oxford-navy-700">
                    Sosial Media
                </h6>
                <div className="grid gap-4 md:grid-cols-2">
                    {data.platforms.map((platform) => (
                        <Input
                            key={platform}
                            label={SOCIAL_META[platform].label}
                            placeholder="https://..."
                            value={form.social_links[platform] ?? ''}
                            onChange={(event) =>
                                updateSocial(platform, event.target.value)
                            }
                        />
                    ))}
                </div>
                <small className="-mt-2 text-xs text-oxford-navy-900/65">
                    Kosongkan yang tidak dipakai; hanya yang terisi yang tampil.
                </small>

                <label className="flex items-center gap-2 text-sm text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={form.show_team}
                        onChange={(event) =>
                            updateForm({ show_team: event.target.checked })
                        }
                    />
                    Tampilkan bagian "Tim Kami"
                </label>

                <Button
                    type="submit"
                    variant="primary"
                    className="self-start"
                    disabled={busy === 'profile'}
                >
                    {busy === 'profile' ? 'Menyimpan...' : 'Simpan Profil'}
                </Button>
            </form>

            {/* Legalitas */}
            <section className={cardClass} aria-labelledby="admin-legalitas">
                <div className="flex flex-col gap-1">
                    <h6
                        id="admin-legalitas"
                        className="font-display text-lg font-bold text-oxford-navy-700"
                    >
                        Legalitas ({data.legalities.length})
                    </h6>
                    <p className="text-sm text-oxford-navy-900/70">
                        Halaman publik menampilkan 3 sekaligus; selebihnya
                        digeser. Urutkan dengan tombol panah.
                    </p>
                </div>

                {data.legalities.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {data.legalities.map((item, index) => (
                            <li
                                key={item.id}
                                className="flex items-center gap-3 rounded-xl bg-forest-moss-50/60 p-3 ring-1 ring-forest-moss-100"
                            >
                                <OrderButtons
                                    index={index}
                                    count={data.legalities.length}
                                    disabled={busy !== null}
                                    name={item.name}
                                    onMove={(from, to) =>
                                        run('order-legality', () =>
                                            aboutApi.adminOrderLegalities(
                                                moved(data.legalities, from, to)
                                            )
                                        )
                                    }
                                />
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt=""
                                        className="h-16 w-20 shrink-0 rounded-lg bg-white object-contain ring-1 ring-forest-moss-100"
                                    />
                                ) : (
                                    <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-white text-xs text-oxford-navy-900/50 ring-1 ring-forest-moss-100">
                                        Tanpa foto
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-oxford-navy-900">
                                        {item.name}
                                    </p>
                                    {item.description && (
                                        <p className="line-clamp-2 text-sm text-oxford-navy-900/70">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                                    <Button
                                        variant="outline2"
                                        onClick={() => startEditLegality(item)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        disabled={busy !== null}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `Hapus legalitas "${item.name}"?`
                                                )
                                            ) {
                                                run('delete-legality', () =>
                                                    aboutApi.adminDeleteLegality(
                                                        item.id
                                                    )
                                                );
                                            }
                                        }}
                                    >
                                        Hapus
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <form
                    onSubmit={submitLegality}
                    className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-forest-moss-200"
                >
                    <p className="text-sm font-semibold text-oxford-navy-900">
                        {editingLegality
                            ? 'Edit legalitas'
                            : 'Tambah legalitas'}
                    </p>
                    <Input
                        label="Nama legalitas"
                        placeholder="mis. Akta Pendirian, NIB, SK Kemenkumham"
                        value={legalityForm.name}
                        onChange={(event) =>
                            setLegalityForm({
                                ...legalityForm,
                                name: event.target.value,
                            })
                        }
                        required
                    />
                    <Textarea
                        label="Keterangan"
                        rows={2}
                        value={legalityForm.description ?? ''}
                        onChange={(value) =>
                            setLegalityForm({
                                ...legalityForm,
                                description: value,
                            })
                        }
                    />
                    <ImageInput
                        label="Foto dokumen"
                        folder="about"
                        value={legalityForm.image_url ?? ''}
                        onChange={(value) =>
                            setLegalityForm({
                                ...legalityForm,
                                image_url: value,
                            })
                        }
                    />
                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={
                                busy === 'legality' || !legalityForm.name.trim()
                            }
                        >
                            {editingLegality ? 'Simpan' : 'Tambah'}
                        </Button>
                        {editingLegality && (
                            <Button
                                type="button"
                                variant="outline2"
                                onClick={() => {
                                    setEditingLegality(null);
                                    setLegalityForm(emptyLegality);
                                }}
                            >
                                Batal
                            </Button>
                        )}
                    </div>
                </form>
            </section>

            {/* Tim Kami */}
            <section className={cardClass} aria-labelledby="admin-tim">
                <div className="flex flex-col gap-1">
                    <h6
                        id="admin-tim"
                        className="font-display text-lg font-bold text-oxford-navy-700"
                    >
                        Tim Kami ({data.team.length})
                    </h6>
                    <p className="text-sm text-oxford-navy-900/70">
                        Opsional. Pilih siapa yang ditampilkan (ikon mata) dan
                        urutkan dengan tombol panah.
                        {!data.profile.show_team &&
                            ' Bagian Tim Kami sedang disembunyikan seluruhnya (lihat pengaturan profil di atas).'}
                    </p>
                </div>

                {data.team.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {data.team.map((member, index) => (
                            <li
                                key={member.id}
                                className={`flex items-center gap-3 rounded-xl p-3 ring-1 ring-forest-moss-100 ${
                                    member.is_visible
                                        ? 'bg-forest-moss-50/60'
                                        : 'bg-white opacity-70'
                                }`}
                            >
                                <OrderButtons
                                    index={index}
                                    count={data.team.length}
                                    disabled={busy !== null}
                                    name={member.name}
                                    onMove={(from, to) =>
                                        run('order-member', () =>
                                            aboutApi.adminOrderMembers(
                                                moved(data.team, from, to)
                                            )
                                        )
                                    }
                                />
                                {member.photo_url ? (
                                    <img
                                        src={member.photo_url}
                                        alt=""
                                        className="size-14 shrink-0 rounded-full object-cover ring-2 ring-white"
                                    />
                                ) : (
                                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-forest-moss-600 ring-1 ring-forest-moss-100">
                                        <RiUserLine size={24} aria-hidden />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-oxford-navy-900">
                                        {member.name}
                                        {!member.is_visible && (
                                            <span className="ml-2 text-xs font-normal text-oxford-navy-900/60">
                                                (disembunyikan)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-sm text-oxford-navy-900/70">
                                        {[member.position, member.expertise]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className={iconButton}
                                    onClick={() => toggleMember(member)}
                                    disabled={busy !== null}
                                    aria-pressed={member.is_visible}
                                    aria-label={
                                        member.is_visible
                                            ? `Sembunyikan ${member.name}`
                                            : `Tampilkan ${member.name}`
                                    }
                                    title={
                                        member.is_visible
                                            ? 'Ditampilkan — klik untuk menyembunyikan'
                                            : 'Disembunyikan — klik untuk menampilkan'
                                    }
                                >
                                    {member.is_visible ? (
                                        <RiEyeLine size={18} aria-hidden />
                                    ) : (
                                        <RiEyeOffLine size={18} aria-hidden />
                                    )}
                                </button>
                                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                                    <Button
                                        variant="outline2"
                                        onClick={() => startEditMember(member)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        disabled={busy !== null}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `Hapus ${member.name} dari Tim Kami?`
                                                )
                                            ) {
                                                run('delete-member', () =>
                                                    aboutApi.adminDeleteMember(
                                                        member.id
                                                    )
                                                );
                                            }
                                        }}
                                    >
                                        Hapus
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <form
                    onSubmit={submitMember}
                    className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-forest-moss-200"
                >
                    <p className="text-sm font-semibold text-oxford-navy-900">
                        {editingMember
                            ? 'Edit anggota tim'
                            : 'Tambah anggota tim'}
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Input
                            label="Nama"
                            value={memberForm.name}
                            onChange={(event) =>
                                setMemberForm({
                                    ...memberForm,
                                    name: event.target.value,
                                })
                            }
                            required
                        />
                        <Input
                            label="Posisi"
                            placeholder="mis. Direktur, Editor Senior"
                            value={memberForm.position ?? ''}
                            onChange={(event) =>
                                setMemberForm({
                                    ...memberForm,
                                    position: event.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Input
                            label="Keahlian"
                            placeholder="mis. Penyuntingan, Tata Letak, Hukum"
                            value={memberForm.expertise ?? ''}
                            onChange={(event) =>
                                setMemberForm({
                                    ...memberForm,
                                    expertise: event.target.value,
                                })
                            }
                        />
                        <small className="text-xs text-oxford-navy-900/65">
                            Pisahkan dengan koma; tampil sebagai lencana.
                        </small>
                    </div>
                    <ImageInput
                        label="Foto"
                        folder="about"
                        value={memberForm.photo_url ?? ''}
                        onChange={(value) =>
                            setMemberForm({ ...memberForm, photo_url: value })
                        }
                    />
                    <label className="flex items-center gap-2 text-sm text-oxford-navy-900">
                        <input
                            type="checkbox"
                            checked={memberForm.is_visible}
                            onChange={(event) =>
                                setMemberForm({
                                    ...memberForm,
                                    is_visible: event.target.checked,
                                })
                            }
                        />
                        Tampilkan di halaman Tentang Kami
                    </label>
                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={
                                busy === 'member' || !memberForm.name.trim()
                            }
                        >
                            {editingMember ? 'Simpan' : 'Tambah'}
                        </Button>
                        {editingMember && (
                            <Button
                                type="button"
                                variant="outline2"
                                onClick={() => {
                                    setEditingMember(null);
                                    setMemberForm(emptyMember);
                                }}
                            >
                                Batal
                            </Button>
                        )}
                    </div>
                </form>
            </section>
        </div>
    );
}
