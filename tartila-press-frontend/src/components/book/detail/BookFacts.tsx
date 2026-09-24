import type { ReactNode } from 'react';

export type BookFact = { label: string; value: ReactNode };

/** Lembar rincian buku (ISBN, penerbit, kategori, dsb.) dalam dua kolom. */
export default function BookFacts({ facts }: { facts: BookFact[] }) {
    return (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {facts.map((fact) => (
                <div
                    key={fact.label}
                    className="min-w-0 border-b border-forest-moss-100 pb-3"
                >
                    <dt className="text-xs font-medium uppercase tracking-wide text-oxford-navy-900/50">
                        {fact.label}
                    </dt>
                    <dd className="mt-1 break-words text-[15px] font-medium text-oxford-navy-700">
                        {fact.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
