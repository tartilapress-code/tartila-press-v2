import { RiCheckLine } from '@remixicon/react';
import { useContentLanguages } from '@/components/language/useContentLanguages';
import {
    CONTENT_LANGUAGES,
    type ContentLanguage,
} from '@/lib/contentLanguages';

/**
 * Pilihan bahasa untuk formulir (buku, proyek Book Chapter, profil editor):
 * satu tombol centang per bahasa, boleh memilih lebih dari satu. Yang
 * dikirim ke `onChange` selalu berurutan sesuai daftar bahasa.
 */
export default function ContentLanguageField({
    label,
    hint,
    value,
    onChange,
}: {
    label: string;
    hint?: string;
    value: readonly ContentLanguage[];
    onChange: (next: ContentLanguage[]) => void;
}) {
    const { name } = useContentLanguages();

    function toggle(code: ContentLanguage) {
        const chosen = new Set(value);

        if (chosen.has(code)) {
            chosen.delete(code);
        } else {
            chosen.add(code);
        }

        onChange(CONTENT_LANGUAGES.filter((item) => chosen.has(item)));
    }

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-oxford-navy-900">
                {label}
            </legend>
            {hint && <p className="text-xs text-oxford-navy-900/65">{hint}</p>}

            <div className="flex flex-wrap gap-2">
                {CONTENT_LANGUAGES.map((code) => {
                    const checked = value.includes(code);

                    return (
                        <label
                            key={code}
                            className={`relative inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-forest-moss-500/40 ${
                                checked
                                    ? 'border-forest-moss-700 bg-forest-moss-700 text-white'
                                    : 'border-oxford-navy-900/15 bg-white text-oxford-navy-900 hover:border-oxford-navy-900/30 hover:bg-forest-moss-50'
                            }`}
                        >
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() => toggle(code)}
                            />
                            {checked && (
                                <RiCheckLine aria-hidden className="size-4" />
                            )}
                            {name(code)}
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
