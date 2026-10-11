type FieldCategory = { id: number; name: string };

/**
 * Pilihan bidang (Kategori Keilmuan) berupa tombol yang bisa dicentang.
 * Tidak ada yang dipilih = "Umum".
 */
export default function FieldCategoryPicker({
    label,
    categories,
    value,
    onChange,
    emptyLabel,
}: {
    label: string;
    categories: FieldCategory[];
    value: number[];
    onChange: (value: number[]) => void;
    // Keterangan saat tidak ada bidang dipilih.
    emptyLabel: string;
}) {
    function toggle(id: number) {
        onChange(
            value.includes(id)
                ? value.filter((item) => item !== id)
                : [...value, id].sort((a, b) => a - b)
        );
    }

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-oxford-navy-900">
                {label}
            </legend>
            {categories.length === 0 ? (
                <p className="text-xs text-oxford-navy-900/65">
                    Belum ada Kategori Keilmuan. Tambahkan di menu Kategori
                    Keilmuan.
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => {
                        const checked = value.includes(category.id);

                        return (
                            <label
                                key={category.id}
                                className={`cursor-pointer rounded-full px-3 py-1 text-sm ring-1 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-oxford-navy-500 ${
                                    checked
                                        ? 'bg-oxford-navy-700 text-white ring-oxford-navy-700'
                                        : 'bg-white text-oxford-navy-900 ring-forest-moss-200 hover:bg-forest-moss-50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={() => toggle(category.id)}
                                />
                                {category.name}
                            </label>
                        );
                    })}
                </div>
            )}
            <p className="text-xs text-oxford-navy-900/65">
                {value.length === 0
                    ? emptyLabel
                    : `${value.length} bidang dipilih.`}
            </p>
        </fieldset>
    );
}
