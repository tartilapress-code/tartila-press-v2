import packages from '../../data/packages.json';
import Badge from '../Badge';
import Button from '../Button/Button';

export default function Card2() {
    const rupiahFormatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    });

    return (
        <>
            <div className="grid grid-cols-4 auto-rows-fr gap-6">
                {packages.map((pkg) => (
                    <div
                        key={pkg.name}
                        className="w-full flex flex-col gap-2 rounded-xl border border-forest-moss-400  overflow-hidden
                    transition-transform hover:-translate-y-2 duration-200 relative bg-[url(../assets/images/buku.png)] bg-cover bg-no-repeat bg-center"
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
                                            {rupiahFormatter.format(pkg.price)}
                                        </p>
                                    </div>
                                    <Button variant="secondary">
                                        Lihat Detail
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
