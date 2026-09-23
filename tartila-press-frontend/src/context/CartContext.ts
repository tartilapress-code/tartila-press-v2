import { createContext } from 'react';

export type CartContextValue = {
    bookIds: number[];
    addToCart: (bookId: number) => void;
    removeFromCart: (bookId: number) => void;
    clearCart: () => void;
    isInCart: (bookId: number) => boolean;
};

export const CartContext = createContext<CartContextValue | null>(null);
