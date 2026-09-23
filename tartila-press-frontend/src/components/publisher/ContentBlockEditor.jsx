// src/features/publisher/draftEditing/ContentBlockEditor.jsx
import { useEffect, useState } from 'react';
import {
  createBlock,
  deleteBlock,
  listBlocks,
  reorderBlocks,
  updateBlock,
} from '../api/publisherApi';

const TYPE_LABEL = {
  heading: 'Anak judul',
  paragraph: 'Paragraf',
  image: 'Gambar',
  table: 'Tabel',
  quote: 'Kutipan',
  citation: 'Sitasi',
};

export default function ContentBlockEditor({ chapter, allowedBlockTypes }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listBlocks(chapter.id)
      .then(setBlocks)
      .finally(() => setLoading(false));
  };

  useEffect(load, [chapter.id]);

  const addBlock = async (type) => {
    const defaultContent =
      type === 'table' ? { rows: [['', ''], ['', '']] } : type === 'image' ? { url: '' } : { text: '' };
    await createBlock(chapter.id, { type, content: defaultContent });
    load();
  };

  const saveBlock = async (block, content) => {
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, content } : b)));
    await updateBlock(chapter.id, block.id, { content });
  };

  const removeBlock = async (blockId) => {
    if (!window.confirm('Hapus blok ini?')) return;
    await deleteBlock(chapter.id, blockId);
    load();
  };

  const move = async (index, direction) => {
    const next = [...blocks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    await reorderBlocks(chapter.id, next.map((b) => b.id));
  };

  if (loading) return <p className="text-sm text-neutral-500">Memuat isi bab...</p>;

  return (
    <div className="flex-1 pl-6">
      <h2 className="mb-4 text-lg font-medium text-neutral-900">{chapter.title}</h2>

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            onSave={(content) => saveBlock(block, content)}
            onRemove={() => removeBlock(block.id)}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
        <span className="pt-1.5 text-xs text-neutral-500">Tambah blok:</span>
        {allowedBlockTypes.map((type) => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            + {TYPE_LABEL[type] ?? type}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockRow({ block, onSave, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="group relative rounded-lg border border-neutral-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-neutral-400">
          {TYPE_LABEL[block.type] ?? block.type}
        </span>
        <div className="hidden gap-2 group-hover:flex">
          <button onClick={onMoveUp} className="text-xs text-neutral-400 hover:text-neutral-700">
            ↑
          </button>
          <button onClick={onMoveDown} className="text-xs text-neutral-400 hover:text-neutral-700">
            ↓
          </button>
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">
            Hapus
          </button>
        </div>
      </div>

      <BlockBody block={block} onSave={onSave} />
    </div>
  );
}

function BlockBody({ block, onSave }) {
  if (block.type === 'heading') {
    return (
      <input
        defaultValue={block.content?.text ?? ''}
        onBlur={(e) => onSave({ text: e.target.value })}
        placeholder="Anak judul"
        className="w-full border-0 border-b border-transparent text-base font-medium text-neutral-900 focus:border-neutral-300 focus:outline-none"
      />
    );
  }

  if (block.type === 'image') {
    return <ImageBlockBody block={block} onSave={onSave} />;
  }

  if (block.type === 'table') {
    return <TableBlockBody block={block} onSave={onSave} />;
  }

  // paragraph, quote, citation — semua tekstual biasa.
  // Paste dari Word akan masuk sebagai plain text; markup kaya (bold, list dsb)
  // bisa ditambahkan belakangan dengan mengganti textarea ini jadi editor Tiptap.
  return (
    <textarea
      defaultValue={block.content?.text ?? ''}
      onBlur={(e) => onSave({ text: e.target.value })}
      rows={4}
      placeholder="Paste naskah di sini..."
      className="w-full resize-y rounded-md border border-neutral-200 p-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none"
    />
  );
}

function ImageBlockBody({ block, onSave }) {
  const [preview, setPreview] = useState(block.content?.url ?? '');

  const handlePaste = (e) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    const reader = new FileReader();
    reader.onload = () => {
      // TODO: ganti dengan upload ke storage backend, simpan URL hasil upload.
      // Untuk sekarang disimpan sebagai data URL supaya langsung bisa dipreview.
      setPreview(reader.result);
      onSave({ url: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div onPaste={handlePaste} className="rounded-md border border-dashed border-neutral-300 p-3">
      {preview ? (
        <img src={preview} alt="" className="max-h-64 rounded-md" />
      ) : (
        <p className="py-6 text-center text-sm text-neutral-400">
          Klik area ini lalu tempel gambar (Ctrl+V)
        </p>
      )}
    </div>
  );
}

function TableBlockBody({ block, onSave }) {
  const [rows, setRows] = useState(block.content?.rows ?? [['', '']]);

  const updateCell = (r, c, value) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
    setRows(next);
    onSave({ rows: next });
  };

  const addRow = () => {
    const next = [...rows, rows[0].map(() => '')];
    setRows(next);
    onSave({ rows: next });
  };

  const addColumn = () => {
    const next = rows.map((row) => [...row, '']);
    setRows(next);
    onSave({ rows: next });
  };

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-neutral-200 p-0">
                  <input
                    value={cell}
                    onChange={(e) => updateCell(r, c, e.target.value)}
                    className="w-full px-2 py-1.5 focus:outline-none"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex gap-2">
        <button onClick={addRow} className="text-xs text-neutral-500 hover:text-neutral-800">
          + Baris
        </button>
        <button onClick={addColumn} className="text-xs text-neutral-500 hover:text-neutral-800">
          + Kolom
        </button>
      </div>
    </div>
  );
}
