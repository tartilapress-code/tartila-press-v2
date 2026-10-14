// Jenis ISBN paket / proyek Book Chapter. Kunci sama dengan backend (App\Support\IsbnTypes);
// teks penjelasan ada di i18n (isbn.json).
export const ISBN_TYPES = ['print', 'electronic', 'both'] as const;

export type IsbnType = (typeof ISBN_TYPES)[number];

/** Satu pilihan jenis ISBN paket beserta harganya (dari API paket: isbn_options). */
export type IsbnOption = {
    type: IsbnType;
    label: string;
    price: number;
    final_price: number;
};

export function isIsbnType(value: unknown): value is IsbnType {
    return typeof value === 'string' && ISBN_TYPES.includes(value as IsbnType);
}

export function isbnFlags(type: IsbnType | null | undefined): {
    print: boolean;
    electronic: boolean;
} {
    return {
        print: type === 'print' || type === 'both',
        electronic: type === 'electronic' || type === 'both',
    };
}

export function isbnFromFlags(
    print: boolean,
    electronic: boolean
): IsbnType | null {
    if (print && electronic) return 'both';
    if (print) return 'print';
    if (electronic) return 'electronic';

    return null;
}
