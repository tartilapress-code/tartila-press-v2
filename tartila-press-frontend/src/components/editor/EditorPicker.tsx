import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiArrowDownSLine } from '@remixicon/react';
import ContentLanguageChips from '@/components/language/ContentLanguageChips';
import { toContentLanguages } from '@/lib/contentLanguages';

/** Satu editor di daftar (`GET /editors`). */
export type EditorOption = {
    user_id: number;
    name: string;
    fee: string;
    bio: string | null;
    languages?: string[];
    // Dipromosikan admin (tampil teratas) / dalam pemantauan admin (disarankan memilih yang lain).
    is_promoted?: boolean;
    under_monitoring?: boolean;
};

/**
 * Daftar editor yang bisa dipilih penulis. Pilihan dilakukan lewat tombol
 * radio; mengklik NAMA editor membuka rincian: bahasa yang dikuasai dan bio
 * (tanpa mengubah pilihan, jadi beberapa editor bisa dibandingkan dulu).
 */
export default function EditorPicker({
    editors,
    selectedId,
    onSelect,
    formatFee,
    groupName = 'editor',
    hint,
    emptyText,
}: {
    editors: EditorOption[];
    selectedId: number | null;
    onSelect: (userId: number) => void;
    /** Format biaya editor, mengikuti halaman yang memakainya. */
    formatFee: (fee: number) => string;
    /** Nama grup radio; beda untuk daftar lain (mis. co-author) di halaman yang sama. */
    groupName?: string;
    /** Teks petunjuk / daftar kosong khusus (bawaan: untuk editor). */
    hint?: string;
    emptyText?: string;
}) {
    const { t } = useTranslation();
    const baseId = useId();
    const [openIds, setOpenIds] = useState<number[]>([]);

    function toggleDetails(userId: number) {
        setOpenIds((previous) =>
            previous.includes(userId)
                ? previous.filter((id) => id !== userId)
                : [...previous, userId]
        );
    }

    if (editors.length === 0) {
        return (
            <p className="text-sm text-oxford-navy-900/70">
                {emptyText ?? t('editors.picker.empty')}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-oxford-navy-900/65">
                {hint ?? t('editors.picker.hint')}
            </p>

            <div
                role="radiogroup"
                aria-label={t('editors.picker.groupAria')}
                className="flex flex-col gap-2"
            >
                {editors.map((editor) => {
                    const isOpen = openIds.includes(editor.user_id);
                    const radioId = `${baseId}-radio-${editor.user_id}`;
                    const panelId = `${baseId}-details-${editor.user_id}`;
                    const languages = toContentLanguages(editor.languages);
                    const bio = editor.bio?.trim() ?? '';

                    return (
                        <div
                            key={editor.user_id}
                            className="rounded-lg bg-forest-moss-50 text-oxford-navy-900 ring-1 ring-forest-moss-100"
                        >
                            <div className="flex flex-row items-center gap-3 p-3">
                                <input
                                    id={radioId}
                                    type="radio"
                                    name={groupName}
                                    className="shrink-0"
                                    aria-label={t('editors.picker.selectAria', {
                                        name: editor.name,
                                    })}
                                    checked={selectedId === editor.user_id}
                                    onChange={() => onSelect(editor.user_id)}
                                />

                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    aria-controls={panelId}
                                    aria-label={t('editors.picker.nameAria', {
                                        name: editor.name,
                                    })}
                                    onClick={() =>
                                        toggleDetails(editor.user_id)
                                    }
                                    className="flex min-w-0 flex-1 items-center gap-1 text-left font-medium hover:cursor-pointer hover:underline"
                                >
                                    <span className="min-w-0 break-words">
                                        {editor.name}
                                    </span>
                                    {editor.is_promoted && (
                                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                                            {t('editors.picker.promoted')}
                                        </span>
                                    )}
                                    <RiArrowDownSLine
                                        aria-hidden
                                        className={`size-4 shrink-0 transition-transform ${
                                            isOpen ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                <label
                                    htmlFor={radioId}
                                    className="shrink-0 cursor-pointer text-sm text-forest-moss-700"
                                >
                                    +{formatFee(Number(editor.fee))}
                                </label>
                            </div>

                            {editor.under_monitoring && (
                                <p
                                    role="note"
                                    className="mx-3 mb-3 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200"
                                >
                                    {t('editors.picker.monitored')}
                                </p>
                            )}

                            {isOpen && (
                                <dl
                                    id={panelId}
                                    className="flex flex-col gap-3 border-t border-forest-moss-100 px-3 py-3 text-sm"
                                >
                                    <div>
                                        <dt className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/65">
                                            {t('editors.picker.languagesTitle')}
                                        </dt>
                                        <dd className="mt-1.5">
                                            {languages.length > 0 ? (
                                                <ContentLanguageChips
                                                    codes={languages}
                                                />
                                            ) : (
                                                <span className="text-oxford-navy-900/65">
                                                    {t(
                                                        'editors.picker.languagesEmpty'
                                                    )}
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/65">
                                            {t('editors.picker.bioTitle')}
                                        </dt>
                                        <dd
                                            className={`mt-1.5 break-words leading-relaxed ${
                                                bio
                                                    ? 'whitespace-pre-line'
                                                    : 'text-oxford-navy-900/65'
                                            }`}
                                        >
                                            {bio ||
                                                t('editors.picker.bioEmpty')}
                                        </dd>
                                    </div>
                                </dl>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
