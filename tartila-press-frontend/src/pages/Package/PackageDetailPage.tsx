import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowLeftLine, RiCheckLine } from '@remixicon/react';
import * as packageApi from '@/data/package/packageApi';
import Button from '@/components/Button/Button';
import IsbnPriceNote from '@/components/package/IsbnPriceNote';
import IsbnTypeDialog from '@/components/package/IsbnTypeDialog';
import IsbnTypeSelector from '@/components/package/IsbnTypeSelector';
import PillBadge from '@/components/ui/PillBadge';
import type { IsbnOption, IsbnType } from '@/lib/isbnTypes';
import SectionTitle from '@/components/ui/SectionTitle';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';
import { useFormat } from '@/i18n/useFormat';

type PackageDetail = {
    id: number;
    name: string;
    category: string | null;
    photo: string | null;
    price: string;
    discount: number;
    final_price: number;
    isbn_options: IsbnOption[];
    description: string | null;
    facilities: string[] | null;
    services: string[] | null;
    terms: string[] | null;
    notes: string[] | null;
};

function ListSection({
    title,
    items,
}: {
    title: string;
    items: string[] | null;
}) {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            <h5 className="font-display text-lg font-bold text-oxford-navy-700">
                {title}
            </h5>
            <ul className="flex flex-col gap-2 text-oxford-navy-900/80">
                {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                        <RiCheckLine
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0 text-forest-moss-600"
                        />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function PackageDetailPage() {
    const { t } = useTranslation();
    const { rupiah } = useFormat();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [pkg, setPkg] = useState<PackageDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);
    const [isbnType, setIsbnType] = useState<IsbnType | null>(null);
    const [showIsbnDialog, setShowIsbnDialog] = useState<boolean>(false);

    useEffect(() => {
        Promise.resolve()
            .then(() => packageApi.get(id ?? ''))
            .then((response) => setPkg(response.data))
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <p className="text-oxford-navy-900/70">{t('common.loading')}</p>
            </div>
        );
    }

    if (notFound || !pkg) {
        return <ErrorPage />;
    }

    function goToOrder(type: IsbnType | null) {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        navigate(
            `/dashboard/ambil-paket/${pkg!.id}${type ? `?isbn=${type}` : ''}`
        );
    }

    function handleTakePackage() {
        const options = pkg!.isbn_options ?? [];

        // Lebih dari satu jenis ISBN: pembeli wajib memilih dulu (popup bila belum memilih).
        if (options.length > 1 && !isbnType) {
            setShowIsbnDialog(true);
            return;
        }

        goToOrder(isbnType ?? options[0]?.type ?? null);
    }

    const isbnChoices = (pkg.isbn_options ?? []).map((option) => ({
        type: option.type,
        price: option.final_price,
        originalPrice: option.price,
    }));

    const hasLists = [pkg.services, pkg.facilities, pkg.terms, pkg.notes].some(
        (items) => items && items.length > 0
    );

    return (
        // Keluar dari margin <main> supaya latar selebar halaman.
        <div className="-mx-10 -my-2 bg-white">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-20 pt-6 sm:px-6">
                <Link
                    to="/paket"
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-moss-700 hover:underline"
                >
                    <RiArrowLeftLine aria-hidden className="size-4" />
                    {t('packages.detail.back')}
                </Link>

                <div className="flex flex-col gap-5 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-8">
                    {pkg.photo && (
                        <img
                            src={pkg.photo}
                            alt={pkg.name}
                            className="h-56 w-full rounded-xl object-cover"
                        />
                    )}
                    <div className="flex flex-col gap-3">
                        {pkg.category && <PillBadge label={pkg.category} />}
                        <h1 className="font-display text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl">
                            {pkg.name}
                        </h1>
                    </div>

                    <div className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                        {pkg.discount > 0 && (
                            <span className="text-oxford-navy-900/65 line-through">
                                {rupiah(Number(pkg.price))}
                            </span>
                        )}
                        <span className="text-3xl font-bold text-oxford-navy-700">
                            {rupiah(
                                pkg.isbn_options?.find(
                                    (option) => option.type === isbnType
                                )?.final_price ?? pkg.final_price
                            )}
                        </span>
                        {pkg.discount > 0 && (
                            <span className="rounded-full bg-forest-moss-700 px-2.5 py-1 text-xs font-semibold text-white">
                                {t('common.discount', {
                                    percent: pkg.discount,
                                })}
                            </span>
                        )}
                    </div>

                    {isbnType === null && (
                        <p className="-mt-3 text-xs text-oxford-navy-900/65">
                            {t('isbn.defaultPriceNote')}
                        </p>
                    )}
                    {isbnType === null && (
                        <IsbnPriceNote options={pkg.isbn_options} />
                    )}

                    {pkg.description && (
                        <p className="leading-relaxed text-oxford-navy-900/75">
                            {pkg.description}
                        </p>
                    )}

                    {isbnChoices.length > 1 && (
                        <IsbnTypeSelector
                            name="package-isbn"
                            choices={isbnChoices}
                            value={isbnType}
                            onChange={setIsbnType}
                            formatPrice={rupiah}
                        />
                    )}

                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={handleTakePackage}
                    >
                        {t('packages.detail.take')}
                    </Button>
                </div>

                {showIsbnDialog && (
                    <IsbnTypeDialog
                        choices={isbnChoices}
                        formatPrice={rupiah}
                        initial={isbnType}
                        onCancel={() => setShowIsbnDialog(false)}
                        onConfirm={(type) => {
                            setIsbnType(type);
                            setShowIsbnDialog(false);
                            goToOrder(type);
                        }}
                    />
                )}

                {hasLists && (
                    <section
                        aria-labelledby="rincian-paket"
                        className="flex flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-8"
                    >
                        <SectionTitle id="rincian-paket">
                            {t('packages.detail.sectionTitle')}
                        </SectionTitle>
                        <ListSection
                            title={t('packages.detail.services')}
                            items={pkg.services}
                        />
                        <ListSection
                            title={t('packages.detail.facilities')}
                            items={pkg.facilities}
                        />
                        <ListSection
                            title={t('packages.detail.terms')}
                            items={pkg.terms}
                        />
                        <ListSection
                            title={t('packages.detail.notes')}
                            items={pkg.notes}
                        />
                    </section>
                )}
            </div>
        </div>
    );
}
