import { RiArrowUpLine } from '@remixicon/react';
import { NavHashLink } from 'react-router-hash-link';

export default function Top(): React.ReactNode {
    return (
        <>
            <NavHashLink to="#home" smooth>
                <div
                    className="flex flex-row gap-4 px-4 py-2 w-fit h-auto bg-forest-moss-500 rounded-full
                cursor-pointer hover:bg-forest-moss-400
                "
                >
                    <div className="bg-white rounded-full">
                        <RiArrowUpLine />
                    </div>
                    <h5 className="font-semibold">Go Up</h5>
                </div>
            </NavHashLink>
        </>
    );
}
