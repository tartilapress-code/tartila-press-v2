import { RiDoubleQuotesL, RiLeafLine } from '@remixicon/react';

/** Kartu kutipan hijau lembut di sidebar; disembunyikan di layar sempit. */
export default function QuoteCard({ quote }: { quote: string }) {
    return (
        <figure className="relative hidden rounded-2xl bg-forest-moss-100/70 p-5 lg:block">
            <RiDoubleQuotesL
                aria-hidden
                className="size-8 text-forest-moss-500"
            />
            <blockquote className="mt-1 text-sm italic leading-relaxed text-oxford-navy-900/70">
                {quote}
            </blockquote>
            <RiLeafLine
                aria-hidden
                className="ml-auto mt-3 size-7 text-forest-moss-500"
            />
        </figure>
    );
}
