import type { PageMeta } from '@/lib/pagination';

// Nomor halaman yang ditampilkan: pertama, terakhir, dan sekitar halaman aktif.
function pageItems(current: number, last: number): (number | 'gap')[] {
    const pages = new Set([1, last, current - 1, current, current + 1]);
    const sorted = [...pages]
        .filter((page) => page >= 1 && page <= last)
        .sort((a, b) => a - b);

    return sorted.flatMap((page, index) =>
        index > 0 && page - sorted[index - 1] > 1
            ? (['gap', page] as const)
            : [page]
    );
}

const button =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/** Navigasi halaman di bawah daftar; tidak tampil bila hanya satu halaman. */
export default function Pagination({
    meta,
    onPageChange,
    className = '',
}: {
    meta: PageMeta | null;
    onPageChange: (page: number) => void;
    className?: string;
}) {
    if (!meta || meta.last_page <= 1) {
        return null;
    }

    const { current_page: current, last_page: last, per_page, total } = meta;
    const from = (current - 1) * per_page + 1;
    const to = Math.min(total, current * per_page);

    return (
        <nav
            aria-label="Navigasi halaman"
            className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}
        >
            <p className="text-sm text-oxford-navy-900/70">
                Menampilkan {from}–{to} dari {total}
            </p>

            <div className="flex flex-wrap items-center gap-1">
                <button
                    type="button"
                    onClick={() => onPageChange(current - 1)}
                    disabled={current <= 1}
                    aria-label="Halaman sebelumnya"
                    className={`${button} text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50`}
                >
                    <i aria-hidden className="ri-arrow-left-s-line text-xl" />
                </button>

                {pageItems(current, last).map((item, index) =>
                    item === 'gap' ? (
                        <span
                            key={`gap-${index}`}
                            aria-hidden
                            className="px-1 text-oxford-navy-900/50"
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={item}
                            type="button"
                            onClick={() => onPageChange(item)}
                            aria-label={`Halaman ${item}`}
                            aria-current={item === current ? 'page' : undefined}
                            className={`${button} ${
                                item === current
                                    ? 'bg-oxford-navy-700 text-white'
                                    : 'text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50'
                            }`}
                        >
                            {item}
                        </button>
                    )
                )}

                <button
                    type="button"
                    onClick={() => onPageChange(current + 1)}
                    disabled={current >= last}
                    aria-label="Halaman berikutnya"
                    className={`${button} text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50`}
                >
                    <i aria-hidden className="ri-arrow-right-s-line text-xl" />
                </button>
            </div>
        </nav>
    );
}
