import { RiArrowLeftLine, RiArrowRightLine } from '@remixicon/react';
import { Link } from 'react-router-dom';

type RegistrationPageNavigationProps = {
    nextLink?: string;
    previousLink?: string;
};

export default function RegistrationPageNavigation({
    nextLink,
    previousLink,
}: RegistrationPageNavigationProps) {
    if (nextLink && previousLink) {
        return (
            <div className="flex justify-between text-white mt-4">
                <Link to={previousLink ?? '/'}>
                    <div
                        className="
                            justify-self-start mr-auto flex flex-row-reverse gap-2 p-2 bg-forest-moss-400 rounded-sm w-fit
                            hover:bg-forest-moss-300 duration-250
                        "
                    >
                        <p>Previous</p>
                        <RiArrowLeftLine />
                    </div>
                </Link>
                <Link to={nextLink ?? '/'}>
                    <div
                        className="
                            justify-self-start mr-auto flex flex-row gap-2 p-2 bg-forest-moss-400 rounded-sm w-fit
                            hover:bg-forest-moss-300 duration-250
                        "
                    >
                        <p>Next</p>
                        <RiArrowRightLine />
                    </div>
                </Link>
            </div>
        );
    }
    if (nextLink) {
        return (
            <div className="flex text-white mt-4 justify-end">
                <Link to={nextLink ?? '/'}>
                    <div
                        className="
                         flex flex-row gap-2 p-2 bg-forest-moss-400 rounded-sm w-fit
                        hover:bg-forest-moss-300 duration-250
                    "
                    >
                        <p>Next</p>
                        <RiArrowRightLine />
                    </div>
                </Link>
            </div>
        );
    }
    if (previousLink) {
        return (
            <div className="flex justify-start text-white mt-4">
                <Link to={previousLink ?? '/'}>
                    <div className="justify-self-start mr-auto flex flex-row-reverse gap-2 p-2 bg-forest-moss-400 rounded-sm w-fit">
                        <p>Previous</p>
                        <RiArrowLeftLine />
                    </div>
                </Link>
            </div>
        );
    }
}
