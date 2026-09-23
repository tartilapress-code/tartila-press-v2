// src/features/publisher/layout/TemplateListPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTemplates, deleteTemplate } from '../api/publisherApi';

export default function TemplateListPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    listTemplates()
      .then((res) => setTemplates(res.data ?? res))
      .catch(() => setError('Gagal memuat daftar template.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus template ini? Tindakan tidak bisa dibatalkan.')) return;
    try {
      await deleteTemplate(id);
      load();
    } catch (err) {
      const message = err?.response?.data?.message ?? 'Template tidak bisa dihapus.';
      alert(message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Template buku</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Rancang struktur bagian, field identitas, dan penomoran halaman.
          </p>
        </div>
        <Link
          to="/publisher/layout/templates/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Buat template
        </Link>
      </div>

      {loading && <p className="text-sm text-neutral-500">Memuat...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-500">Belum ada template. Buat yang pertama.</p>
        </div>
      )}

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {templates.map((tpl) => (
          <li key={tpl.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-neutral-900">{tpl.name}</p>
              <p className="text-xs text-neutral-500">
                {tpl.is_active ? 'Aktif' : 'Nonaktif'} · dibuat{' '}
                {new Date(tpl.created_at).toLocaleDateString('id-ID')}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to={`/publisher/layout/templates/${tpl.id}`}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(tpl.id)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
