import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Button from '@/components/Button/Button';
import * as manuscriptApi from '@/data/manuscript/manuscriptApi';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';
import * as orderApi from '@/data/order/orderApi';
import * as userApi from '@/data/user/userApi';
import { useAuth } from '@/context/useAuth';
import { ApiError } from '@/lib/http';

type CoAuthorEntry = { id: number; name: string };
type SearchResult = { id: number; name: string };

function CoAuthorPicker({
    coAuthors,
    onChange,
    currentUserId,
}: {
    coAuthors: CoAuthorEntry[];
    onChange: (coAuthors: CoAuthorEntry[]) => void;
    currentUserId: number | undefined;
}) {
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    useEffect(() => {
        if (query.trim().length < 2) {
            return;
        }

        const timeout = setTimeout(() => {
            setIsSearching(true);
            userApi
                .search(query.trim())
                .then((response) => setResults(response.data))
                .catch(() => setResults([]))
                .finally(() => setIsSearching(false));
        }, 300);

        return () => clearTimeout(timeout);
    }, [query]);

    function addCoAuthor(result: SearchResult) {
        if (coAuthors.some((a) => a.id === result.id)) {
            return;
        }
        onChange([...coAuthors, { id: result.id, name: result.name }]);
        setQuery('');
        setResults([]);
    }

    function removeCoAuthor(index: number) {
        onChange(coAuthors.filter((_, i) => i !== index));
    }

    function moveUp(index: number) {
        if (index === 0) return;
        const next = [...coAuthors];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        onChange(next);
    }

    function moveDown(index: number) {
        if (index === coAuthors.length - 1) return;
        const next = [...coAuthors];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        onChange(next);
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="text-white">Penulis Lain (opsional)</label>
            <p className="text-white/60 text-xs">
                Cari akun yang sudah terdaftar untuk ditambahkan sebagai
                penulis. Anda bisa mengurutkan siapa penulis pertama, kedua,
                dst.
            </p>

            <div className="relative">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full p-2 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white outline-none"
                    placeholder="Cari nama akun..."
                />
                {query.trim().length >= 2 && (
                    <div className="absolute z-10 mt-1 w-full bg-oxford-navy-900 ring-1 ring-white/20 rounded-lg overflow-hidden">
                        {isSearching ? (
                            <p className="text-white/60 text-sm p-2">
                                Mencari...
                            </p>
                        ) : results.length === 0 ? (
                            <p className="text-white/60 text-sm p-2">
                                Tidak ada akun ditemukan.
                            </p>
                        ) : (
                            results.map((result) => (
                                <button
                                    type="button"
                                    key={result.id}
                                    onClick={() => addCoAuthor(result)}
                                    className="w-full text-left text-white/80 text-sm px-3 py-2 hover:bg-oxford-navy-700"
                                >
                                    {result.name}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <ul className="flex flex-col gap-1">
                {coAuthors.map((author, index) => (
                    <li
                        key={author.id}
                        className="flex flex-row items-center justify-between gap-2 text-white/80 text-sm bg-oxford-navy-900/40 rounded px-3 py-1"
                    >
                        <span>
                            {index + 1}. {author.name}
                            {author.id === currentUserId ? ' (Anda)' : ''}
                        </span>
                        <div className="flex flex-row items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="text-white/60 hover:text-white disabled:opacity-30"
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                onClick={() => moveDown(index)}
                                disabled={index === coAuthors.length - 1}
                                className="text-white/60 hover:text-white disabled:opacity-30"
                            >
                                ↓
                            </button>
                            {author.id !== currentUserId && (
                                <button
                                    type="button"
                                    onClick={() => removeCoAuthor(index)}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    Hapus
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function ManuscriptSubmitPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [title, setTitle] = useState<string>('');
    const [coAuthors, setCoAuthors] = useState<CoAuthorEntry[]>(() =>
        user ? [{ id: user.id, name: user.name }] : []
    );
    const [file, setFile] = useState<File | null>(null);
    const [bioPhoto, setBioPhoto] = useState<string>('');
    const [bioName, setBioName] = useState<string>('');
    const [bioText, setBioText] = useState<string>('');
    const [defaultBio, setDefaultBio] = useState<{
        photo: string | null;
        name: string | null;
        bio: string | null;
    } | null>(null);

    const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(true);
    const [bookChapterTitle, setBookChapterTitle] = useState<string | null>(
        null
    );

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        publicProfileApi
            .getMine()
            .then((response) => {
                const profile = response.data;
                if (profile) {
                    setDefaultBio({
                        photo: profile.profile_photo,
                        name: profile.pen_name,
                        bio: profile.bio,
                    });
                }
            })
            .catch(() => setDefaultBio(null));
    }, []);

    useEffect(() => {
        orderApi
            .mine()
            .then((response) => {
                const order = response.data.find(
                    (o: { id: number }) => String(o.id) === orderId
                );
                const firstItem = order?.items?.[0];
                if (firstItem?.itemable_type === 'App\\Models\\BookChapter') {
                    setBookChapterTitle(firstItem.name);
                }
            })
            .finally(() => setIsLoadingOrder(false));
    }, [orderId]);

    const isBookChapter = bookChapterTitle !== null;

    async function handleSubmit() {
        if (!file) {
            setErrorMessage('File naskah wajib diunggah.');
            return;
        }
        if (!isBookChapter && !title.trim()) {
            setErrorMessage('Judul buku wajib diisi.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        const formData = new FormData();
        formData.append('order_id', orderId ?? '');
        formData.append('file', file);

        if (!isBookChapter) {
            formData.append('title', title);
            coAuthors.forEach((author, index) =>
                formData.append(`author_user_ids[${index}]`, String(author.id))
            );
        }

        if (bioPhoto) formData.append('author_bio_photo', bioPhoto);
        if (bioName) formData.append('author_bio_name', bioName);
        if (bioText) formData.append('author_bio_text', bioText);

        try {
            const response = await manuscriptApi.submit(formData);
            navigate(`/dashboard/naskah/${response.data.id}`);
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoadingOrder) {
        return (
            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6 max-w-xl">
                <p className="text-white/70 text-sm">Memuat...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6 max-w-xl">
            <div>
                <h5 className="text-white text-xl font-semibold">
                    Submit Naskah
                </h5>
                <p className="text-white/70 text-sm">
                    Lengkapi keterangan buku dan unggah naskah Anda.
                </p>
            </div>

            {isBookChapter ? (
                <>
                    <div className="flex flex-col gap-1">
                        <label className="text-white/70 text-sm">
                            Judul Buku
                        </label>
                        <p className="text-white">{bookChapterTitle}</p>
                    </div>
                    <p className="text-white/60 text-sm">
                        Penulis: Anda sendiri (naskah Book Chapter tidak
                        dapat ditambah penulis lain).
                    </p>
                </>
            ) : (
                <>
                    <Input
                        label="Judul Buku"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                    <CoAuthorPicker
                        coAuthors={coAuthors}
                        onChange={setCoAuthors}
                        currentUserId={user?.id}
                    />
                </>
            )}

            <div className="flex flex-col gap-2">
                <label className="text-white">
                    File Naskah (pdf/doc/docx/odt, maks 20MB)
                </label>
                <input
                    type="file"
                    accept=".pdf,.doc,.docx,.odt"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="text-white text-sm"
                />
            </div>

            <hr className="border-white/20" />
            <div>
                <h6 className="text-white font-semibold">
                    Biodata Penulis (untuk akhir buku)
                </h6>
                <p className="text-white/60 text-sm">
                    Opsional — kalau dikosongkan, otomatis diambil dari Profil
                    Publik Anda
                    {defaultBio?.name ? ` (${defaultBio.name})` : ''}.
                </p>
            </div>

            <ImageInput
                label="Foto (opsional)"
                placeholder={defaultBio?.photo ?? 'https://...'}
                value={bioPhoto}
                onChange={setBioPhoto}
                folder="bio-photos"
            />
            <Input
                label="Nama Tampil (opsional)"
                placeholder={defaultBio?.name ?? ''}
                value={bioName}
                onChange={(e) => setBioName(e.target.value)}
            />
            <Input
                label="Bio Singkat (opsional)"
                placeholder={defaultBio?.bio ?? ''}
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
            />

            {errorMessage && (
                <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Mengunggah...' : 'Submit Naskah'}
            </Button>
        </div>
    );
}
