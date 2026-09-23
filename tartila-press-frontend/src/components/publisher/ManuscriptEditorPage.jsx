// src/features/publisher/draftEditing/ManuscriptEditorPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getManuscript, listChapters, updateManuscript } from '../api/publisherApi';
import ChapterSidebar from './ChapterSidebar';
import ContentBlockEditor from './ContentBlockEditor';

export default function ManuscriptEditorPage() {
  const { id } = useParams();
  const [manuscript, setManuscript] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [tab, setTab] = useState('identity'); // identity | chapters

  const loadManuscript = () => {
    getManuscript(id).then((m) => {
      setManuscript(m);
      setChapters(m.chapters ?? []);
    });
  };

  const loadChapters = () => {
    listChapters(id).then(setChapters);
  };

  useEffect(loadManuscript, [id]);

  if (!manuscript) return <p className="px-6 py-8 text-sm text-neutral-500">Memuat naskah...</p>;

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? chapters[0];
  const allowedBlockTypes = manuscript.template?.structure_config?.chapter_block_types ?? [
    'heading',
    'paragraph',
    'image',
    'table',
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-neutral-900">{manuscript.title}</h1>
        <p className="text-sm text-neutral-500">Template: {manuscript.template?.name}</p>
      </div>

      <div className="mb-6 flex gap-6 border-b border-neutral-200">
        <TabButton active={tab === 'identity'} onClick={() => setTab('identity')}>
          Identitas & kata pengantar
        </TabButton>
        <TabButton active={tab === 'chapters'} onClick={() => setTab('chapters')}>
          Bab
        </TabButton>
      </div>

      {tab === 'identity' && (
        <IdentityForm manuscript={manuscript} onSaved={setManuscript} />
      )}

      {tab === 'chapters' && (
        <div className="flex gap-6">
          <ChapterSidebar
            manuscriptId={id}
            chapters={chapters}
            activeChapterId={activeChapter?.id}
            onSelect={setActiveChapterId}
            onChange={loadChapters}
          />
          {activeChapter ? (
            <ContentBlockEditor chapter={activeChapter} allowedBlockTypes={allowedBlockTypes} />
          ) : (
            <p className="flex-1 pl-6 text-sm text-neutral-500">
              Tambahkan bab pertama di sisi kiri.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
        active
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}

function IdentityForm({ manuscript, onSaved }) {
  const identityFields = manuscript.template?.structure_config?.identity_fields ?? [];
  const [values, setValues] = useState({
    author: manuscript.metadata?.author ?? '',
    editor: manuscript.metadata?.editor ?? '',
    designer: manuscript.metadata?.designer ?? '',
    foreword: manuscript.metadata?.foreword ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateManuscript(manuscript.id, { metadata: values });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      {identityFields.length === 0 && (
        <p className="text-sm text-neutral-500">
          Template ini belum mendefinisikan field identitas.
        </p>
      )}

      <Field label="Nama penulis" value={values.author} onChange={(v) => setValues((s) => ({ ...s, author: v }))} />
      <Field label="Nama editor" value={values.editor} onChange={(v) => setValues((s) => ({ ...s, editor: v }))} />
      <Field label="Nama desainer" value={values.designer} onChange={(v) => setValues((s) => ({ ...s, designer: v }))} />

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-neutral-700">Kata pengantar</span>
        <textarea
          rows={8}
          value={values.foreword}
          onChange={(e) => setValues((s) => ({ ...s, foreword: e.target.value }))}
          placeholder="Paste naskah kata pengantar di sini..."
          className="w-full resize-y rounded-md border border-neutral-300 p-3 text-sm"
        />
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
