// src/features/publisher/draftEditing/ManuscriptListPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createManuscript,
  listManuscripts,
  listTemplates,
  publishManuscript,
} from '../api/publisherApi';

const STATUS_LABEL = {
  draft: 'Draft',
  in_review: 'Sedang direview',
  ready: 'Siap terbit',
  published: 'Terbit',
};

export default function ManuscriptListPage() {
  const [manuscripts, setManuscripts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [publishTarget, setPublishTarget] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    listManuscripts().then((res) => setManuscripts(res.data ?? res));
  };

  useEffect(() => {
    load();
    listTemplates({ active_only: true }).then((res) => setTemplates(res.data ?? res));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Naskah</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Susun naskah dari template yang sudah dirancang.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Naskah baru
        </button>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {manuscripts.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-neutral-900">{m.title}</p>
              <p className="text-xs text-neutral-500">
                {m.template?.name} · {STATUS_LABEL[m.status] ?? m.status}
                {m.isbn ? ` · ISBN ${m.isbn}` : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to={`/publisher/draft/manuscripts/${m.id}`}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                Buka
              </Link>
              {m.status !== 'published' && (
                <button
                  onClick={() => setPublishTarget(m)}
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  Terbitkan
                </button>
              )}
            </div>
          </li>
        ))}
        {manuscripts.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-neutral-500">
            Belum ada naskah.
          </li>
        )}
      </ul>

      {showCreate && (
        <CreateManuscriptModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={(manuscript) => navigate(`/publisher/draft/manuscripts/${manuscript.id}`)}
        />
      )}

      {publishTarget && (
        <PublishModal
          manuscript={publishTarget}
          onClose={() => setPublishTarget(null)}
          onPublished={() => {
            setPublishTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateManuscriptModal({ templates, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const manuscript = await createManuscript({ title, template_id: templateId });
      onCreated(manuscript);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 className="mb-4 text-lg font-medium text-neutral-900">Naskah baru</h2>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-neutral-600">Judul naskah</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-5 block text-sm">
          <span className="mb-1 block text-neutral-600">Template</span>
          <select
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !templateId}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? 'Membuat...' : 'Buat naskah'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PublishModal({ manuscript, onClose, onPublished }) {
  const [isbn, setIsbn] = useState('');
  const [publishedBookId, setPublishedBookId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await publishManuscript(manuscript.id, {
        isbn,
        published_book_id: Number(publishedBookId),
      });
      onPublished();
    } catch {
      setError('Gagal menerbitkan naskah. Periksa ISBN dan ID buku katalog.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 className="mb-1 text-lg font-medium text-neutral-900">Terbitkan naskah</h2>
        <p className="mb-4 text-sm text-neutral-500">{manuscript.title}</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-neutral-600">ISBN</span>
          <input
            required
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-5 block text-sm">
          <span className="mb-1 block text-neutral-600">ID buku di katalog</span>
          <input
            required
            type="number"
            value={publishedBookId}
            onChange={(e) => setPublishedBookId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? 'Menerbitkan...' : 'Terbitkan'}
          </button>
        </div>
      </form>
    </div>
  );
}
