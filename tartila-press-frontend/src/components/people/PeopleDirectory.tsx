import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';

type Person = {
    slug: string;
    name: string;
    bio: string | null;
    profile_photo: string | null;
};

export default function PeopleDirectory({
    role,
    limit,
}: {
    role: 'penulis' | 'editor';
    limit?: number;
}) {
    const [people, setPeople] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        publicProfileApi
            .listByRole(role)
            .then((response) => setPeople(response.data))
            .catch(() => setPeople([]))
            .finally(() => setIsLoading(false));
    }, [role]);

    if (isLoading) {
        return <p className="text-oxford-navy-900 text-center">Memuat...</p>;
    }

    if (people.length === 0) {
        return (
            <p className="text-oxford-navy-900/70 text-center">
                Belum ada {role === 'penulis' ? 'penulis' : 'editor'} yang
                ditampilkan.
            </p>
        );
    }

    const shown = limit ? people.slice(0, limit) : people;

    return (
        <div
            className="
            grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6
            "
        >
            {shown.map((person) => (
                <Link
                    key={person.slug}
                    to={`/${role}/${person.slug}`}
                    className="
                    flex flex-col items-center gap-3 text-center
                    bg-oxford-navy-900 rounded-xl p-6
                    hover:-translate-y-1 duration-200
                    "
                >
                    {person.profile_photo ? (
                        <img
                            src={person.profile_photo}
                            alt={person.name}
                            className="w-24 h-24 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-oxford-navy-700 flex items-center justify-center text-white text-2xl font-semibold">
                            {person.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <h5 className="text-white font-semibold">
                        {person.name}
                    </h5>
                    {person.bio && (
                        <p className="text-white/70 text-sm line-clamp-3">
                            {person.bio}
                        </p>
                    )}
                </Link>
            ))}
        </div>
    );
}
