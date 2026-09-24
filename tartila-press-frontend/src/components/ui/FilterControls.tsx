import type { ReactNode, Ref } from 'react';
import { RiArrowDownSLine, RiSearchLine } from '@remixicon/react';

export type SelectOption = { value: string; label: string };

const fieldShell =
    'relative block rounded-xl border border-oxford-navy-900/10 transition focus-within:border-forest-moss-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-forest-moss-500/30';

/** Kolom pencarian dengan ikon kaca pembesar (tema hijau lembut). */
export function SearchField({
    value,
    onChange,
    placeholder,
    ariaLabel,
    inputRef,
    className = '',
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel: string;
    inputRef?: Ref<HTMLInputElement>;
    className?: string;
}) {
    return (
        <label className={`${fieldShell} bg-forest-moss-50/60 ${className}`}>
            <RiSearchLine
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-oxford-navy-700"
            />
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel}
                className="h-11 w-full bg-transparent pl-11 pr-3 text-sm text-oxford-navy-900 outline-none placeholder:text-oxford-navy-900/45"
            />
        </label>
    );
}

/** Pilihan (<select> asli) dengan ikon di kiri dan panah di kanan. */
export function SelectField({
    value,
    onChange,
    options,
    ariaLabel,
    icon,
    className = '',
}: {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    ariaLabel: string;
    icon: ReactNode;
    className?: string;
}) {
    return (
        <label className={`${fieldShell} bg-white ${className}`}>
            <span
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-oxford-navy-700 [&>svg]:size-5"
            >
                {icon}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={ariaLabel}
                className="h-11 w-full cursor-pointer appearance-none truncate bg-transparent pl-11 pr-9 text-sm font-medium text-oxford-navy-900 outline-none"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <RiArrowDownSLine
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-oxford-navy-900/60"
            />
        </label>
    );
}
