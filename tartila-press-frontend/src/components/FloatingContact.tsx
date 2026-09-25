import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RiInstagramLine, RiMailLine, RiWhatsappLine } from '@remixicon/react';
import socialMedia from '@/data/footer-social-media.json';
import contacts from '@/data/footer-kontak.json';

// Nomor yang sama dengan tombol "Konsultasi" di hero beranda.
const WHATSAPP_URL = 'https://wa.me/6283180773955';

const instagramUrl =
    socialMedia.find((item) => item.name === 'Instagram')?.link ??
    'https://instagram.com';
const email =
    contacts.find((item) => item.label.includes('@'))?.label ??
    'tartilapress@gmail.com';

function ContactButton({
    href,
    label,
    tone,
    className = '',
    children,
}: {
    href: string;
    label: string;
    tone: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <a
            href={href}
            target={href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer"
            aria-label={label}
            title={label}
            className={`flex size-11 items-center justify-center rounded-full text-white shadow-lg transition duration-200 hover:scale-110 sm:size-12 ${tone} ${className}`}
        >
            {children}
        </a>
    );
}

/**
 * Tombol kontak melayang di sisi kanan: WhatsApp, Instagram, dan email.
 * Di layar sempit hanya WhatsApp supaya tidak menutupi kartu.
 */
export default function FloatingContact() {
    const { t } = useTranslation();

    return (
        <div className="fixed bottom-5 right-4 z-40 flex flex-col gap-3 sm:right-6">
            <ContactButton
                href={WHATSAPP_URL}
                label={t('footer.floating.whatsapp')}
                tone="bg-forest-moss-600 hover:bg-forest-moss-500"
            >
                <RiWhatsappLine className="size-6" aria-hidden />
            </ContactButton>
            <ContactButton
                href={instagramUrl}
                label={t('footer.floating.instagram')}
                tone="bg-oxford-navy-700 hover:bg-oxford-navy-600"
                className="max-lg:hidden"
            >
                <RiInstagramLine className="size-6" aria-hidden />
            </ContactButton>
            <ContactButton
                href={`mailto:${email}`}
                label={t('footer.floating.email')}
                tone="bg-oxford-navy-700 hover:bg-oxford-navy-600"
                className="max-lg:hidden"
            >
                <RiMailLine className="size-6" aria-hidden />
            </ContactButton>
        </div>
    );
}
