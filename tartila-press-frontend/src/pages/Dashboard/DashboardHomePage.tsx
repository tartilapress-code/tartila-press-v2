import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    RiArrowDownSLine,
    RiArrowRightSLine,
    RiEdit2Line,
    RiErrorWarningLine,
    RiNotification3Line,
    RiQuillPenLine,
    RiShieldUserLine,
    RiUserLine,
    RiWallet3Line,
} from '@remixicon/react';
import * as dashboardApi from '@/data/dashboard/dashboardApi';
import type {
    DashboardSummary,
    SummaryItem,
    SummarySection,
} from '@/data/dashboard/dashboardApi';
import { timeAgo } from '@/components/notification/timeAgo';
import { describeApiError } from '@/lib/apiErrors';

const sectionIcons: Record<SummarySection['key'], ReactNode> = {
    account: <RiUserLine size={18} aria-hidden />,
    writer: <RiQuillPenLine size={18} aria-hidden />,
    editor: <RiEdit2Line size={18} aria-hidden />,
    wallet: <RiWallet3Line size={18} aria-hidden />,
    admin: <RiShieldUserLine size={18} aria-hidden />,
};

const numberFormatter = new Intl.NumberFormat('id-ID');
const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

function formatValue(item: SummaryItem): string {
    if (item.value === null) return '!';

    return item.format === 'currency'
        ? rupiahFormatter.format(item.value)
        : numberFormatter.format(item.value);
}

// Hal yang menunggu tindakan: ditandai server dan memang ada isinya.
function needsAction(item: SummaryItem): boolean {
    return item.attention && (item.value === null || item.value > 0);
}

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

