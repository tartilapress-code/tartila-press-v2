import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import { ApiError } from '@/lib/http';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';
import BookGrid, { type ProfileBook } from '@/components/book/BookGrid';

const textareaClass = `
    w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40
    focus:ring-1 focus:ring-oxford-navy-500 focus:bg-forest-moss-50`;

type Experience = {
    id: number;
    title: string;
    description: string | null;
    year: number | null;
};

type PublicProfileState = {
    slug: string | null;
    pen_name: string;
    bio: string;
    city: string;
    profile_photo: string;
    is_published: boolean;
};

const emptyProfile: PublicProfileState = {
    slug: null,
    pen_name: '',
    bio: '',
    city: '',
    profile_photo: '',
    is_published: false,
};

const emptyExperienceForm = { title: '', description: '', year: '' };

export default function PublicProfilePage() {
    const { user } = useAuth();
    const isEligible = hasAnyRole(user, ['penulis', 'editor']);

    const isEditor = hasAnyRole(user, ['editor']);

    const [profile, setProfile] = useState<PublicProfileState>(emptyProfile);
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [books, setBooks] = useState<ProfileBook[]>([]);
    const [editedBooks, setEditedBooks] = useState<ProfileBook[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const [experienceForm, setExperienceForm] = useState(emptyExperienceForm);
    const [editingExperienceId, setEditingExperienceId] = useState<
        number | null
    >(null);

    useEffect(() => {
        if (!isEligible) {
            return;
        }

        publicProfileApi
            .getMine()
            .then((response) => {
                const data = response.data;
                if (data) {
                    setProfile({
                        slug: data.slug ?? null,
                        pen_name: data.pen_name ?? '',
                        bio: data.bio ?? '',
                        city: data.city ?? '',
                        profile_photo: data.profile_photo ?? '',
                        is_published: Boolean(data.is_published),
                    });
                    setExperiences(data.experiences ?? []);
                }
                setBooks(response.books ?? []);
                setEditedBooks(response.edited_books ?? []);
            })
            .finally(() => setIsLoading(false));
    }, [isEligible]);

    if (!isEligible) {
        return <Navigate to="/dashboard" replace />;
    }

    async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            const response = await publicProfileApi.upsert({
                pen_name: profile.pen_name,
                bio: profile.bio,
                city: profile.city,
                profile_photo: profile.profile_photo,
                is_published: profile.is_published,
            });
            setProfile((prev) => ({
                ...prev,
                slug: response.data.slug ?? prev.slug,
            }));
            setStatusMessage('Profil publik berhasil disimpan.');
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

    async function handleExperienceSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const payload = {
            title: experienceForm.title,
            description: experienceForm.description || undefined,
            year: experienceForm.year ? Number(experienceForm.year) : undefined,
        };

        try {
            if (editingExperienceId) {
                const response = await publicProfileApi.updateExperience(
                    editingExperienceId,
                    payload
                );
                setExperiences((prev) =>
                    prev.map((item) =>
                        item.id === editingExperienceId
                            ? response.data
                            : item
                    )
                );
            } else {
                const response =
                    await publicProfileApi.createExperience(payload);
                setExperiences((prev) => [...prev, response.data]);
            }

            setExperienceForm(emptyExperienceForm);
            setEditingExperienceId(null);
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        }
    }

    function handleEditExperience(experience: Experience) {
        setEditingExperienceId(experience.id);
        setExperienceForm({
            title: experience.title,
            description: experience.description ?? '',
            year: experience.year?.toString() ?? '',
        });
    }

    async function handleDeleteExperience(id: number) {
        try {
            await publicProfileApi.deleteExperience(id);
            setExperiences((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        }
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div className="flex flex-row items-center justify-between">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Profil Publik
                    </h5>
                    {profile.slug && (
                        <Link
                            to={`/penulis/${profile.slug}`}
                            target="_blank"
                            className="text-forest-moss-700 text-sm hover:text-forest-moss-800"
                        >
                            Lihat halaman publik →
                        </Link>
                    )}
                </div>

                <form
                    onSubmit={handleProfileSubmit}
                    className="flex flex-col gap-4"
                >
                    <Input
                        label="Nama Pena"
                        name="pen_name"
                        value={profile.pen_name}
                        onChange={(e) =>
                            setProfile((prev) => ({
                                ...prev,
                                pen_name: e.target.value,
                            }))
                        }
                    />

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-oxford-navy-900">Bio</label>
                        <textarea
                            className={textareaClass}
                            rows={4}
                            value={profile.bio}
                            onChange={(e) =>
                                setProfile((prev) => ({
                                    ...prev,
                                    bio: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <Input
                        label="Kota (opsional)"
                        name="city"
                        value={profile.city}
                        onChange={(e) =>
                            setProfile((prev) => ({
                                ...prev,
                                city: e.target.value,
                            }))
                        }
                    />

                    <ImageInput
                        label="Foto Profil"
                        value={profile.profile_photo}
                        onChange={(value) =>
                            setProfile((prev) => ({
                                ...prev,
                                profile_photo: value,
                            }))
                        }
                        folder="profiles"
                    />

                    <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                        <input
                            type="checkbox"
                            checked={profile.is_published}
                            onChange={(e) =>
                                setProfile((prev) => ({
                                    ...prev,
                                    is_published: e.target.checked,
                                }))
                            }
                        />
                        Tampilkan profil publik saya
                    </label>

                    {statusMessage && (
                        <p className="text-sm text-forest-moss-700">
                            {statusMessage}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        className="self-start"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </form>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Jejak Pengalaman
                </h5>

                <div className="flex flex-col gap-3">
                    {experiences.length === 0 && (
                        <p className="text-oxford-navy-900/70 text-sm">
                            Belum ada jejak pengalaman.
                        </p>
                    )}
                    {experiences.map((experience) => (
                        <div
                            key={experience.id}
                            className="flex flex-row items-start justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-oxford-navy-900 font-semibold">
                                    {experience.title}{' '}
                                    {experience.year && (
                                        <span className="text-oxford-navy-900/65 font-normal">
                                            ({experience.year})
                                        </span>
                                    )}
                                </p>
                                {experience.description && (
                                    <p className="text-oxford-navy-900/70 text-sm">
                                        {experience.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-row gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleEditExperience(experience)
                                    }
                                    className="text-forest-moss-700 text-sm hover:text-forest-moss-800"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleDeleteExperience(experience.id)
                                    }
                                    className="text-red-600 text-sm hover:text-red-700"
                                >
                                    Hapus
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <form
                    onSubmit={handleExperienceSubmit}
                    className="flex flex-col gap-4 border-t border-forest-moss-200 pt-4"
                >
                    <Input
                        label="Judul"
                        name="title"
                        value={experienceForm.title}
                        onChange={(e) =>
                            setExperienceForm((prev) => ({
                                ...prev,
                                title: e.target.value,
                            }))
                        }
                        required
                    />
                    <Input
                        label="Deskripsi"
                        name="description"
                        value={experienceForm.description}
                        onChange={(e) =>
                            setExperienceForm((prev) => ({
                                ...prev,
                                description: e.target.value,
                            }))
                        }
                    />
                    <Input
                        label="Tahun"
                        name="year"
                        value={experienceForm.year}
                        onChange={(e) =>
                            setExperienceForm((prev) => ({
                                ...prev,
                                year: e.target.value,
                            }))
                        }
                    />
                    <div className="flex flex-row gap-2">
                        <Button type="submit" variant="primary">
                            {editingExperienceId
                                ? 'Simpan Perubahan'
                                : 'Tambah'}
                        </Button>
                        {editingExperienceId && (
                            <Button
                                type="button"
                                variant="outline2"
                                onClick={() => {
                                    setEditingExperienceId(null);
                                    setExperienceForm(emptyExperienceForm);
                                }}
                            >
                                Batal
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Buku</h5>
                {books.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">Belum ada buku.</p>
                ) : (
                    <BookGrid books={books} />
                )}
            </div>

            {isEditor && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Buku yang Diedit
                    </h5>
                    {editedBooks.length === 0 ? (
                        <p className="text-oxford-navy-900/70 text-sm">
                            Belum ada buku yang diedit.
                        </p>
                    ) : (
                        <BookGrid books={editedBooks} />
                    )}
                </div>
            )}
        </div>
    );
}
