import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiCheckLine } from '@remixicon/react';
import * as packageApi from '@/data/package/packageApi';
import Button from '@/components/Button/Button';
import PillBadge from '@/components/ui/PillBadge';
import SectionTitle from '@/components/ui/SectionTitle';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';

type PackageDetail = {
    id: number;
    name: string;
    category: string | null;
    photo: string | null;
    price: string;
    discount: number;
    final_price: number;
    description: string | null;
    facilities: string[] | null;
    services: string[] | null;
    terms: string[] | null;
    notes: string[] | null;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

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
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [pkg, setPkg] = useState<PackageDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

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
                <p className="text-oxford-navy-900/70">Memuat...</p>
            </div>
        );
    }

    if (notFound || !pkg) {
        return <ErrorPage />;
    }

    function handleTakePackage() {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        navigate(`/dashboard/ambil-paket/${pkg!.id}`);
    }

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
                    Semua Paket
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
                                {rupiahFormatter.format(Number(pkg.price))}
                            </span>
                        )}
                        <span className="text-3xl font-bold text-oxford-navy-700">
                            {rupiahFormatter.format(pkg.final_price)}
                        </span>
                        {pkg.discount > 0 && (
                            <span className="rounded-full bg-forest-moss-700 px-2.5 py-1 text-xs font-semibold text-white">
                                Diskon {pkg.discount}%
                            </span>
                        )}
                    </div>

                    {pkg.description && (
                        <p className="leading-relaxed text-oxford-navy-900/75">
                            {pkg.description}
                        </p>
                    )}

                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={handleTakePackage}
                    >
                        Ambil Paket
                    </Button>
                </div>

                {hasLists && (
                    <section
                        aria-labelledby="rincian-paket"
                        className="flex flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-8"
                    >
                        <SectionTitle id="rincian-paket">
                            Rincian Paket
                        </SectionTitle>
                        <ListSection title="Layanan" items={pkg.services} />
                        <ListSection title="Fasilitas" items={pkg.facilities} />
                        <ListSection title="Ketentuan" items={pkg.terms} />
                        <ListSection title="Catatan" items={pkg.notes} />
                    </section>
                )}
            </div>
        </div>
    );
}
