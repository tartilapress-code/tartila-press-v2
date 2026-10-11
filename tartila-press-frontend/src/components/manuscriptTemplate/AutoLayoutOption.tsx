import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as templateApi from '@/data/manuscriptTemplate/manuscriptTemplateApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';

export type AutoLayoutValue = {
    enabled: boolean;
    templateId: number | null;
};

/**
 * Pilihan "auto layout" saat admin menyetujui naskah penulis: naskah Word
 * ditata dengan template naskah lalu dikirim ke editor sebagai berkas Word.
 */
export default function AutoLayoutOption({
    manuscriptId,
    revisionId,
    filename,
    value,
    onChange,
}: {
    manuscriptId: number;
    revisionId: number;
    filename: string;
    value: AutoLayoutValue;
    onChange: (value: AutoLayoutValue) => void;
}) {
    const [templates, setTemplates] = useState<
        templateApi.ManuscriptTemplate[]
    >([]);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');

    const isDocx = filename.toLowerCase().endsWith('.docx');

    useEffect(() => {
        templateApi
            .list()
            .then((response) => {
                const active = (
                    response.data as templateApi.ManuscriptTemplate[]
                ).filter((template) => template.is_active);
                setTemplates(active);

                const preferred =
                    active.find((template) => template.is_default) ?? active[0];

                if (preferred) {
                    onChange({ enabled: true, templateId: preferred.id });
                }
            })
            .catch((caught) => setMessage(describeApiError(caught)));
        // Hanya sekali saat dibuka; pilihan selanjutnya diatur admin.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function preview() {
        setIsBusy(true);
        setMessage('');

        try {
            const { blob, filename: name } =
                await templateApi.autoLayoutPreview(
                    manuscriptId,
                    revisionId,
                    value.templateId
                );
            saveBlob(blob, name ?? 'naskah-auto-layout.docx');
        } catch (caught) {
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    if (!isDocx) {
        return (
            <p className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-amber-800 text-sm">
                Auto layout hanya untuk naskah Word (.docx). Berkas ini (
                {filename}) akan dikirim ke editor apa adanya.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-4">
            <label className="flex flex-row items-start gap-2 text-sm text-oxford-navy-900">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={value.enabled}
                    onChange={(e) =>
                        onChange({ ...value, enabled: e.target.checked })
                    }
                />
                <span>
                    <span className="font-semibold">Auto layout</span> — bila
                    disetujui, naskah ditata otomatis dengan template lalu
                    dikirim ke editor dalam format Word (.docx).
                </span>
            </label>

            {value.enabled && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Template naskah
                        <select
                            value={value.templateId ?? ''}
                            onChange={(e) =>
                                onChange({
                                    ...value,
                                    templateId: Number(e.target.value) || null,
                                })
                            }
                            className="w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 py-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500"
                        >
                            {templates.length === 0 && (
                                <option value="">Belum ada template</option>
                            )}
                            {templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {template.name}
                                    {template.is_default ? ' (bawaan)' : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button
                        variant="outline2"
                        className="shrink-0"
                        disabled={isBusy || value.templateId === null}
                        onClick={preview}
                    >
                        {isBusy ? 'Menyiapkan...' : 'Pratinjau hasil (.docx)'}
                    </Button>
                </div>
            )}

            <p className="text-oxford-navy-900/60 text-xs">
                Template diatur di{' '}
                <Link
                    to="/admin/manuscript-templates"
                    className="text-forest-moss-700 underline"
                >
                    Template Naskah
                </Link>
                . Daftar isi, daftar gambar, dan daftar tabel diperbarui
                otomatis saat berkas dibuka di Word.
            </p>
            {message && <p className="text-red-600 text-sm">{message}</p>}
        </div>
    );
}
