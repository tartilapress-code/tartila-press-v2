import { Link } from 'react-router-dom';
import { RiArrowRightLine } from '@remixicon/react';
import PersonAvatar from '@/components/people/PersonAvatar';
import PillBadge from '@/components/ui/PillBadge';
import {
    displayRoles,
    roleCopy,
    type PeopleRole,
} from '@/components/people/roleCopy';

export type Person = {
    slug: string;
    name: string;
    bio: string | null;
    profile_photo: string | null;
    roles: string[];
};

/**
 * Kartu satu orang di daftar: foto, nama, peran, cuplikan bio, dan tombol
 * "Lihat Profil". Seluruh kartu bisa diklik lewat tautan pada tombol.
 */
export default function PersonCard({
    person,
    role,
}: {
    person: Person;
    role: PeopleRole;
}) {
    // Tanpa peran yang dikenali, pakai peran halaman daftar ini.
    const roles = displayRoles(person.roles);
    const labels = roles.length > 0 ? roles : [roleCopy[role].label];

    return (
        <article className="group relative flex min-w-0 gap-4 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_rgba(1,26,44,0.32)] sm:p-5">
            <PersonAvatar
                name={person.name}
                photo={person.profile_photo}
                className="size-20 shrink-0 sm:size-24"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h3 className="font-display truncate text-lg font-semibold text-oxford-navy-700">
                    {person.name}
                </h3>

                <div className="flex flex-wrap gap-1.5">
                    {labels.map((label) => (
                        <PillBadge key={label} label={label} />
                    ))}
                </div>

                <p
                    className={`line-clamp-2 min-h-[2.85rem] text-sm leading-relaxed ${
                        person.bio
                            ? 'text-oxford-navy-900/65'
                            : 'italic text-oxford-navy-900/40'
                    }`}
                >
                    {person.bio || 'Profil ini belum dilengkapi.'}
                </p>

                <Link
                    to={`/${role}/${person.slug}`}
                    className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-forest-moss-600 px-4 py-1.5 text-sm font-medium text-forest-moss-700 transition-colors after:absolute after:inset-0 after:rounded-2xl group-hover:bg-forest-moss-600 group-hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-moss-600"
                >
                    Lihat Profil
                    <RiArrowRightLine aria-hidden className="size-4" />
                </Link>
            </div>
        </article>
    );
}

// Kerangka kartu saat data dimuat.
export function PersonCardSkeleton() {
    return (
        <div
            aria-hidden
            className="flex animate-pulse gap-4 rounded-2xl border border-forest-moss-100 bg-white p-4 sm:p-5"
        >
            <div className="size-20 shrink-0 rounded-full bg-oxford-navy-100/60 sm:size-24" />
            <div className="flex flex-1 flex-col gap-2.5">
                <div className="h-5 w-2/3 rounded bg-oxford-navy-100/60" />
                <div className="h-5 w-16 rounded-full bg-oxford-navy-100/60" />
                <div className="h-3.5 w-full rounded bg-oxford-navy-100/60" />
                <div className="h-3.5 w-4/5 rounded bg-oxford-navy-100/60" />
                <div className="h-8 w-28 rounded-full bg-oxford-navy-100/60" />
            </div>
        </div>
    );
}
