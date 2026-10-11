import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PillBadge from '@/components/ui/PillBadge';
import * as certificateApi from '@/data/certificate/certificateApi';
import type {
    CertificateTemplate,
    CertificateTemplateType,
} from '@/data/certificate/certificateApi';
import { describeApiError } from '@/lib/apiErrors';

const sections: {
    type: CertificateTemplateType;
    title: string;
    description: string;
}[] = [
    {
        type: 'event',
        title: 'Sertifikat Event',
        description:
            'Dipilih di pengaturan absensi sebuah event. Peserta bisa mengunduhnya setelah mengisi absensi.',
    },
    {
        type: 'publication',
        title: 'Sertifikat Penulis & Editor',
        description:
            'Terbit otomatis untuk setiap penulis/editor buku yang sudah punya ISBN dan tanggal terbit, selama templatnya aktif.',
    },
    {
        type: 'social',
        title: 'Poster Sosmed (Konten Sosmed)',
        description:
            'Latar poster untuk buku terbit. Letakkan kotak untuk judul, penulis, ISBN, harga, link, tulisan manual, dan foto cover ({cover} sendirian di satu kotak). Dipilih di halaman Konten Sosmed.',
    },
];

function roleLabel(template: CertificateTemplate): string {
    if (template.type === 'event') {
        return 'Peserta event';
    }

    if (template.type === 'social') {
        return 'Poster buku terbit';
    }

    if (template.role === 'author') {
        return 'Penulis';
    }

    return template.role === 'editor' ? 'Editor' : 'Penulis & Editor';
}

export default function CertificateTemplatesPage() {
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<string>('');

    function load() {
        certificateApi
            .adminList()
            .then((response) => setTemplates(response.data))
            .catch((error) => setMessage(describeApiError(error)))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
    }, []);

    async function handleDelete(template: CertificateTemplate) {
        if (!window.confirm(`Hapus templat "${template.name}"?`)) {
            return;
        }

        setMessage('');

        try {
            await certificateApi.adminDelete(template.id);
            load();
        } catch (error) {
            setMessage(describeApiError(error));
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {message && (
                <p role="alert" className="text-red-600 text-sm">
                    {message}
                </p>
            )}

            {sections.map((section) => {
                const items = templates.filter(
                    (template) => template.type === section.type
                );

                return (
                    <div
                        key={section.type}
                        className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6"
                    >
                        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-col gap-1">
                                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                                    {section.title}
                                </h5>
                                <p className="text-oxford-navy-900/70 max-w-2xl text-sm">
                                    {section.description}
                                </p>
                            </div>
                            <Link
                                to={`/admin/certificate-templates/new?type=${section.type}`}
                            >
                                <Button variant="secondary">
                                    Templat Baru
                                </Button>
                            </Link>
                        </div>

                        {isLoading ? (
                            <p className="text-oxford-navy-900/70 text-sm">
                                Memuat...
                            </p>
                        ) : items.length === 0 ? (
                            <p className="text-oxford-navy-900/70 text-sm">
                                Belum ada templat.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {items.map((template) => (
                                    <div
                                        key={template.id}
                                        className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3"
                                    >
                                        <img
                                            src={template.image_url}
                                            alt={`Gambar templat ${template.name}`}
                                            loading="lazy"
                                            className="w-full rounded-md bg-white object-contain ring-1 ring-forest-moss-200"
                                            style={{
                                                aspectRatio: `${template.image_width} / ${template.image_height}`,
                                            }}
                                        />
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-oxford-navy-900 font-semibold">
                                                {template.name}
                                            </p>
                                            <div className="flex flex-row flex-wrap items-center gap-2">
                                                <PillBadge
                                                    label={roleLabel(template)}
                                                />
                                                {!template.is_active && (
                                                    <span className="text-oxford-navy-900/55 text-xs">
                                                        (nonaktif)
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-oxford-navy-900/65 text-xs">
                                                {template.fields.length} kolom
                                                teks
                                                {template.type === 'event' &&
                                                    ` — dipakai ${template.events_count ?? 0} event`}
                                            </p>
                                        </div>
                                        <div className="flex flex-row gap-2">
                                            <Link
                                                to={`/admin/certificate-templates/${template.id}`}
                                            >
                                                <Button variant="outline2">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="outline2"
                                                onClick={() =>
                                                    handleDelete(template)
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
                );
            })}
        </div>
    );
}
