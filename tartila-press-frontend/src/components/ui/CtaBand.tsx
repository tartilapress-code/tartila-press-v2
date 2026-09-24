import { Link } from 'react-router-dom';
import { RiWhatsappLine } from '@remixicon/react';

// Nomor WhatsApp yang sama dengan tombol "Konsultasi" di beranda.
const WHATSAPP_URL = 'https://wa.me/6283180773955';

type CtaBandProps = {
    title: string;
    text: string;
    // Tombol utama: tautan ke halaman lain.
    action: { to: string; label: string };
};

/** Pita ajakan di ujung halaman: tombol utama dan tombol konsultasi WhatsApp. */
export default function CtaBand({ title, text, action }: CtaBandProps) {
    return (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-forest-moss-200 bg-forest-moss-100/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex flex-col gap-1">
                <h2 className="font-display text-xl font-bold text-oxford-navy-700">
                    {title}
                </h2>
                <p className="text-[15px] text-oxford-navy-900/70">{text}</p>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
                <Link
                    to={action.to}
                    className="inline-flex items-center justify-center rounded-lg bg-oxford-navy-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-oxford-navy-600"
                >
                    {action.label}
                </Link>
                <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-oxford-navy-200 bg-white px-6 py-3 text-sm font-semibold text-oxford-navy-700 transition-colors hover:border-oxford-navy-300 hover:bg-forest-moss-50"
                >
                    <RiWhatsappLine
                        aria-hidden
                        className="size-5 text-forest-moss-600"
                    />
                    Konsultasi
                </a>
            </div>
        </div>
    );
}
