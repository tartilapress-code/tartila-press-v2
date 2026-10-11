import { useTranslation } from 'react-i18next';
import {
    RiDoubleQuotesL,
    RiExternalLinkLine,
    RiUserLine,
} from '@remixicon/react';
import LegalityCarousel from '@/components/about/LegalityCarousel';
import CtaBand from '@/components/ui/CtaBand';
import ResponsiveImg from '@/components/ui/ResponsiveImg';
import ListHero from '@/components/ui/ListHero';
import SectionTitle from '@/components/ui/SectionTitle';
import { useAboutPage } from '@/hooks/useAboutPage';
import {
    SOCIAL_META,
    contactItems,
    mapEmbedUrl,
    mapLinkUrl,
    missionItems,
    socialItems,
} from '@/lib/siteContact';

const cardClass =
    'flex flex-col gap-5 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-7';

// Keahlian ditulis admin dipisah koma → lencana.
function expertiseTags(expertise: string | null): string[] {
    return (expertise ?? '')
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * Halaman "Tentang Kami": profil, visi & misi, legalitas, Tim Kami, kontak,
 * sosial media, serta alamat + peta. Isi diatur admin (Panel Admin →
 * Tentang Kami); bagian yang kosong tidak ditampilkan.
 */
export default function AboutPage() {
    const { t } = useTranslation();
    const { about, isLoading } = useAboutPage();
    const { profile, legalities, team } = about;
    const brandName = t('common.brand.name');

    const missions = missionItems(profile.mission);
    const contacts = contactItems(profile).filter(
        (item) => item.key !== 'address'
    );
    const socials = socialItems(profile);
    const mapSrc = mapEmbedUrl(profile);
    const mapLink = mapLinkUrl(profile);
    const hasIntro = Boolean(
        profile.profile || profile.vision || missions.length
    );

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge={t('about.page.badge')}
                title={{
                    before: t('about.page.heroBefore'),
                    accent: brandName,
                }}
                text={t('about.page.heroText')}
                script={[
                    t('about.page.scriptTop'),
                    t('about.page.scriptBottom'),
                ]}
            />

            <div className="mx-auto flex max-w-[1232px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                {!isLoading && !hasIntro && (
                    <p className="rounded-2xl bg-forest-moss-50 p-5 text-sm text-oxford-navy-900/70 ring-1 ring-forest-moss-100">
                        {t('about.empty')}
                    </p>
                )}

                {profile.profile && (
                    <section
                        aria-labelledby="tentang-profil"
                        className={cardClass}
                    >
                        <SectionTitle id="tentang-profil">
                            {t('about.profile')}
                        </SectionTitle>
                        <p className="whitespace-pre-line pl-4 text-[15px] leading-relaxed text-oxford-navy-900/80">
                            {profile.profile}
                        </p>
                    </section>
                )}

                {(profile.vision || missions.length > 0) && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {profile.vision && (
                            <section
                                aria-labelledby="tentang-visi"
                                className={`${cardClass} bg-linear-to-br from-forest-moss-50 to-white`}
                            >
                                <SectionTitle id="tentang-visi">
                                    {t('about.vision')}
                                </SectionTitle>
                                <blockquote className="flex gap-3 pl-4">
                                    <RiDoubleQuotesL
                                        size={28}
                                        aria-hidden
                                        className="shrink-0 text-forest-moss-500"
                                    />
                                    <p className="font-display whitespace-pre-line text-lg leading-relaxed text-oxford-navy-800">
                                        {profile.vision}
                                    </p>
                                </blockquote>
                            </section>
                        )}
                        {missions.length > 0 && (
                            <section
                                aria-labelledby="tentang-misi"
                                className={cardClass}
                            >
                                <SectionTitle id="tentang-misi">
                                    {t('about.mission')}
                                </SectionTitle>
                                <ol className="flex flex-col gap-3 pl-4">
                                    {missions.map((mission, index) => (
                                        <li
                                            key={index}
                                            className="flex gap-3 text-[15px] leading-relaxed text-oxford-navy-900/80"
                                        >
                                            <span
                                                aria-hidden
                                                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest-moss-100 text-sm font-bold text-forest-moss-800"
                                            >
                                                {index + 1}
                                            </span>
                                            <span className="pt-0.5">
                                                {mission}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}
                    </div>
                )}

                {legalities.length > 0 && (
                    <section
                        aria-labelledby="tentang-legalitas"
                        className={cardClass}
                    >
                        <div className="flex flex-col gap-2">
                            <SectionTitle id="tentang-legalitas">
                                {t('about.legality')}
                            </SectionTitle>
                            <p className="pl-4 text-[15px] text-oxford-navy-900/65">
                                {t('about.legalityText')}
                            </p>
                        </div>
                        <LegalityCarousel items={legalities} />
                    </section>
                )}

                {team.length > 0 && (
                    <section
                        aria-labelledby="tentang-tim"
                        className={cardClass}
                    >
                        <div className="flex flex-col gap-2">
                            <SectionTitle id="tentang-tim">
                                {t('about.team')}
                            </SectionTitle>
                            <p className="pl-4 text-[15px] text-oxford-navy-900/65">
                                {t('about.teamText')}
                            </p>
                        </div>
                        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {team.map((member) => (
                                <li
                                    key={member.id}
                                    className="flex flex-col items-center gap-3 rounded-xl bg-forest-moss-50/60 p-5 text-center ring-1 ring-forest-moss-100"
                                >
                                    {member.photo_url ? (
                                        <ResponsiveImg
                                            src={member.photo_url}
                                            sizes="112px"
                                            alt=""
                                            className="size-28 rounded-full object-cover ring-4 ring-white"
                                        />
                                    ) : (
                                        <span
                                            aria-hidden
                                            className="flex size-28 items-center justify-center rounded-full bg-white text-forest-moss-600 ring-4 ring-white"
                                        >
                                            <RiUserLine size={44} />
                                        </span>
                                    )}
                                    <div className="flex flex-col gap-0.5">
                                        <h3 className="font-display text-lg font-bold text-oxford-navy-700">
                                            {member.name}
                                        </h3>
                                        {member.position && (
                                            <p className="text-sm font-medium text-forest-moss-700">
                                                {member.position}
                                            </p>
                                        )}
                                    </div>
                                    {expertiseTags(member.expertise).length >
                                        0 && (
                                        <ul
                                            aria-label={t('about.expertise')}
                                            className="flex flex-wrap justify-center gap-1.5"
                                        >
                                            {expertiseTags(
                                                member.expertise
                                            ).map((tag) => (
                                                <li
                                                    key={tag}
                                                    className="rounded-full bg-white px-2.5 py-0.5 text-xs text-oxford-navy-800 ring-1 ring-forest-moss-200"
                                                >
                                                    {tag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <section
                        aria-labelledby="tentang-kontak"
                        className={cardClass}
                    >
                        <SectionTitle id="tentang-kontak">
                            {t('about.contact')}
                        </SectionTitle>
                        <ul className="flex flex-col gap-3 pl-4">
                            {contacts.map((item) => (
                                <li key={item.key}>
                                    <a
                                        href={item.href ?? undefined}
                                        target={
                                            item.href?.startsWith('http')
                                                ? '_blank'
                                                : undefined
                                        }
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-3 break-all text-[15px] text-oxford-navy-900/80 transition-colors hover:text-oxford-navy-700 hover:underline"
                                    >
                                        <i
                                            aria-hidden
                                            className={`${item.icon} text-xl text-oxford-navy-700`}
                                        ></i>
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>

                        {socials.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <h3 className="font-display pl-4 text-base font-bold text-oxford-navy-700">
                                    {t('about.social')}
                                </h3>
                                <ul className="flex flex-wrap gap-2 pl-4">
                                    {socials.map(({ platform, url }) => (
                                        <li key={platform}>
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-full bg-forest-moss-50 px-3 py-1.5 text-sm text-oxford-navy-800 ring-1 ring-forest-moss-200 transition-colors hover:bg-forest-moss-100"
                                            >
                                                <i
                                                    aria-hidden
                                                    className={`${SOCIAL_META[platform].icon} text-lg text-oxford-navy-700`}
                                                ></i>
                                                {SOCIAL_META[platform].label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>

                    <section
                        aria-labelledby="tentang-alamat"
                        className={cardClass}
                    >
                        <SectionTitle
                            id="tentang-alamat"
                            action={
                                mapLink && (
                                    <a
                                        href={mapLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm font-semibold text-oxford-navy-700 hover:underline"
                                    >
                                        {t('about.openMap')}
                                        <RiExternalLinkLine
                                            size={16}
                                            aria-hidden
                                        />
                                    </a>
                                )
                            }
                        >
                            {t('about.address')}
                        </SectionTitle>
                        {profile.address && (
                            <p className="whitespace-pre-line pl-4 text-[15px] leading-relaxed text-oxford-navy-900/80">
                                {profile.address}
                            </p>
                        )}
                        {mapSrc && (
                            <iframe
                                title={t('about.mapTitle', { name: brandName })}
                                src={mapSrc}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="aspect-[16/10] w-full rounded-xl border-0 ring-1 ring-forest-moss-100"
                            />
                        )}
                    </section>
                </div>

                <CtaBand
                    title={t('about.ctaTitle')}
                    text={t('about.ctaText')}
                    action={{ to: '/paket', label: t('about.ctaAction') }}
                />
            </div>
        </div>
    );
}
