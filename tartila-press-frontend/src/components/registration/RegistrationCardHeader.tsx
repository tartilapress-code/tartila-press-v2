import { Link } from 'react-router-dom';

type RegistrationCardHeaderProps = {
    link?: string;
    page_number: string;
    label: string;
};

export default function RegistrationCardHeader({
    link,
    page_number = 'Page Title',
    label = 'Home',
}: RegistrationCardHeaderProps) {
    return (
        <>
            <div className="flex flex-row gap-4 items-center">
                <Link
                    to={link ?? '/'}
                    className="
                    w-fit rounded-full bg-forest-moss-500 px-2 py-1 text-white hover:bg-forest-moss-400 duration-200
                    "
                >
                    {label}
                </Link>
                <h5 className="font-bold text-sm text-white justify-self-end ml-auto">
                    {page_number}
                </h5>
            </div>
        </>
    );
}
