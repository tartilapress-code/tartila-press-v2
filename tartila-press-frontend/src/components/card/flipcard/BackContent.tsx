import packages from '@/data/packages.json' with { type: 'json' };

export default function BackCard() {
    return (
        <>
            {packages.map((pkg) => (
                <div
                    className="
                    backface-hidden rotate-180
                    "
                >
                    <h4>
                        Fasilitas :
                        {pkg.facilities.map((facility) => (
                            <p key={facility}>{facility}</p>
                        ))}
                    </h4>
                </div>
            ))}
        </>
    );
}
