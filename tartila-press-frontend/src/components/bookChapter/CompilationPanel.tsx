import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import * as templateApi from '@/data/manuscriptTemplate/manuscriptTemplateApi';
import { describeApiError } from '@/lib/apiErrors';
import { SHORT_STATUS_LABELS } from '@/lib/manuscriptStatus';

type Notice = { kind: 'ok' | 'error'; text: string };

/**
 * Admin: gabungkan naskah semua bab (urut nomor bab) menjadi satu naskah
 * buku untuk editor. Bab yang disetujui admin menunggu di sini sampai
 * semua terkumpul.
 */
export default function CompilationPanel({ projectId }: { projectId: number }) {
    const [overview, setOverview] =
        useState<adminApi.CompilationOverview | null>(null);
    const [templates, setTemplates] = useState<
        templateApi.ManuscriptTemplate[]
    >([]);
    const [autoLayout, setAutoLayout] = useState<boolean>(true);
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [notice, setNotice] = useState<Notice | null>(null);

    function load() {
        return adminApi
            .getBookChapterCompilation(projectId)
            .then((response) => setOverview(response.data))
            .catch((caught) =>
                setNotice({ kind: 'error', text: describeApiError(caught) })
            );
    }

    useEffect(() => {
        load();
        templateApi.list().then((response) => {
            const active = (
                response.data as templateApi.ManuscriptTemplate[]
            ).filter((template) => template.is_active);
            setTemplates(active);
            setTemplateId(
                (active.find((template) => template.is_default) ?? active[0])
                    ?.id ?? null
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    if (!overview) {
        return null;
    }

    const compilation = overview.compilation;
    const canCompile =
        overview.blockers.length === 0 &&
        (compilation === null || compilation.can_recompile);

    async function handleCompile() {
        if (!overview) return;

        if (
            overview.missing > 0 &&
            !window.confirm(
                `Masih ada ${overview.missing} bab yang belum terisi naskah. Gabungkan tanpa bab tersebut?`
            )
        ) {
            return;
        }

        setIsBusy(true);
        setNotice(null);

        try {
            const response = await adminApi.compileBookChapter(projectId, {
                auto_layout: autoLayout,
                manuscript_template_id: autoLayout ? templateId : undefined,
                allow_missing: overview.missing > 0,
            });
            setNotice({ kind: 'ok', text: response.message });
            await load();
        } catch (caught) {
            setNotice({ kind: 'error', text: describeApiError(caught) });
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Gabungkan Naskah Bab menjadi Buku
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Naskah tiap bab diperiksa admin satu per satu. Setelah semua
                    terkumpul, gabungkan menjadi satu naskah buku (urut nomor
                    bab) yang dikerjakan editor. Catatan revisi editor per bab
                    dikirim ke penulis bab tersebut.
                </p>
            </div>

            <ul className="flex flex-col gap-2">
                {overview.chapters.map((chapter) => (
                    <li
                        key={chapter.id}
                        className="flex flex-col gap-1 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex flex-col">
                            <span className="font-semibold text-oxford-navy-900">
                                BAB {chapter.chapter_number} · {chapter.title}
                            </span>
                            <span className="text-oxford-navy-900/65">
                                {chapter.manuscript
                                    ? `${chapter.manuscript.author ?? '-'} · ${chapter.manuscript.file ?? 'belum ada berkas disetujui'}`
                                    : 'Belum terisi naskah'}
                            </span>
                        </div>
                        {chapter.manuscript ? (
                            <Link
                                to={`/dashboard/naskah/${chapter.manuscript.id}`}
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                                    chapter.manuscript.ready
                                        ? 'bg-forest-moss-700 text-white'
                                        : 'bg-amber-100 text-amber-900'
                                }`}
                            >
                                {SHORT_STATUS_LABELS[
                                    chapter.manuscript.status
                                ] ?? chapter.manuscript.status}
                            </Link>
                        ) : (
                            <span className="shrink-0 rounded-full bg-oxford-navy-900/10 px-3 py-1 text-xs font-semibold text-oxford-navy-900/70">
                                Kosong
                            </span>
                        )}
                    </li>
                ))}
            </ul>

            {overview.blockers.length > 0 && (
                <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-amber-900 text-sm">
                    <p className="font-semibold">Belum bisa digabung:</p>
                    <ul className="list-disc pl-5">
                        {overview.blockers.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                        ))}
                    </ul>
                </div>
            )}

            {compilation && (
                <div className="flex flex-col gap-1 rounded-lg bg-oxford-navy-900/5 p-3 text-sm text-oxford-navy-900">
                    <p>
                        Naskah gabungan sudah dibuat ·{' '}
                        <strong>
                            {SHORT_STATUS_LABELS[compilation.status] ??
                                compilation.status}
                        </strong>
                        {compilation.editor
                            ? ` · Editor: ${compilation.editor}`
                            : ''}
                    </p>
                    <Link
                        to={`/dashboard/naskah/${compilation.id}`}
                        className="self-start text-forest-moss-700 hover:text-forest-moss-800"
                    >
                        Buka naskah gabungan →
                    </Link>
                </div>
            )}

            {(compilation === null || compilation.can_recompile) && (
                <div className="flex flex-col gap-3">
                    <label className="flex flex-row items-start gap-2 text-sm text-oxford-navy-900">
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={autoLayout}
                            onChange={(e) => setAutoLayout(e.target.checked)}
                        />
                        <span>
                            <span className="font-semibold">Auto layout</span> —
                            buku gabungan ditata dengan template (halaman judul,
                            daftar isi, judul bab, biodata penulis).
                        </span>
                    </label>
                    {autoLayout && (
                        <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                            Template naskah
                            <select
                                value={templateId ?? ''}
                                onChange={(e) =>
                                    setTemplateId(
                                        Number(e.target.value) || null
                                    )
                                }
                                className="w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 py-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500"
                            >
                                {templates.length === 0 && (
                                    <option value="">Belum ada template</option>
                                )}
                                {templates.map((template) => (
                                    <option
                                        key={template.id}
                                        value={template.id}
                                    >
                                        {template.name}
                                        {template.is_default ? ' (bawaan)' : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <Button
                        variant="primary"
                        className="self-start"
                        disabled={
                            isBusy ||
                            !canCompile ||
                            (autoLayout && templateId === null)
                        }
                        onClick={handleCompile}
                    >
                        {isBusy
                            ? 'Menggabungkan...'
                            : compilation
                              ? 'Gabungkan Ulang (Revisi Gabungan Baru)'
                              : 'Gabungkan & Kirim ke Editor'}
                    </Button>
                    {compilation && (
                        <small className="text-oxford-navy-900/60">
                            Gabung ulang menambah berkas gabungan baru dari
                            naskah bab terbaru (mis. setelah bab direvisi).
                            Hasil kerja editor tidak ikut berubah.
                        </small>
                    )}
                </div>
            )}

            {notice && (
                <p
                    role={notice.kind === 'error' ? 'alert' : 'status'}
                    className={`text-sm ${notice.kind === 'error' ? 'text-red-700' : 'text-forest-moss-700'}`}
                >
                    {notice.text}
                </p>
            )}
        </div>
    );
}
