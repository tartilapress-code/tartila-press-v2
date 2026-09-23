import { RiShoppingCart2Line } from '@remixicon/react';
import { Link } from 'react-router-dom';
import { useCart } from '@/context/useCart';

export default function CartFab() {
    const { bookIds } = useCart();

    if (bookIds.length === 0) {
        return null;
    }

    return (
        <Link
            to="/dashboard/keranjang"
            className="fixed bottom-5 left-10 z-50"
        >
            <div
                className="flex flex-row items-center gap-2 px-4 py-2 w-fit h-auto
                bg-forest-moss-500 rounded-full shadow-lg cursor-pointer hover:bg-forest-moss-400"
            >
                <RiShoppingCart2Line className="text-white" />
                <h5 className="font-semibold text-white">
                    Keranjang ({bookIds.length})
                </h5>
            </div>
        </Link>
    );
}
