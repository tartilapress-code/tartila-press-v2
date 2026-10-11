import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import TemplateEditor from '@/components/certificate/TemplateEditor';
import * as certificateApi from '@/data/certificate/certificateApi';
import type {
    CertificateTemplate,
    CertificateTemplateType,
    EditorMeta,
} from '@/data/certificate/certificateApi';
import { describeApiError } from '@/lib/apiErrors';

/** /admin/certificate-templates/new?type=event|publication and /:id */
export default function CertificateTemplateEditorPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();

    const [meta, setMeta] = useState<EditorMeta | null>(null);
    const [template, setTemplate] = useState<CertificateTemplate | null>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            certificateApi.adminMeta(),
            id ? certificateApi.adminGet(Number(id)) : Promise.resolve(null),
        ])
            .then(([metaResponse, templateResponse]) => {
                if (cancelled) {
                    return;
                }

                setMeta(metaResponse.data);
                setTemplate(templateResponse ? templateResponse.data : null);
            })
            .catch((failure) => {
                if (!cancelled) {
                    setError(
                        describeApiError(failure, 'Templat tidak bisa dimuat.')
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    if (error) {
        return (
            <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
                <Link
                    to="/admin/certificate-templates"
                    className="text-forest-moss-700 hover:text-forest-moss-800 self-start text-sm underline"
                >
                    Kembali ke daftar templat
                </Link>
            </div>
        );
    }

    // A template loaded for another route (or for "new") must not linger
    // while this one loads.
    const activeTemplate =
        id !== undefined && String(template?.id) === id ? template : null;
    const isLoading = !meta || (id !== undefined && activeTemplate === null);

    if (!meta || isLoading) {
        return (
            <div className="bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            </div>
        );
    }

    const type: CertificateTemplateType =
        activeTemplate?.type ??
        (searchParams.get('type') === 'publication'
            ? 'publication'
            : searchParams.get('type') === 'social'
              ? 'social'
              : 'event');

    return (
        <TemplateEditor
            key={activeTemplate?.id ?? `baru-${type}`}
            meta={meta}
            type={type}
            template={activeTemplate}
        />
    );
}