function ActionList({ items }: { items: SummaryItem[] }) {
    return (
        <div className="flex flex-col gap-2">
            <h6 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <RiErrorWarningLine size={16} aria-hidden />
                Perlu tindakan Anda
            </h6>
            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li key={item.key}>
                        <Link
                            to={item.link}
                            className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
                        >
                            <span className="text-oxford-navy-900">
                                <strong>
                                    {item.value === null
                                        ? item.label
                                        : `${formatValue(item)} ${item.label.toLowerCase()}`}
                                </strong>
                                {item.hint && (
                                    <span className="text-oxford-navy-900/70">
                                        {' '}
                                        — {item.hint}
                                    </span>
                                )}
                            </span>
                            <RiArrowRightSLine
                                size={18}
                                aria-hidden
                                className="shrink-0 text-amber-800"
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// nested: di dalam kartu "Menu Lainnya" (tanpa bingkai kartu sendiri).
function SummarySectionCard({
    section,
    nested = false,
}: {
    section: SummarySection;
    nested?: boolean;
}) {
    return (
        <section
            className={nested ? 'flex flex-col gap-4' : cardClass}
            aria-labelledby={`ringkasan-${section.key}`}
        >
            <h6
                id={`ringkasan-${section.key}`}
                className="flex items-center gap-2 font-display text-lg font-bold text-oxford-navy-700"
            >
                {sectionIcons[section.key]}
                {section.title}
            </h6>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {section.items.map((item) => (
                    <li key={item.key}>
                        <Link
                            to={item.link}
                            className={`flex h-full flex-col gap-1 rounded-xl p-4 ring-1 transition-colors ${
                                needsAction(item)
                                    ? 'bg-amber-50 ring-amber-200 hover:bg-amber-100'
                                    : 'bg-forest-moss-50/60 ring-forest-moss-100 hover:bg-forest-moss-100/70'
                            }`}
                        >
                            <span
                                className={`font-display text-2xl font-bold ${
                                    needsAction(item)
                                        ? 'text-amber-800'
                                        : 'text-oxford-navy-800'
                                } ${item.format === 'currency' ? 'text-lg' : ''}`}
                            >
                                {formatValue(item)}
                            </span>
                            <span className="text-sm text-oxford-navy-900/80">
                                {item.label}
                            </span>
                            {item.hint && item.value !== 0 && (
                                <span className="text-xs text-oxford-navy-900/65">
                                    {item.hint}
                                </span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Kartu terlipat (panel lain, Profil, Menu Lainnya) — terbuka saat diklik. */
function FoldedSectionCard({
    id,
    title,
    sections,
}: {
    id: string;
    title: string;
    sections: SummarySection[];
}) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const actions = sections.flatMap((section) =>
        section.items.filter(needsAction)
    );

    return (
        <section className={cardClass}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={id}
                className="flex w-full items-center justify-between gap-3 text-left hover:cursor-pointer"
            >
                <span className="flex items-center gap-2 font-display text-lg font-bold text-oxford-navy-700">
                    {sectionIcons[sections[0].key]}
                    {title}
                    {!isOpen && actions.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-sans text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            {actions.length} perlu tindakan
                        </span>
                    )}
                </span>
                <RiArrowDownSLine
                    size={22}
                    aria-hidden
                    className={`shrink-0 text-oxford-navy-700 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
            </button>

            {isOpen && (
                <div id={id} className="flex flex-col gap-6">
                    {actions.length > 0 && <ActionList items={actions} />}
                    {sections.map((section) => (
                        <SummarySectionCard
                            key={section.key}
                            section={section}
                            nested
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

/**
 * Ringkasan dashboard: hal yang perlu ditindaklanjuti, angka penting tiap
 * fitur (per peran: akun, penulis, editor, dompet, admin) dan update terbaru.
 * Urutan: Admin, Editor, Penulis (+ Dompet), Profil, Menu Lainnya — panel
 * peran tertinggi terbuka, sisanya terlipat (sama dengan menu samping).
 */
export default function DashboardHomePage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        dashboardApi
            .summary()
            .then((response) => setSummary(response.data))
            .catch((failure) =>
                setError(
                    describeApiError(failure, 'Ringkasan tidak bisa dimuat.')
                )
            );
    }, []);

    if (error) {
        return (
            <div className={cardClass}>
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className={cardClass}>
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            </div>
        );
    }

    // Urutan sama dengan menu samping: Admin, Editor, Penulis, Profil, Menu
    // Lainnya. Panel peran tertinggi terbuka; panel lain terlipat.
    const has = (role: string) => summary.roles.includes(role);
    const byKey = new Map(
        summary.sections.map((section) => [section.key, section])
    );
    const pick = (...keys: SummarySection['key'][]) =>
        keys
            .map((key) => byKey.get(key))
            .filter((section): section is SummarySection => Boolean(section));

    const isEditor = has('editor');
    const panels: { key: string; title: string; sections: SummarySection[] }[] =
        [
            {
                key: 'admin',
                title: 'Panel Admin',
                sections: has('admin') ? pick('admin') : [],
            },
            {
                key: 'editor',
                title: 'Panel Editor',
                // Dompet ikut panel editor bila editor, kalau tidak ikut penulis.
                sections: isEditor ? pick('editor', 'wallet') : [],
            },
            {
                key: 'writer',
                title: 'Panel Penulis',
                sections: isEditor ? pick('writer') : pick('writer', 'wallet'),
            },
        ].filter((panel) => panel.sections.length > 0);

    const focused = has('admin') || isEditor || has('penulis');
    const [primary, ...secondary] = focused ? panels : [];
    const mainSections = focused
        ? (primary?.sections ?? [])
        : panels.flatMap((panel) => panel.sections);

    // Bagian akun dipecah: Profil (data pribadi) dan Menu Lainnya (pesanan,
    // event, sertifikat).
    const account = byKey.get('account');
    const profileSection: SummarySection | null = account
        ? {
              ...account,
              title: 'Profil',
              items: account.items.filter(
                  (item) => item.key === 'personal_data'
              ),
          }
        : null;
    const otherSection: SummarySection | null = account
        ? {
              ...account,
              title: 'Pesanan, Event & Sertifikat',
              items: account.items.filter(
                  (item) => item.key !== 'personal_data'
              ),
          }
        : null;

    const actions = (focused ? mainSections : summary.sections).flatMap(
        (section) => section.items.filter(needsAction)
    );

    return (
        <div className="flex flex-col gap-6">
            <div className={cardClass}>
                <div className="flex flex-col gap-1">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Halo, {summary.name}
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        {primary
                            ? `Ringkasan ${primary.title.toLowerCase()}.`
                            : 'Ringkasan semua fitur akun Anda.'}
                    </p>
                </div>

                {actions.length > 0 ? (
                    <ActionList items={actions} />
                ) : (
                    <p className="rounded-lg bg-forest-moss-50 px-4 py-3 text-sm text-forest-moss-800 ring-1 ring-forest-moss-100">
                        Tidak ada yang menunggu tindakan Anda saat ini.
                    </p>
                )}
            </div>

            {mainSections.map((section) => (
                <SummarySectionCard key={section.key} section={section} />
            ))}

            {focused ? (
                <>
                    {secondary.map((panel) => (
                        <FoldedSectionCard
                            key={panel.key}
                            id={`ringkasan-${panel.key}-panel`}
                            title={panel.title}
                            sections={panel.sections}
                        />
                    ))}
                    {profileSection && profileSection.items.length > 0 && (
                        <FoldedSectionCard
                            id="ringkasan-profil"
                            title="Profil"
                            sections={[profileSection]}
                        />
                    )}
                    {otherSection && (
                        <FoldedSectionCard
                            id="ringkasan-lainnya"
                            title="Menu Lainnya"
                            sections={[otherSection]}
                        />
                    )}
                </>
            ) : (
                account && <SummarySectionCard section={account} />
            )}

            <section className={cardClass} aria-labelledby="ringkasan-update">
                <div className="flex flex-row items-center justify-between gap-3">
                    <h6
                        id="ringkasan-update"
                        className="flex items-center gap-2 font-display text-lg font-bold text-oxford-navy-700"
                    >
                        <RiNotification3Line size={18} aria-hidden />
                        Update Terbaru
                        {summary.unread_notifications > 0 && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                                {summary.unread_notifications} belum dibaca
                            </span>
                        )}
                    </h6>
                    <Link
                        to="/dashboard/notifikasi"
                        className="text-sm font-semibold text-forest-moss-700 hover:text-forest-moss-800"
                    >
                        Semua →
                    </Link>
                </div>
                {summary.updates.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada update.
                    </p>
                ) : (
                    <ul className="flex flex-col divide-y divide-forest-moss-100">
                        {summary.updates.map((update) => {
                            const content = (
                                <>
                                    <span className="flex items-center gap-2 text-sm font-semibold text-oxford-navy-900">
                                        {update.read_at === null && (
                                            <span
                                                className="size-2 shrink-0 rounded-full bg-red-600"
                                                aria-label="Belum dibaca"
                                            />
                                        )}
                                        {update.title}
                                    </span>
                                    {update.body && (
                                        <span className="line-clamp-2 text-sm text-oxford-navy-900/70">
                                            {update.body}
                                        </span>
                                    )}
                                    <span className="text-xs text-oxford-navy-900/60">
                                        {timeAgo(update.created_at)}
                                    </span>
                                </>
                            );

                            return (
                                <li key={update.id} className="py-2">
                                    {update.link ? (
                                        <Link
                                            to={update.link}
                                            className="flex flex-col gap-0.5 rounded-md hover:bg-forest-moss-50"
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <div className="flex flex-col gap-0.5">
                                            {content}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
