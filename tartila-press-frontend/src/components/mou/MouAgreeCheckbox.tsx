/** Pernyataan wajib sebelum menandatangani MOU distribusi buku. */
export default function MouAgreeCheckbox({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer flex-row items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-oxford-navy-900 ring-1 ring-amber-200">
            <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span>
                Saya sudah membaca, memahami dan{' '}
                <strong>menyepakati seluruh isi MOU distribusi buku</strong>{' '}
                ini. Tanggal dan waktu tanda tangan saya dicatat di MOU.
            </span>
        </label>
    );
}
