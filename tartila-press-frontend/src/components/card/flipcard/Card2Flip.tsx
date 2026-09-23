import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as packageApi from '@/data/package/packageApi';
import Badge from '@/components/Badge';
import Button from '@/components/Button/Button';

type PackageItem = {
    id: number;
    name: string;
    category: string | null;
    price: string;
    discount: number;
    facilities: string[] | null;
};

export default function Card2() {
    const rupiahFormatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    });

    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [flipped, setFlipped] = useState<Set<number>>(new Set<number>());

    useEffect(() => {
        packageApi
            .list()
            .then((response) => setPackages(response.data))
            .catch(() => setPackages([]));
    }, []);

    const toogleFlipped = (id: number) => {
        setFlipped((previous) => {
            const next = new Set(previous);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };
    return (
        <>
            <div
                className="
                lg:grid lg:grid-cols-4 lg:auto-rows-fr lg:gap-6
                md:grid md:grid-cols-3 md:auto-rows-fr md:gap-6
                sm:grid sm:grid-cols-2 sm:auto-rows-fr sm:gap-6
                grid grid-cols-1 auto-rows-fr gap-6
                "
            >
                {packages.map((pkg) => {
                    const isFlipped = flipped.has(pkg.id);

                    return (
                        <div
                            key={pkg.id}
                            className="
                            cursor-pointer perspective-[1000px]
                            hover-translate
                            "
                            onClick={() => toogleFlipped(pkg.id)}
                        >
                            <div
                                className={`
                                            transition-transform duration-700 relative
                                            transform-3d h-120
                                            ${isFlipped ? 'rotate-y-180' : ''}
                                        `}
                            >
                                {/* Front */}
                                <div
                                    className="w-full flex flex-col gap-2 rounded-xl border border-forest-moss-400  overflow-hidden
                                                  backface-hidden
                                                bg-[url(../assets/images/buku.png)] bg-cover bg-no-repeat bg-center absolute inset-0"
                                >
                                    <div className="inset-0 bg-oxford-navy-900/70 h-full w-full rounded-xl flex flex-col ">
                                        <div className="p-4">
                                            <Badge variant="primary">
                                                Diskon {pkg.discount}%
                                            </Badge>
                                        </div>
                                        <div className="h-60 w-auto"></div>

                                        <div className="relative flex flex-col gap-4">
                                            <div className="absolute bg-linear-to-b from-black/0 to-black w-full h-full backdrop-blur-md"></div>
                                            <div className="flex flex-col gap-6 p-4 z-100">
                                                <div className="flex flex-col gap-1">
                                                    <h4 className="text-2xl font-semibold text-white">
                                                        {pkg.name}
                                                    </h4>
                                                    <p className="text-base font-light text-white">
                                                        {pkg.category}
                                                    </p>
                                                    <p className="text-forest-moss-500 font-semibold">
                                                        {rupiahFormatter.format(
                                                            Number(pkg.price)
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-stretch">
                                                    <Link
                                                        to={`/paket/${pkg.id}`}
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <Button variant="secondary">
                                                            Lihat Detail
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/*Back */}
                                <div
                                    className="
                                    flex flex-col gap-6
                                    bg-forest-moss-500 backface-hidden rotate-y-180 rounded-xl p-6 h-full
                                    "
                                >
                                    <h5 className="text-oxford-navy-100 font-semibold text-xl">
                                        Fasilitas :
                                    </h5>
                                    <ul className="flex flex-col gap-1 text-oxford-navy-100">
                                        {(pkg.facilities ?? []).map(
                                            (facility) => (
                                                <li
                                                    key={facility}
                                                    className="list-disc list-inside text-base font-light"
                                                >
                                                    {facility}
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
