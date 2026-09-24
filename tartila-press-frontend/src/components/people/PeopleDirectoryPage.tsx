import { useEffect, useRef, useState } from 'react';
import {
    RiArrowUpDownLine,
    RiEditBoxLine,
    RiRestartLine,
    RiSearchLine,
    RiTeamLine,
} from '@remixicon/react';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';
import PersonCard, {
    PersonCardSkeleton,
    type Person,
} from '@/components/people/PersonCard';
import { roleCopy, type PeopleRole } from '@/components/people/roleCopy';
import { SearchField, SelectField } from '@/components/ui/FilterControls';
import ListHero from '@/components/ui/ListHero';
import QuoteCard from '@/components/ui/QuoteCard';
import SectionTitle from '@/components/ui/SectionTitle';
import SideNavCard, { type SideNavItem } from '@/components/ui/SideNavCard';

type SortMode = 'default' | 'az' | 'za';

const SKELETON_COUNT = 6;

const sortOptions = [
    { value: 'default', label: 'Urutkan' },
    { value: 'az', label: 'Nama A–Z' },
    { value: 'za', label: 'Nama Z–A' },
];

/**
 * Halaman daftar Penulis/Editor: hero, navigasi samping, dan kartu berisi
 * pencarian nama, pilihan urutan, serta grid orang.
 */
export default function PeopleDirectoryPage({ role }: { role: PeopleRole }) {
    const copy = roleCopy[role];

    const [people, setPeople] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [query, setQuery] = useState<string>('');
    const [sort, setSort] = useState<SortMode>('default');
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;

        publicProfileApi
            .listByRole(role)
            .then((response) => {
                if (!cancelled) setPeople(response.data);
            })
            .catch(() => {
                if (!cancelled) setPeople([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [role]);

    const needle = query.trim().toLocaleLowerCase('id');
    const matched = people.filter((person) =>
        person.name.toLocaleLowerCase('id').includes(needle)
    );
    const visible =
        sort === 'default'
            ? matched
            : [...matched].sort((a, b) =>
                  sort === 'az'
                      ? a.name.localeCompare(b.name, 'id')
                      : b.name.localeCompare(a.name, 'id')
              );

    const navItems: SideNavItem[] = [
        {
            key: 'penulis',
            label: 'List Penulis',
            icon: <RiTeamLine />,
            to: '/penulis',
            active: role === 'penulis',
        },
        {
            key: 'editor',
            label: 'List Editor',
            icon: <RiEditBoxLine />,
            to: '/editor',
            active: role === 'editor',
        },
        {
            key: 'cari',
            label: 'Pencarian',
            icon: <RiSearchLine />,
            onSelect: () => {
                searchRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
                searchRef.current?.focus({ preventScroll: true });
            },
        },
    ];

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge={copy.label}
                title={{ before: copy.heroTitle[0], accent: copy.heroTitle[1] }}
                text={copy.heroText}
                script={copy.script}
            />

            <div className="mx-auto max-w-[1360px] px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-10">
                <aside className="mb-6 lg:mb-0">
                    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                        <SideNavCard
                            items={navItems}
                            ariaLabel="Navigasi daftar"
                        />
                        <QuoteCard quote={copy.listQuote} />
                    </div>
                </aside>

                <section
                    aria-labelledby="people-directory-title"
                    className="flex flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <SectionTitle id="people-directory-title">
                            {copy.directoryTitle}
                            {!isLoading && people.length > 0 && (
                                <span className="font-sans text-sm font-normal text-oxford-navy-900/50">
                                    {visible.length} {role}
                                </span>
                            )}
                        </SectionTitle>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <SearchField
                                inputRef={searchRef}
                                value={query}
                                onChange={setQuery}
                                placeholder={copy.searchPlaceholder}
                                ariaLabel={copy.searchPlaceholder.replace(
                                    '...',
                                    ''
                                )}
                                className="sm:w-72"
                            />
                            <SelectField
                                value={sort}
                                onChange={(value) => setSort(value as SortMode)}
                                options={sortOptions}
                                ariaLabel="Urutkan daftar"
                                icon={<RiArrowUpDownLine />}
                                className="sm:w-44"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: SKELETON_COUNT }).map(
                                (_, index) => (
                                    <PersonCardSkeleton key={index} />
                                )
                            )}
                        </div>
                    ) : people.length === 0 ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            {copy.emptyText}
                        </p>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-forest-moss-50 px-6 py-14 text-center">
                            <p className="text-sm text-oxford-navy-900/70">
                                Tidak ada {role} dengan nama &ldquo;
                                {query.trim()}&rdquo;.
                            </p>
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="inline-flex items-center gap-2 rounded-lg border border-oxford-navy-700 px-4 py-2 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-oxford-navy-700 hover:text-white"
                            >
                                <RiRestartLine aria-hidden className="size-4" />
                                Hapus Pencarian
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {visible.map((person) => (
                                <PersonCard
                                    key={person.slug}
                                    person={person}
                                    role={role}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
