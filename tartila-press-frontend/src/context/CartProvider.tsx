import { useEffect, useState, type ReactNode } from 'react';
import { CartContext } from '@/context/CartContext';

const STORAGE_KEY = 'tartila_book_cart';

function readStoredCart(): number[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        return Array.isArray(parsed)
            ? parsed.filter((id): id is number => typeof id === 'number')
            : [];
    } catch {
        return [];
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const [bookIds, setBookIds] = useState<number[]>(() => readStoredCart());

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookIds));
        } catch {
            // localStorage tidak tersedia (mis. mode private) - keranjang cukup tidak tersimpan.
        }
    }, [bookIds]);

    function addToCart(bookId: number) {
        setBookIds((prev) => (prev.includes(bookId) ? prev : [...prev, bookId]));
    }

    function removeFromCart(bookId: number) {
        setBookIds((prev) => prev.filter((id) => id !== bookId));
    }

    function clearCart() {
        setBookIds([]);
    }

    function isInCart(bookId: number) {
        return bookIds.includes(bookId);
    }

    return (
        <CartContext.Provider
            value={{ bookIds, addToCart, removeFromCart, clearCart, isInCart }}
        >
            {children}
        </CartContext.Provider>
    );
}
