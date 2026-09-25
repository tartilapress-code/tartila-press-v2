import {
    toNumber,
    type BookChapterCostSettings,
    type PackageItem,
    type PackageOptions,
} from '@/lib/bookChapterCost';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function CheckRow({
    label,
    description,
    cost,
    checked,
    onChange,
}: {
    label: string;
    description?: string | null;
    cost: number;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex flex-row items-start justify-between gap-3 text-oxford-navy-900 cursor-pointer">
            <span className="flex flex-row items-start gap-2">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span className="flex flex-col">
                    <span>{label}</span>
                    {description && (
                        <span className="text-oxford-navy-900/55 text-xs">
                            {description}
                        </span>
                    )}
                </span>
            </span>
            <span
                className={`text-sm shrink-0 ${
                    cost > 0
                        ? 'text-forest-moss-700'
                        : 'text-oxford-navy-900/55'
                }`}
            >
                {cost > 0 ? `− ${rupiahFormatter.format(cost)}` : 'Gratis'}
            </span>
        </label>
    );
}

function ItemGroup({
    title,
    items,
    selectedIds,
    onToggle,
}: {
    title: string;
    items: PackageItem[];
    selectedIds: number[];
    onToggle: (id: number, checked: boolean) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-oxford-navy-900/80 text-sm font-semibold">
                {title}
            </p>
            {items.length === 0 ? (
                <p className="text-oxford-navy-900/55 text-sm">
                    Belum ada item di daftar Paket Custom.
                </p>
            ) : (
                items.map((item) => (
                    <CheckRow
                        key={item.id}
                        label={item.name}
                        description={item.description}
                        cost={toNumber(item.book_chapter_cost)}
                        checked={selectedIds.includes(item.id)}
                        onChange={(checked) => onToggle(item.id, checked)}
                    />
                ))
            )}
        </div>
    );
}

/**
 * Yang didapatkan penulis pada proyek Book Chapter: HKI, ISBN cetak, e-ISBN,
 * serta fasilitas & layanan yang diambil dari daftar item Paket Custom.
 * Biaya di sisi kanan dipotong dari total harga bab.
 */
export default function PackageOptionsField({
    value,
    onChange,
    settings,
    items,
}: {
    value: PackageOptions;
    onChange: (next: PackageOptions) => void;
    settings: BookChapterCostSettings;
    items: PackageItem[];
}) {
    function toggleItem(id: number, checked: boolean) {
        onChange({
            ...value,
            package_item_ids: checked
                ? [...value.package_item_ids, id]
                : value.package_item_ids.filter((itemId) => itemId !== id),
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h6 className="text-oxford-navy-900 font-semibold">
                    Yang Didapatkan Penulis
                </h6>
                <p className="text-oxford-navy-900/65 text-xs">
                    Centang yang termasuk dalam paket proyek ini. Yang dicentang
                    tampil di halaman publik, dan biayanya (kolom kanan)
                    dipotong dari total harga bab.
                </p>
            </div>

            <div className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3">
                <CheckRow
                    label="HKI"
                    cost={toNumber(settings.hki_cost)}
                    checked={value.includes_hki}
                    onChange={(checked) =>
                        onChange({ ...value, includes_hki: checked })
                    }
                />
                <CheckRow
                    label="ISBN Cetak"
                    cost={toNumber(settings.isbn_print_cost)}
                    checked={value.includes_isbn_print}
                    onChange={(checked) =>
                        onChange({ ...value, includes_isbn_print: checked })
                    }
                />
                <CheckRow
                    label="e-ISBN"
                    cost={toNumber(settings.isbn_electronic_cost)}
                    checked={value.includes_isbn_electronic}
                    onChange={(checked) =>
                        onChange({
                            ...value,
                            includes_isbn_electronic: checked,
                        })
                    }
                />
            </div>

            <div className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3">
                <ItemGroup
                    title="Fasilitas"
                    items={items.filter((item) => item.type === 'facility')}
                    selectedIds={value.package_item_ids}
                    onToggle={toggleItem}
                />
                <ItemGroup
                    title="Layanan"
                    items={items.filter((item) => item.type === 'service')}
                    selectedIds={value.package_item_ids}
                    onToggle={toggleItem}
                />
            </div>
        </div>
    );
}
