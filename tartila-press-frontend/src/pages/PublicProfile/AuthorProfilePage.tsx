import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';

type Experience = {
    id: number;
    title: string;
    description: string | null;
    year: number | null;
};

type AuthorProfile = {
    slug: string;
    name: string;
    bio: string | null;
    profile_photo: string | null;
    roles: string[];
    experiences: Experience[];
};

export default function AuthorProfilePage() {
    const { slug } = useParams<{ slug: string }>();

    const [profile, setProfile] = useState<AuthorProfile | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        Promise.resolve()
            .then(() => {
                if (!slug) {
                    throw new ApiError('Slug tidak ditemukan.', 404);
                }
                return publicProfileApi.getBySlug(slug);
            })
            .then((response) => setProfile(response.data.profile))
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }, [slug]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <p className="text-oxford-navy-900">Memuat...</p>
            </div>
        );
    }

    if (notFound || !profile) {
        return <ErrorPage />;
    }

    return (
        <div className="flex flex-col gap-6 my-10 max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-8 text-center">
                {profile.profile_photo && (
                    <img
                        src={profile.profile_photo}
                        alt={profile.name}
                        className="w-32 h-32 rounded-full object-cover"
                    />
                )}
                <h1 className="text-white text-3xl font-bold">
                    {profile.name}
                </h1>
                {profile.roles.length > 0 && (
                    <div className="flex flex-row gap-2">
                        {profile.roles.map((role) => (
                            <span
                                key={role}
                                className="bg-forest-moss-500 text-white text-xs px-3 py-1 rounded-full"
                            >
                                {role}
                            </span>
                        ))}
                    </div>
                )}
                {profile.bio && (
                    <p className="text-white/80 max-w-xl">{profile.bio}</p>
                )}
            </div>

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-white text-xl font-semibold">
                    Jejak Pengalaman
                </h2>
                {profile.experiences.length === 0 ? (
                    <p className="text-white/70 text-sm">
                        Belum ada jejak pengalaman.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {profile.experiences.map((experience) => (
                            <div
                                key={experience.id}
                                className="bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <p className="text-white font-semibold">
                                    {experience.title}{' '}
                                    {experience.year && (
                                        <span className="text-white/60 font-normal">
                                            ({experience.year})
                                        </span>
                                    )}
                                </p>
                                {experience.description && (
                                    <p className="text-white/70 text-sm">
                                        {experience.description}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-white text-xl font-semibold">Buku</h2>
                <p className="text-white/70 text-sm">Belum ada buku.</p>
            </div>
        </div>
    );
}
