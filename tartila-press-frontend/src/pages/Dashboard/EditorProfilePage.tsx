import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Input from '@/components/Input/Input';
import ContentLanguageField from '@/components/language/ContentLanguageField';
import Button from '@/components/Button/Button';
import EditorInsightCard from '@/components/editor/EditorInsightCard';
import * as editorApi from '@/data/editor/editorApi';
import * as bookApi from '@/data/book/bookApi';
import { ApiError } from '@/lib/http';
import {
    toContentLanguages,
    type ContentLanguage,
} from '@/lib/contentLanguages';

const textareaClass = `
    w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40
    focus:ring-1 focus:ring-oxford-navy-500 focus:bg-forest-moss-50`;

export default function EditorProfilePage() {
    const { t } = useTranslation();
    const [fee, setFee] = useState<string>('0');
    const [bio, setBio] = useState<string>('');
    const [languages, setLanguages] = useState<ContentLanguage[]>([]);
    const [isAvailable, setIsAvailable] = useState<boolean>(true);
    // Layanan co-author: editor yang mencentang bisa dipilih penulis / ditunjuk admin sebagai co-author.
    const [isCoauthor, setIsCoauthor] = useState<boolean>(false);
    const [coauthorFee, setCoauthorFee] = useState<string>('0');
    const [coauthorBio, setCoauthorBio] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    // Bidang keahlian (diatur admin) — menentukan naskah pool yang terlihat.
    const [fields, setFields] = useState<string[]>([]);

    useEffect(() => {
        Promise.all([
            editorApi.getMyProfile(),
            bookApi.listFieldCategories().catch(() => ({ data: [] })),
        ])
            .then(([response, categoryResponse]) => {
                const profile = response.data;
                if (profile) {
                    setFee(profile.fee?.toString() ?? '0');
                    setBio(profile.bio ?? '');
                    setLanguages(toContentLanguages(profile.languages));
                    setIsAvailable(Boolean(profile.is_available));
                    setIsCoauthor(Boolean(profile.is_coauthor));
                    setCoauthorFee(profile.coauthor_fee?.toString() ?? '0');
                    setCoauthorBio(profile.coauthor_bio ?? '');

                    const ids: number[] = profile.field_category_ids ?? [];
                    setFields(
                        (
                            categoryResponse.data as {
                                id: number;
                                name: string;
                            }[]
                        )
                            .filter((category) => ids.includes(category.id))
                            .map((category) => category.name)
                    );
                }
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await editorApi.upsertMyProfile({
                fee,
                bio,
                languages,
                is_available: isAvailable,
                is_coauthor: isCoauthor,
                coauthor_fee: coauthorFee,
                coauthor_bio: coauthorBio,
            });
            setStatusMessage('Profil editor berhasil disimpan.');
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

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Profil Editor
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Atur fee tambahan Anda saat dipilih langsung oleh penulis,
                    bio, bahasa yang dikuasai, dan status ketersediaan. Bio dan
                    bahasa tampil saat penulis mengklik nama Anda di daftar
                    editor.
                </p>
            </div>

            <EditorInsightCard />

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Fee Tambahan (Rp)"
                    name="fee"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                />

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-oxford-navy-900">
                        Bio
                    </label>
                    <textarea
                        className={textareaClass}
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    />
                </div>

                <ContentLanguageField
                    label={t('contentLanguages.field.editorLabel')}
                    hint={t('contentLanguages.field.editorHint')}
                    value={languages}
                    onChange={setLanguages}
                />

                <div className="flex flex-col gap-1 rounded-lg bg-forest-moss-50 p-3 text-sm ring-1 ring-forest-moss-100">
                    <span className="font-medium text-oxford-navy-900">
                        Bidang keahlian (diatur admin)
                    </span>
                    <span className="text-oxford-navy-900/75">
                        {fields.length > 0
                            ? fields.join(', ')
                            : 'Belum diatur — Anda bisa mengambil naskah pool yang terbuka untuk umum.'}
                    </span>
                </div>

                <div className="flex flex-col gap-3 rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
                    <label className="flex flex-row items-center gap-2 font-medium text-oxford-navy-900">
                        <input
                            type="checkbox"
                            checked={isCoauthor}
                            onChange={(e) => setIsCoauthor(e.target.checked)}
                        />
                        Saya bersedia menjadi co-author
                    </label>
                    <p className="text-sm text-oxford-navy-900/75">
                        Co-author membantu penulis menyusun naskah mentah
                        sebelum dikoreksi editor. Namanya dicantumkan sebagai
                        penulis terakhir buku, dengan royalti tetap (bawaan 5%)
                        untuk buku cetak dan ebook, dan ikut menandatangani MOU.
                        Dalam satu naskah Anda tidak bisa menjadi co-author
                        sekaligus editornya.
                    </p>

                    {isCoauthor && (
                        <>
                            <Input
                                label="Fee Co-author Mandiri (Rp)"
                                name="coauthor_fee"
                                value={coauthorFee}
                                onChange={(e) => setCoauthorFee(e.target.value)}
                            />
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-oxford-navy-900">
                                    Keterangan Co-author
                                </label>
                                <textarea
                                    className={textareaClass}
                                    rows={4}
                                    value={coauthorBio}
                                    onChange={(e) =>
                                        setCoauthorBio(e.target.value)
                                    }
                                    placeholder="Pengalaman, bidang tulisan, dan gaya menyusun naskah Anda."
                                />
                            </div>
                        </>
                    )}
                </div>

                <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={(e) => setIsAvailable(e.target.checked)}
                    />
                    Tersedia untuk dipilih penulis
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
    );
}
