import events from '@/data/event.json';
import { RiCalendar2Line } from '@remixicon/react';
import Button from './Button/Button';

export default function Event(): React.ReactNode {
    return (
        <>
            <section>
                <div
                    className="grid
                    lg:grid-cols-2 lg:gap-6
                    md:grid-cols-1 lg:gap-4 md:gap-y-6
                    sm:grid-cols-1 sm:gap-4 sm:gap-y-6
                    grid-cols-1 gap-6 auto-rows-fr
                    "
                >
                    {events.map((event) => (
                        <>
                            <div
                                className="
                                lg:flex lg:flex-row lg:gap-4 lg:bg-white lg:rounded-xl
                                md:flex md:flex-row md:gap-4 md:bg-white md:rounded-xl
                                sm:flex sm:flex-row sm:gap-4 sm:bg-white sm:rounded-xl
                                flex bg-white rounded-xl

                                hover-translate h-full w-full card-shadow
                                "
                            >
                                <div
                                    className="
                                    lg:h-full lg:w-70 lg:rounded-s-xl lg:overflow-hidden lg:block
                                    md:h-full md:w-50 md:rounded-s-xl md:overflow-hidden md:block
                                    sm:h-full sm:w-50 sm:rounded-s-xl sm:overflow-hidden sm:block
                                     hidden h-full  rounded-s-xl  overflow-hidden
                                    "
                                >
                                    <img
                                        className="
                                        lg:h-full lg:w-full lg:object-cover lg:block
                                        md:h-full md:w-full md:object-cover md:block
                                        sm:h-full sm:w-full sm:object-cover sm:block
                                        hidden
                                        "
                                        src={event.event_img}
                                        alt={event.event_name}
                                    />
                                </div>
                                <div className="flex flex-col text-black p-6 gap-6 no-wrap w-xl h-full">
                                    <div className="flex flex-row gap-2 items-center">
                                        <RiCalendar2Line
                                            size={18}
                                            color="yellow"
                                        />
                                        <small>{event.time}</small>
                                    </div>
                                    <h4 className="text-2xl font-semibold">
                                        {event.event_name}
                                    </h4>
                                    <p className="text-sm line-clamp-2">
                                        {event.description}
                                    </p>
                                    <div className="w-fit mt-auto justify-self-end ">
                                        <Button variant="primary">
                                            Detail
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ))}
                </div>
            </section>
        </>
    );
}
