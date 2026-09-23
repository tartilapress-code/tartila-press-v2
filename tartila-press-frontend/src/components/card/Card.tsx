import Badge from '../Badge';
import packages from '../../data/packages.json';
import Button from '../Button/Button';

export default function Card() {
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
                        className="w-full flex flex-col gap-2 p-2 rounded-xl border border-forest-moss-400 hover:animate-pulse
                        transition-transform hover:-translate-y-2 duration-200
                        "
                    >
                        <div className="relative bg-[url(../assets/images/buku.png)] bg-cover bg-no-repeat bg-center  h-60 rounded-xl">
                            <div className="p-4 bg-forest-moss-600/60 rounded-xl inset-0 w-full h-full ">
                                <Badge>Diskon {pkg.discount}%</Badge>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <h4 className="text-2xl font-semibold">
                                    {pkg.name}
                                </h4>
                                <p className="text-base font-light">
                                    {pkg.category}
                                </p>
                                <p>{rupiahFormatter.format(pkg.price)}</p>
                            </div>
                            <Button variant="outline">Lihat Detail</Button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
