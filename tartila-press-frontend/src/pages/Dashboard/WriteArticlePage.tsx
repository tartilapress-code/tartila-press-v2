import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import { ApiError } from '@/lib/http';
import * as articleApi from '@/data/article/articleApi';
import * as bookApi from '@/data/book/bookApi';

const textareaClass = `
    w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40
    focus:ring-1 focus:ring-oxford-navy-500 focus:bg-forest-moss-50`;

export default function WriteArticlePage() {
    const navigate = useNavigate();

    const [fieldCategories, setFieldCategories] = useState<
        { id: number; name: string }[]
    >([]);

    const [title, setTitle] = useState<string>('');
    const [photo, setPhoto] = useState<string>('');
    const [fieldCategoryId, setFieldCategoryId] = useState<string>('');
    const [body, setBody] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        bookApi
            .listFieldCategories()
            .then((response) => setFieldCategories(response.data));
    }, []);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            await articleApi.create({
                title,
                photo: photo || undefined,
                field_category_id: fieldCategoryId,
                body,
            });
            navigate('/dashboard/artikel-saya');
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

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Tulis Artikel
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Artikel Anda akan tayang setelah disetujui admin.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Judul"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />

                <ImageInput
                    label="Foto (opsional)"
                    value={photo}
                    onChange={setPhoto}
                    folder="articles"
                />

                <Select
                    name="field_category_id"
                    label="Bidang Keilmuan"
                    value={fieldCategoryId}
                    onChange={(e) => setFieldCategoryId(e.target.value)}
                    option_data={[
                        { value: '', label: 'Pilih bidang keilmuan' },
                        ...fieldCategories.map((field) => ({
                            value: String(field.id),
                            label: field.name,
                        })),
                    ]}
                    required
                />

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-oxford-navy-900">Essay</label>
                    <textarea
                        className={textareaClass}
                        rows={12}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Tulis essay Anda di sini..."
                        required
                    />
                </div>

                {errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    className="self-start"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Mengirim...' : 'Kirim Artikel'}
                </Button>
            </form>
        </div>
    );
}
