import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiCloseLine, RiSearchLine } from '@remixicon/react';
import { useDismiss } from '@/hooks/useDismiss';
import { catalogSearchPath } from '@/lib/catalogSearch';

/**
 * Kolom cari judul/penulis buku. Mengirim ke katalog buku, yang membaca
 * kata kunci dari alamat (`?cari=`).
 */
function SearchForm({
    onDone,
    focusOnMount = false,
    className = '',
}: {
    onDone?: () => void;
    focusOnMount?: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const [term, setTerm] = useState<string>('');

    useEffect(() => {
        if (focusOnMount) {
            inputRef.current?.focus();
        }
    }, [focusOnMount]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        navigate(catalogSearchPath(term));
        setTerm('');
        onDone?.();
    }

    return (
        <form
            role="search"
            onSubmit={handleSubmit}
            className={`flex items-center gap-2 ${className}`}
        >
            <label className="relative block min-w-0 flex-1">
                <RiSearchLine
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-oxford-navy-700"
                />
                <input
                    ref={inputRef}
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder={t('nav.search.placeholder')}
                    aria-label={t('nav.search.label')}
                    className="h-11 w-full rounded-xl border border-oxford-navy-900/10 bg-forest-moss-50/60 pl-10 pr-3 text-sm text-oxford-navy-900 outline-none transition placeholder:text-oxford-navy-900/45 focus:border-forest-moss-500 focus:bg-white focus:ring-2 focus:ring-forest-moss-500/30"
                />
            </label>
            <button
                type="submit"
                className="h-11 shrink-0 rounded-xl bg-oxford-navy-700 px-4 text-sm font-semibold text-white transition-colors hover:cursor-pointer hover:bg-oxford-navy-600"
            >
                {t('nav.search.submit')}
            </button>
        </form>
    );
}

/** Ikon kaca pembesar di navbar yang membuka kolom cari di bawahnya. */
export default function NavbarSearch() {
    const { t } = useTranslation();
    const [open, setOpen] = useState<boolean>(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useDismiss(open, () => setOpen(false), rootRef);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
                aria-label={open ? t('nav.search.close') : t('nav.search.open')}
                className="inline-flex size-10 items-center justify-center rounded-full text-oxford-navy-900 transition-colors hover:cursor-pointer hover:bg-forest-moss-50 hover:text-oxford-navy-700"
            >
                {open ? (
                    <RiCloseLine aria-hidden className="size-6" />
                ) : (
                    <RiSearchLine aria-hidden className="size-6" />
                )}
            </button>

            {open && (
                <div className="fixed inset-x-4 top-[4.5rem] z-50 rounded-2xl border border-forest-moss-100 bg-white p-3 shadow-[0_12px_32px_-12px_rgba(1,26,44,0.35)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
                    <SearchForm focusOnMount onDone={() => setOpen(false)} />
                </div>
            )}
        </div>
    );
}
