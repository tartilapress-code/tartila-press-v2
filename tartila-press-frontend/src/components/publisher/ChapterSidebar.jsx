// src/features/publisher/draftEditing/ChapterSidebar.jsx
import { useState } from 'react';
import { createChapter, deleteChapter, reorderChapters } from '../api/publisherApi';

export default function ChapterSidebar({
  manuscriptId,
  chapters,
  activeChapterId,
  onSelect,
  onChange,
}) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const chapter = await createChapter(manuscriptId, { title: newTitle });
      setNewTitle('');
      onChange();
      onSelect(chapter.id);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (chapterId) => {
    if (!window.confirm('Hapus bab ini beserta seluruh isinya?')) return;
    await deleteChapter(manuscriptId, chapterId);
    onChange();
  };

  const move = async (index, direction) => {
    const next = [...chapters];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderChapters(manuscriptId, next.map((c) => c.id));
    onChange();
  };

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 pr-4">
      <p className="mb-3 text-sm font-medium text-neutral-700">Bab</p>

      <ul className="space-y-1">
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className="group flex items-center gap-1">
            <button
              onClick={() => onSelect(chapter.id)}
              className={`flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm ${
                chapter.id === activeChapterId
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {chapter.title}
            </button>
            <div className="hidden shrink-0 gap-0.5 group-hover:flex">
              <button
                onClick={() => move(index, -1)}
                className="px-1 text-xs text-neutral-400 hover:text-neutral-700"
                title="Naikkan"
              >
                ↑
              </button>
              <button
                onClick={() => move(index, 1)}
                className="px-1 text-xs text-neutral-400 hover:text-neutral-700"
                title="Turunkan"
              >
                ↓
              </button>
              <button
                onClick={() => handleDelete(chapter.id)}
                className="px-1 text-xs text-red-400 hover:text-red-600"
                title="Hapus"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="mt-3 flex gap-1">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Judul bab baru"
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={adding}
          className="shrink-0 rounded-md border border-neutral-300 px-2 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          +
        </button>
      </form>
    </aside>
  );
}
