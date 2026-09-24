export const ORDER_ITEMABLE_TYPE = {
    book: 'App\\Models\\Book',
    package: 'App\\Models\\Package',
    customItem: 'App\\Models\\CustomPackageItem',
    bookChapter: 'App\\Models\\BookChapter',
    event: 'App\\Models\\Event',
} as const;

export type OrderCategory = 'book' | 'package' | 'book_chapter' | 'event';

/**
 * Order has no explicit "type" column - its category is inferred from the
 * polymorphic itemable_type of its (always same-type) items.
 */
export function getOrderCategory(
    itemableType: string | undefined
): OrderCategory | null {
    if (itemableType === ORDER_ITEMABLE_TYPE.book) {
        return 'book';
    }
    if (
        itemableType === ORDER_ITEMABLE_TYPE.package ||
        itemableType === ORDER_ITEMABLE_TYPE.customItem
    ) {
        return 'package';
    }
    if (itemableType === ORDER_ITEMABLE_TYPE.bookChapter) {
        return 'book_chapter';
    }
    if (itemableType === ORDER_ITEMABLE_TYPE.event) {
        return 'event';
    }
    return null;
}
