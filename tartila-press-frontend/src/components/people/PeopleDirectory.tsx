import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';
import PersonCard, {
    PersonCardSkeleton,
    type Person,
} from '@/components/people/PersonCard';

/** Beberapa penulis/editor di beranda, memakai kartu yang sama dengan halaman daftar. */
export default function PeopleDirectory({
    role,
    limit,
}: {
    role: 'penulis' | 'editor';
    limit?: number;
}) {
    const { t } = useTranslation();
    const [people, setPeople] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        publicProfileApi
            .listByRole(role, { per_page: limit ?? 12 })
            .then((response) => setPeople(response.data))
            .catch(() => setPeople([]))
            .finally(() => setIsLoading(false));
    }, [role, limit]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {Array.from({ length: limit ?? 4 }).map((_, index) => (
                    <PersonCardSkeleton key={index} />
                ))}
            </div>
        );
    }

    if (people.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                {t(`people.${role}.emptyText`)}
            </p>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {people.map((person) => (
                <PersonCard key={person.slug} person={person} role={role} />
            ))}
        </div>
    );
}
