import { Fragment, useState, type ReactNode } from 'react';
import { rupiah } from './format';

export type Column<T> = {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
    // Kolom uang: dijumlahkan di baris total.
    sum?: (row: T) => number;
    align?: 'left' | 'right';
};

/** Tabel rincian estimasi laba + baris total + formulir ubah per baris. */
export default function BreakdownTable<T>({
    rows,
    columns,
    rowKey,
    editor,
    emptyText,
    caption,
}: {
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string | number;
    editor?: (row: T, close: () => void) => ReactNode;
    emptyText: string;
    caption: string;
}) {
    const [open, setOpen] = useState<string | number | null>(null);
    const span = columns.length + (editor ? 1 : 0);

    return (
        <div className="overflow-x-auto rounded-xl ring-1 ring-forest-moss-100">
            <table className="w-full min-w-[960px] text-sm">
                <caption className="sr-only">{caption}</caption>
                <thead className="bg-forest-moss-50 text-xs uppercase tracking-wide text-oxford-navy-900/70">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                scope="col"
                                className={`p-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                            >
                                {column.label}
                            </th>
                        ))}
                        {editor && <th className="p-3" />}
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={span}
                                className="p-6 text-center text-oxford-navy-900/60"
                            >
                                {emptyText}
                            </td>
                        </tr>
                    )}
                    {rows.map((row) => {
                        const key = rowKey(row);

                        return (
                            <Fragment key={key}>
                                <tr className="border-t border-forest-moss-100 align-top">
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={`p-3 ${column.align === 'right' ? 'whitespace-nowrap text-right' : ''}`}
                                        >
                                            {column.render(row)}
                                        </td>
                                    ))}
                                    {editor && (
                                        <td className="whitespace-nowrap p-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOpen(
                                                        open === key
                                                            ? null
                                                            : key
                                                    )
                                                }
                                                aria-expanded={open === key}
                                                className="text-xs font-semibold text-forest-moss-700 hover:underline"
                                            >
                                                {open === key
                                                    ? 'Tutup'
                                                    : 'Ubah'}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                                {editor && open === key && (
                                    <tr className="bg-forest-moss-50/60">
                                        <td colSpan={span} className="p-3">
                                            {editor(row, () => setOpen(null))}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
                {rows.length > 0 && (
                    <tfoot className="border-t-2 border-forest-moss-200 bg-forest-moss-50 font-semibold">
                        <tr>
                            {columns.map((column, index) => (
                                <td
                                    key={column.key}
                                    className={`p-3 ${column.align === 'right' ? 'whitespace-nowrap text-right' : ''}`}
                                >
                                    {column.sum
                                        ? rupiah(
                                              rows.reduce(
                                                  (total, row) =>
                                                      total + column.sum!(row),
                                                  0
                                              )
                                          )
                                        : index === 0
                                          ? 'Total'
                                          : ''}
                                </td>
                            ))}
                            {editor && <td />}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}
