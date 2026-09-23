import { RiArrowLeftLine } from '@remixicon/react';
import { NavLink } from 'react-router-dom';

export default function ArrowBack(): React.ReactNode {
    return (
        <>
            <div className="w-fit rounded-full bg-forest-moss-500 p-1 hover:bg-forest-moss-400 duration-200">
                <NavLink to="/">
                    <RiArrowLeftLine color="white" />
                </NavLink>
            </div>
        </>
    );
}
