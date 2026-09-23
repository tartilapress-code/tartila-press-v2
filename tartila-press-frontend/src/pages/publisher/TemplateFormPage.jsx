// src/features/publisher/layout/TemplateFormPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createTemplate,
  getTemplate,
  updatePageNumbering,
  updateTemplate,
} from '../api/publisherApi';
import PageNumberingEditor from './PageNumberingEditor';

const BLOCK_TYPE_OPTIONS = ['heading', 'paragraph', 'image', 'table', 'quote', 'citation'];

const emptySection = (key, label) => ({
  key,
  label,
  numbering: {
    style: 'arabic',
    position: 'bottom-center',
    reset_at_start: false,
    show_on_first_page: true,
  },
});

export default function TemplateFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== 'new';
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [identityFields, setIdentityFields] = useState(['Nama penulis', 'Nama editor']);
  const [blockTypes, setBlockTypes] = useState(['heading', 'paragraph', 'image', 'table']);
  const [numberingConfig, setNumberingConfig] = useState({
    sections: [
      emptySection('front_matter', 'Bagian awal'),
      emptySection('chapters', 'Isi buku'),
      emptySection('back_matter', 'Bagian akhir'),
    ],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    getTemplate(id).then((tpl) => {
      setName(tpl.name);
      setIdentityFields(tpl.structure_config?.identity_fields ?? []);
      setBlockTypes(tpl.structure_config?.chapter_block_types ?? []);
      if (tpl.page_numbering_config?.sections?.length) {
        setNumberingConfig(tpl.page_numbering_config);
      }
    });
  }, [id, isEdit]);

  const toggleBlockType = (type) => {
    setBlockTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const updateIdentityField = (index, val) => {
    setIdentityFields((prev) => prev.map((f, i) => (i === index ? val : f)));
  };

  const removeIdentityField = (index) => {
    setIdentityFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name,
      structure_config: {
        identity_fields: identityFields.filter(Boolean),
        chapter_block_types: blockTypes,
      },
    };

    try {
      let template;
      if (isEdit) {
        template = await updateTemplate(id, payload);
      } else {
        template = await createTemplate(payload);
      }
      await updatePageNumbering(template.id, numberingConfig);
      navigate('/publisher/layout/templates');
    } catch (err) {
      setError('Gagal menyimpan template. Periksa kembali isian Anda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-xl font-medium text-neutral-900">
        {isEdit ? 'Edit template' : 'Buat template baru'}
      </h1>

      <form onSubmit={handleSave} className="space-y-8">
        <section>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Nama template</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Buku Ajar Standar"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700">
            Field identitas buku
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Field yang wajib diisi staff di halaman identitas, mis. nama penulis, editor, desainer.
          </p>
          <div className="space-y-2">
            {identityFields.map((field, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={field}
                  onChange={(e) => updateIdentityField(index, e.target.value)}
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeIdentityField(index)}
                  className="rounded-md border border-neutral-300 px-3 text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  Hapus
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setIdentityFields((prev) => [...prev, ''])}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
            >
              + Tambah field
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700">
            Tipe blok yang tersedia saat menyusun bab
          </h2>
          <div className="flex flex-wrap gap-3">
            {BLOCK_TYPE_OPTIONS.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={blockTypes.includes(type)}
                  onChange={() => toggleBlockType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700">Penomoran halaman</h2>
          <PageNumberingEditor value={numberingConfig} onChange={setNumberingConfig} />
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/publisher/layout/templates')}
            className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan template'}
          </button>
        </div>
      </form>
    </div>
  );
}
