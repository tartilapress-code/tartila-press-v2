import PillBadge from '@/components/ui/PillBadge';
import { useContentLanguages } from '@/components/language/useContentLanguages';
import type { ContentLanguage } from '@/lib/contentLanguages';

/**
 * Deretan lencana kecil berisi nama bahasa (bahasa buku, bahasa yang dikuasai
 * editor). Tidak menampilkan apa pun bila daftarnya kosong.
 */
export default function ContentLanguageChips({
    codes,
    className = '',
}: {
    codes: readonly ContentLanguage[];
    className?: string;
}) {
    const { name } = useContentLanguages();

    if (codes.length === 0) {
        return null;
    }

    return (
        <ul className={`flex flex-wrap gap-1.5 ${className}`}>
            {codes.map((code) => (
                <li key={code}>
                    <PillBadge label={name(code)} />
                </li>
            ))}
        </ul>
    );
}
