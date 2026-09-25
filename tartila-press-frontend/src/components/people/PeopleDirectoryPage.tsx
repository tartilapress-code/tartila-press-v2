import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { PeopleRole } from '@/components/people/roles';
import { SearchField, SelectField } from '@/components/ui/FilterControls';
import ListHero from '@/components/ui/ListHero';
import QuoteCard from '@/components/ui/QuoteCard';
import SectionTitle from '@/components/ui/SectionTitle';
import SideNavCard, { type SideNavItem } from '@/components/ui/SideNavCard';

type SortMode = 'default' | 'az' | 'za';

const SKELETON_COUNT = 6;

/**
 * Halaman daftar Penulis/Editor: hero, navigasi samping, dan kartu berisi
 * pencarian nama, pilihan urutan, serta grid orang.
 */
export default function PeopleDirectoryPage({ role }: { role: PeopleRole }) {
    const { t } = useTranslation();

    const sortOptions = [
        { value: 'default', label: t('people.sort.default') },
        { value: 'az', label: t('people.sort.az') },
        { value: 'za', label: t('people.sort.za') },
    ];

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
            label: t('people.penulis.navList'),
            icon: <RiTeamLine />,
            to: '/penulis',
            active: role === 'penulis',
        },
        {
            key: 'editor',
            label: t('people.editor.navList'),
            icon: <RiEditBoxLine />,
            to: '/editor',
            active: role === 'editor',
        },
        {
            key: 'cari',
            label: t('people.search'),
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
                badge={t(`people.${role}.label`)}
                title={{
                    before: t(`people.${role}.heroTitleBefore`),
                    accent: t(`people.${role}.heroTitleAccent`),
                }}
                text={t(`people.${role}.heroText`)}
                script={[
                    t(`people.${role}.scriptTop`),
                    t(`people.${role}.scriptBottom`),
                ]}
            />

            <div className="mx-auto max-w-[1360px] px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-10">
                <aside className="mb-6 lg:mb-0">
                    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                        <SideNavCard
                            items={navItems}
                            ariaLabel={t('people.listNavAria')}
                        />
                        <QuoteCard quote={t(`people.${role}.listQuote`)} />
                    </div>
                </aside>

                <section
                    aria-labelledby="people-directory-title"
                    className="flex flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <SectionTitle id="people-directory-title">
                            {t(`people.${role}.directoryTitle`)}
                            {!isLoading && people.length > 0 && (
                                <span className="font-sans text-sm font-normal text-oxford-navy-900/50">
                                    {t(`people.${role}.count`, {
                                        count: visible.length,
                                    })}
                                </span>
                            )}
                        </SectionTitle>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <SearchField
                                inputRef={searchRef}
                                value={query}
                                onChange={setQuery}
                                placeholder={t(
                                    `people.${role}.searchPlaceholder`
                                )}
                                ariaLabel={t(`people.${role}.searchAria`)}
                                className="sm:w-72"
                            />
                            <SelectField
                                value={sort}
                                onChange={(value) => setSort(value as SortMode)}
                                options={sortOptions}
                                ariaLabel={t('people.sort.aria')}
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
                            {t(`people.${role}.emptyText`)}
                        </p>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-forest-moss-50 px-6 py-14 text-center">
                            <p className="text-sm text-oxford-navy-900/70">
                                {t(`people.${role}.noMatch`, {
                                    query: query.trim(),
                                })}
                            </p>
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="inline-flex items-center gap-2 rounded-lg border border-oxford-navy-700 px-4 py-2 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-oxford-navy-700 hover:text-white"
                            >
                                <RiRestartLine aria-hidden className="size-4" />
                                {t('people.clearSearch')}
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
