import services from '../data/services.json';

export default function Services() {
    return (
        <>
            <div
                className="
                lg:grid lg:grid-cols-3 lg:auto-rows-fr lg:gap-6
                md:grid md:grid-cols-2 md:auto-rows-fr md:gap-6
                sm:grid sm:grid-cols-1 sm:auto-rows-fr sm:gap-6
                grid grid-cols-1 auto-rows-fr gap-6
                "
            >
                {services.map((service) => (
                    <div
                        key={service.id}
                        className="flex flex-col gap-4 py-10 px-4 justify-center border border-forest-moss-500 rounded-xl shadow-md
                        transition-transform hover:-translate-y-2 duration-200 bg-white
                        "
                    >
                        <h5 className="text-xl font-semibold">
                            {service.title}
                        </h5>
                        <p className="text-sm font-light">
                            {service.description}
                        </p>
                    </div>
                ))}
            </div>
        </>
    );
}
