import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as packageApi from '@/data/package/packageApi';
import Button from '@/components/Button/Button';
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
        <div className="flex flex-col gap-2">
            <h5 className="text-white text-lg font-semibold">{title}</h5>
            <ul className="flex flex-col gap-1 text-white/80">
                {items.map((item) => (
                    <li key={item} className="list-disc list-inside">
                        {item}
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
                <p className="text-oxford-navy-900">Memuat...</p>
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

    return (
        <div className="flex flex-col gap-6 my-10 max-w-3xl mx-auto">
            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-8">
                {pkg.photo && (
                    <img
                        src={pkg.photo}
                        alt={pkg.name}
                        className="w-full h-56 object-cover rounded-lg"
                    />
                )}
                <div>
                    <h1 className="text-white text-3xl font-bold">
                        {pkg.name}
                    </h1>
                    {pkg.category && (
                        <p className="text-white/70">{pkg.category}</p>
                    )}
                </div>

                <div className="flex flex-row items-center gap-3">
                    {pkg.discount > 0 && (
                        <span className="text-white/50 line-through">
                            {rupiahFormatter.format(Number(pkg.price))}
                        </span>
                    )}
                    <span className="text-forest-moss-300 text-2xl font-semibold">
                        {rupiahFormatter.format(pkg.final_price)}
                    </span>
                    {pkg.discount > 0 && (
                        <span className="text-white/70 text-sm">
                            (diskon {pkg.discount}%)
                        </span>
                    )}
                </div>

                {pkg.description && (
                    <p className="text-white/80">{pkg.description}</p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleTakePackage}
                >
                    Ambil Paket
                </Button>
            </div>

            <div className="flex flex-col gap-6 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <ListSection title="Layanan" items={pkg.services} />
                <ListSection title="Fasilitas" items={pkg.facilities} />
                <ListSection title="Ketentuan" items={pkg.terms} />
                <ListSection title="Catatan" items={pkg.notes} />
            </div>

            <Link
                to="/#paket"
                className="text-forest-moss-300 text-sm hover:text-forest-moss-200 self-center"
            >
                ← Kembali ke katalog paket
            </Link>
        </div>
    );
}
