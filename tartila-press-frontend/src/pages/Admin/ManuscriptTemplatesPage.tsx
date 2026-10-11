import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as templateApi from '@/data/manuscriptTemplate/manuscriptTemplateApi';
import { describeApiError } from '@/lib/apiErrors';

const FORMAT_LABEL: Record<string, string> = {
    A4: 'A4',
    A5: 'A5',
    B5: 'B5',
    B6: 'B6',
    UNESCO: 'UNESCO',
    F14x20: '14×20 cm',
    F16x24: '16×24 cm',
    custom: 'Kustom',
};

function summary(template: templateApi.ManuscriptTemplate): string {
    const g = <T,>(path: string) =>
        templateApi.getPath<T>(template.config, path);
    const format = g<string>('page.format') ?? '';
    const size =
        format === 'custom'
            ? `${g('page.width_mm')}×${g('page.height_mm')} mm`
            : (FORMAT_LABEL[format] ?? format);

    return `${size} • ${g('typography.body.font')} ${g('typography.body.size_pt')} pt • spasi ${g('paragraph.line_spacing')}× • margin ${g('margins.top_mm')}/${g('margins.bottom_mm')}/${g('margins.inner_mm')}/${g('margins.outer_mm')} mm`;
}

export default function ManuscriptTemplatesPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<templateApi.ManuscriptTemplate[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const load = useCallback(() => {
        return templateApi
            .list()
            .then((response) => setItems(response.data))
            .catch((caught) => {
                setIsError(true);
                setMessage(describeApiError(caught));
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function run(
        id: number,
        action: () => Promise<{ message?: string }>
    ) {
        setBusyId(id);
        setMessage('');
        setIsError(false);

        try {
            const response = await action();
            setMessage(response.message ?? 'Berhasil.');
            await load();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Template Naskah
                </h5>
                <Button
                    variant="primary"
                    onClick={() => navigate('/admin/manuscript-templates/new')}
                >
                    Template baru
                </Button>
            </div>
            <p className="text-oxford-navy-900/80 text-sm">
                Template tata letak buku otomatis: ukuran halaman, margin,
                tipografi, header/footer, heading, gambar &amp; tabel, serta
                susunan bagian awal, isi, dan penutup. Saat menyetujui naskah
                Word penulis, admin bisa memilih auto layout: naskah ditata
                dengan template (bawaan terpilih otomatis) lalu dikirim ke
                editor dalam format Word.
            </p>

            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : items.length === 0 ? (
                <p className="text-oxford-navy-900/60 text-sm">
                    Belum ada template. Buat yang pertama dengan tombol
                    &quot;Template baru&quot;.
                </p>
            ) : (
                items.map((item) => (
                    <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-4"
                    >
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex flex-row flex-wrap items-center gap-2">
                                <Link
                                    to={`/admin/manuscript-templates/${item.id}`}
                                    className="text-oxford-navy-900 font-semibold hover:underline"
                                >
                                    {item.name}
                                </Link>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        item.is_active
                                            ? 'bg-forest-moss-100 text-forest-moss-800'
                                            : 'bg-oxford-navy-100 text-oxford-navy-700'
                                    }`}
                                >
                                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                                </span>
                                {item.is_default && (
                                    <span className="rounded-full bg-oxford-navy-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                                        Bawaan
                                    </span>
                                )}
                            </div>
                            {item.description && (
                                <p className="text-oxford-navy-900/70 text-sm">
                                    {item.description}
                                </p>
                            )}
                            <p className="text-oxford-navy-900/60 text-xs">
                                {summary(item)}
                            </p>
                        </div>
                        <div className="flex flex-row flex-wrap gap-2 shrink-0">
                            <Button
                                variant="outline2"
                                onClick={() =>
                                    navigate(
                                        `/admin/manuscript-templates/${item.id}`
                                    )
                                }
                            >
                                Ubah
                            </Button>
                            <Button
                                variant="outline2"
                                disabled={busyId === item.id}
                                onClick={() =>
                                    run(item.id, () =>
                                        templateApi.update(item.id, {
                                            is_active: !item.is_active,
                                        })
                                    )
                                }
                            >
                                {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <Button
                                variant="outline2"
                                disabled={busyId === item.id}
                                onClick={() =>
                                    run(item.id, () =>
                                        templateApi.duplicate(item.id)
                                    )
                                }
                            >
                                Salin
                            </Button>
                            {!item.is_default && (
                                <Button
                                    variant="outline2"
                                    disabled={busyId === item.id}
                                    onClick={() =>
                                        run(item.id, () =>
                                            templateApi.makeDefault(item.id)
                                        )
                                    }
                                >
                                    Jadikan bawaan
                                </Button>
                            )}
                            <Button
                                variant="outline2"
                                disabled={busyId === item.id || item.is_default}
                                title={
                                    item.is_default
                                        ? 'Template bawaan tidak bisa dihapus'
                                        : undefined
                                }
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            `Hapus template "${item.name}"?`
                                        )
                                    ) {
                                        run(item.id, () =>
                                            templateApi.remove(item.id)
                                        );
                                    }
                                }}
                            >
                                Hapus
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
