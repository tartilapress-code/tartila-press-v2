import type {
    AboutPage,
    AboutProfile,
    SocialPlatform,
} from '@/data/about/aboutApi';

/**
 * Kontak bawaan (sama dengan isi awal tabel about_profiles) — dipakai selama
 * data "Tentang Kami" belum termuat atau gagal dimuat.
 */
export const DEFAULT_ABOUT_PROFILE: AboutProfile = {
    vision: null,
    mission: null,
    profile: null,
    contact_email: 'tartilapress@gmail.com',
    phone: '+62 812-7034-8598',
    whatsapp: '6283180773955',
    address: 'Indonesia',
    map_query: null,
    social_links: {
        instagram: 'https://instagram.com',
        facebook: 'https://facebook.com',
        tiktok: 'https://tiktok.com',
        youtube: 'https://youtube.com',
    },
    show_team: true,
};

export const DEFAULT_ABOUT_PAGE: AboutPage = {
    profile: DEFAULT_ABOUT_PROFILE,
    legalities: [],
    team: [],
};

/** Nama tampilan + ikon Remix Icon tiap sosial media. */
export const SOCIAL_META: Record<
    SocialPlatform,
    { label: string; icon: string }
> = {
    instagram: { label: 'Instagram', icon: 'ri-instagram-line' },
    facebook: { label: 'Facebook', icon: 'ri-facebook-box-fill' },
    tiktok: { label: 'TikTok', icon: 'ri-tiktok-fill' },
    youtube: { label: 'YouTube', icon: 'ri-youtube-line' },
    x: { label: 'X (Twitter)', icon: 'ri-twitter-x-line' },
    linkedin: { label: 'LinkedIn', icon: 'ri-linkedin-box-fill' },
    website: { label: 'Website', icon: 'ri-global-line' },
};

export const SOCIAL_PLATFORMS = Object.keys(SOCIAL_META) as SocialPlatform[];

export function whatsappUrl(number: string | null | undefined): string {
    const digits = (number ?? '').replace(/\D/g, '');

    return `https://wa.me/${digits || DEFAULT_ABOUT_PROFILE.whatsapp}`;
}

export type ContactItem = {
    key: 'email' | 'phone' | 'whatsapp' | 'address';
    icon: string;
    label: string;
    // Null = teks saja (alamat).
    href: string | null;
};

/** Kontak yang terisi, siap ditampilkan (footer & halaman Tentang Kami). */
export function contactItems(profile: AboutProfile): ContactItem[] {
    const items: ContactItem[] = [];

    if (profile.contact_email) {
        items.push({
            key: 'email',
            icon: 'ri-mail-line',
            label: profile.contact_email,
            href: `mailto:${profile.contact_email}`,
        });
    }

    if (profile.phone) {
        items.push({
            key: 'phone',
            icon: 'ri-phone-fill',
            label: profile.phone,
            href: `tel:${profile.phone.replace(/[^\d+]/g, '')}`,
        });
    }

    if (profile.whatsapp) {
        items.push({
            key: 'whatsapp',
            icon: 'ri-whatsapp-line',
            label: 'WhatsApp',
            href: whatsappUrl(profile.whatsapp),
        });
    }

    if (profile.address) {
        items.push({
            key: 'address',
            icon: 'ri-map-pin-line',
            label: profile.address,
            href: null,
        });
    }

    return items;
}

/** Sosial media yang terisi, dalam urutan tetap. */
export function socialItems(
    profile: AboutProfile
): { platform: SocialPlatform; url: string }[] {
    return SOCIAL_PLATFORMS.filter((platform) =>
        Boolean(profile.social_links[platform])
    ).map((platform) => ({
        platform,
        url: profile.social_links[platform] as string,
    }));
}

/** Peta Google Maps tanpa kunci API (kata kunci peta, atau alamat). */
export function mapEmbedUrl(profile: AboutProfile): string | null {
    const query = (profile.map_query || profile.address || '').trim();

    return query
        ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
        : null;
}

export function mapLinkUrl(profile: AboutProfile): string | null {
    const query = (profile.map_query || profile.address || '').trim();

    return query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : null;
}

/** Misi satu per baris → daftar (baris kosong dan penanda "-", "1." dibuang). */
export function missionItems(mission: string | null): string[] {
    return (mission ?? '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
}
