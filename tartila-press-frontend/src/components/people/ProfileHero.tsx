import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RiBookOpenLine,
    RiEditBoxLine,
    RiMapPinLine,
    RiTranslate2,
    RiUserLine,
} from '@remixicon/react';
import {
    BookStackLine,
    HeroHill,
    HeroLeafRight,
} from '@/components/art/HeroArt';
import { useContentLanguages } from '@/components/language/useContentLanguages';
import PersonAvatar from '@/components/people/PersonAvatar';
import PillBadge from '@/components/ui/PillBadge';
import {
    ROLE_NAME,
    displayRoles,
    type PeopleRole,
} from '@/components/people/roles';
import type { ContentLanguage } from '@/lib/contentLanguages';

export type ProfileHeroData = {
    name: string;
    photo: string | null;
    roles: string[];
    city: string | null;
    bookCount: number;
    editedCount: number;
    // Bahasa yang dikuasai (hanya terisi untuk editor).
    languages: ContentLanguage[];
};

type MetaItem = { key: string; icon: ReactNode; text: string };

/**
 * Hero profil: foto bulat berbingkai hijau, lencana peran, nama serif, dan
 * baris info (peran, kota, jumlah buku). Ilustrasi hanya di layar lebar.
 */
export default function ProfileHero({
    profile,
    role,
}: {
    profile: ProfileHeroData;
    role: PeopleRole;
}) {
    const { t } = useTranslation();
    const { masteredLine } = useContentLanguages();
    const roles = displayRoles(profile.roles);
    const labels = (roles.length > 0 ? roles : [ROLE_NAME[role]]).map((name) =>
        t(`people.roleLabels.${name}`)
    );

    const meta: MetaItem[] = [
        { key: 'role', icon: <RiUserLine />, text: labels.join(' · ') },
    ];

    if (profile.city) {
        meta.push({ key: 'city', icon: <RiMapPinLine />, text: profile.city });
    }

    if (profile.languages.length > 0) {
        meta.push({
            key: 'languages',
            icon: <RiTranslate2 />,
            text: masteredLine(profile.languages),
        });
    }

    if (profile.bookCount > 0) {
        meta.push({
            key: 'books',
            icon: <RiBookOpenLine />,
            text: t('people.profile.metaWorks', { count: profile.bookCount }),
        });
    }

    if (profile.editedCount > 0) {
        meta.push({
            key: 'edited',
            icon: <RiEditBoxLine />,
            text: t('people.profile.metaEdited', {
                count: profile.editedCount,
            }),
        });
    }

    return (
        <section className="relative isolate overflow-hidden bg-white">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[20%] sm:block" />

            <div className="relative mx-auto flex max-w-[1232px] flex-col items-center gap-6 px-6 py-8 text-center sm:flex-row sm:gap-8 sm:px-10 sm:py-10 sm:text-left lg:min-h-[250px] lg:pl-20 lg:pr-[26%]">
                <div className="shrink-0 rounded-full bg-white p-1.5 shadow-sm ring-2 ring-forest-moss-400">
                    <PersonAvatar
                        name={profile.name}
                        photo={profile.photo}
                        eager
                        className="size-32 sm:size-40 lg:size-44"
                    />
                </div>

                <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                        {labels.map((label) => (
                            <PillBadge key={label} label={label} withIcon />
                        ))}
                    </div>

                    <h1 className="font-display break-words text-4xl font-bold leading-tight text-oxford-navy-700 sm:text-5xl">
                        {profile.name}
                    </h1>

                    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-oxford-navy-900/70 sm:justify-start xl:gap-x-0 xl:divide-x xl:divide-oxford-navy-900/15">
                        {meta.map((item) => (
                            <li
                                key={item.key}
                                className="inline-flex items-center gap-2 xl:px-4 xl:first:pl-0"
                            >
                                <span
                                    aria-hidden
                                    className="text-oxford-navy-700 [&>svg]:size-[18px]"
                                >
                                    {item.icon}
                                </span>
                                {item.text}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <BookStackLine className="pointer-events-none absolute bottom-0 right-[7%] hidden h-[215px] w-auto lg:block" />
        </section>
    );
}
