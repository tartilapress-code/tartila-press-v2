import { Link } from 'react-router-dom';
import type { ProfileLinkable } from '@/data/book/bookApi';

/**
 * Nama penulis/editor. Menjadi tautan ke profil publiknya bila profil itu
 * sudah dipublikasikan; bila tidak, hanya teks.
 */
export default function PersonLink({
    person,
    role = 'penulis',
}: {
    person: ProfileLinkable;
    role?: 'penulis' | 'editor';
}) {
    const profile = person.public_profile;

    if (profile?.is_published) {
        return (
            <Link
                to={`/${role}/${profile.slug}`}
                className="font-medium text-forest-moss-700 hover:underline"
            >
                {profile.pen_name || person.name}
            </Link>
        );
    }

    return <span>{person.name}</span>;
}
