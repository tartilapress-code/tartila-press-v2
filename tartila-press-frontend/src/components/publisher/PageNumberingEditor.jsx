// src/features/publisher/layout/PageNumberingEditor.jsx
const STYLE_OPTIONS = [
  { value: 'none', label: 'Tanpa nomor' },
  { value: 'arabic', label: 'Arab (1, 2, 3)' },
  { value: 'roman-lower', label: 'Romawi kecil (i, ii, iii)' },
  { value: 'roman-upper', label: 'Romawi besar (I, II, III)' },
  { value: 'alpha', label: 'Huruf (a, b, c)' },
];

const POSITION_OPTIONS = [
  { value: 'bottom-center', label: 'Bawah tengah' },
  { value: 'bottom-outer-alternating', label: 'Bawah luar, bergantian kiri-kanan' },
  { value: 'bottom-left', label: 'Bawah kiri' },
  { value: 'bottom-right', label: 'Bawah kanan' },
  { value: 'top-center', label: 'Atas tengah' },
  { value: 'top-left', label: 'Atas kiri' },
  { value: 'top-right', label: 'Atas kanan' },
];

// value: { sections: [{ key, label, numbering: { style, position, reset_at_start, show_on_first_page } }] }
export default function PageNumberingEditor({ value, onChange }) {
  const sections = value?.sections ?? [];

  const updateSection = (index, patch) => {
    const next = sections.map((s, i) =>
      i === index ? { ...s, numbering: { ...s.numbering, ...patch } } : s
    );
    onChange({ sections: next });
  };

  if (sections.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Tambahkan bagian buku dulu di atas (mis. bagian awal, isi, bagian akhir) sebelum
        mengatur penomoran halamannya.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={section.key} className="rounded-lg border border-neutral-200 p-4">
          <p className="mb-3 font-medium text-neutral-900">{section.label}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Gaya angka</span>
              <select
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={section.numbering?.style ?? 'arabic'}
                onChange={(e) => updateSection(index, { style: e.target.value })}
              >
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Posisi nomor</span>
              <select
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={section.numbering?.position ?? 'bottom-center'}
                onChange={(e) => updateSection(index, { position: e.target.value })}
              >
                {POSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={section.numbering?.reset_at_start ?? false}
                onChange={(e) => updateSection(index, { reset_at_start: e.target.checked })}
              />
              Mulai ulang dari 1 di bagian ini
            </label>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={section.numbering?.show_on_first_page ?? true}
                onChange={(e) => updateSection(index, { show_on_first_page: e.target.checked })}
              />
              Tampilkan nomor di halaman pertama bagian ini
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
