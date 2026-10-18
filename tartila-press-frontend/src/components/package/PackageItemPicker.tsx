import { Link } from 'react-router-dom';

export type CustomItemOption = {
    id: number;
    type: 'facility' | 'service';
    name: string;
    is_active: boolean;
};

/**
 * Admin memilih fasilitas/layanan paket dari daftar Item Custom (diinput sekali di menu
 * "Item Custom"), bukan mengetik ulang. Yang disimpan di paket tetap NAMA item.
 * Nilai lama yang tidak ada di daftar (paket lama dengan teks bebas) tetap tampil,
 * ditandai, dan bisa dibuang.
 */
export default function PackageItemPicker({
    label,
    options,
    selected,
    onChange,
}: {
    label: string;
    options: CustomItemOption[];
    selected: string[];
    onChange: (names: string[]) => void;
}) {
    const known = new Set(options.map((option) => option.name));
    const legacy = selected.filter((name) => !known.has(name));

    function toggle(name: string, checked: boolean) {
        onChange(
            checked
                ? [...selected, name]
                : selected.filter((item) => item !== name)
        );
    }

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-oxford-navy-900">
                {label}
            </legend>

            {options.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/65">
                    Belum ada item {label.toLowerCase()} di daftar. Tambahkan
                    dulu di menu{' '}
                    <Link
                        to="/admin/custom-package-items"
                        className="font-semibold text-forest-moss-700 underline"
                    >
                        Item Custom
                    </Link>
                    .
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {options.map((option) => (
                        <li key={option.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded bg-forest-moss-50 px-3 py-1.5 text-sm text-oxford-navy-900/85 ring-1 ring-forest-moss-100">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option.name)}
                                    onChange={(event) =>
                                        toggle(
                                            option.name,
                                            event.target.checked
                                        )
                                    }
                                />
                                <span>
                                    {option.name}
                                    {!option.is_active && (
                                        <span className="ml-1 text-xs text-oxford-navy-900/55">
                                            (nonaktif)
                                        </span>
                                    )}
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            {legacy.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                    <p className="text-xs text-amber-900">
                        Tidak ada di daftar Item Custom (data lama). Tetap
                        tersimpan sampai Anda menghapusnya; ganti dengan item
                        dari daftar di atas.
                    </p>
                    <ul className="flex flex-col gap-1">
                        {legacy.map((name) => (
                            <li
                                key={name}
                                className="flex items-center justify-between rounded bg-white px-3 py-1 text-sm text-oxford-navy-900/80 ring-1 ring-amber-200"
                            >
                                {name}
                                <button
                                    type="button"
                                    onClick={() => toggle(name, false)}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    Hapus
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </fieldset>
    );
}
