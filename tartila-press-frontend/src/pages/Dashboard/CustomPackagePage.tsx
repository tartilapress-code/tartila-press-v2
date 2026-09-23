import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as customPackageItemApi from '@/data/customPackageItem/customPackageItemApi';
import * as editorApi from '@/data/editor/editorApi';
import * as orderApi from '@/data/order/orderApi';
import { ApiError } from '@/lib/http';

type CustomItem = {
    id: number;
    type: 'facility' | 'service';
    name: string;
    price: string;
    description: string | null;
};

type EditorItem = {
    user_id: number;
    name: string;
    fee: string;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function CustomPackagePage() {
    const navigate = useNavigate();

    const [items, setItems] = useState<CustomItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [wantsOwnEditor, setWantsOwnEditor] = useState<boolean>(false);
    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [selectedEditorId, setSelectedEditorId] = useState<number | null>(
        null
    );

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        customPackageItemApi
            .list()
            .then((response) => setItems(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (wantsOwnEditor && editors.length === 0) {
            editorApi
                .directory()
                .then((response) => setEditors(response.data));
        }
    }, [wantsOwnEditor, editors.length]);

    function toggleItem(id: number) {
        setSelectedIds((prev) =>
            prev.includes(id)
                ? prev.filter((itemId) => itemId !== id)
                : [...prev, id]
        );
    }

    const facilities = items.filter((item) => item.type === 'facility');
    const services = items.filter((item) => item.type === 'service');

    const itemsTotal = items
        .filter((item) => selectedIds.includes(item.id))
        .reduce((sum, item) => sum + Number(item.price), 0);

    const selectedEditor = editors.find(
        (editor) => editor.user_id === selectedEditorId
    );
    const editorFee = selectedEditor ? Number(selectedEditor.fee) : 0;
    const total = itemsTotal + editorFee;

    async function handleSubmit() {
        if (selectedIds.length === 0) {
            setErrorMessage('Pilih minimal 1 fasilitas atau layanan.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            await orderApi.create({
                type: 'custom',
                custom_item_ids: selectedIds,
                editor_id:
                    wantsOwnEditor && selectedEditorId
                        ? selectedEditorId
                        : undefined,
            });
            navigate('/dashboard/pesanan');
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    function renderItemGroup(title: string, group: CustomItem[]) {
        return (
            <div className="flex flex-col gap-2">
                <h5 className="text-white text-lg font-semibold">{title}</h5>
                {group.length === 0 ? (
                    <p className="text-white/60 text-sm">Belum ada item.</p>
                ) : (
                    group.map((item) => (
                        <label
                            key={item.id}
                            className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-3 text-white cursor-pointer"
                        >
                            <div className="flex flex-row items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                />
                                <span>{item.name}</span>
                            </div>
                            <span className="text-forest-moss-300 text-sm">
                                {rupiahFormatter.format(Number(item.price))}
                            </span>
                        </label>
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6 max-w-xl">
            <div>
                <h5 className="text-white text-xl font-semibold">
                    Rakit Paket Custom
                </h5>
                <p className="text-white/70 text-sm">
                    Pilih fasilitas dan layanan sesuai kebutuhan Anda.
                </p>
            </div>

            {renderItemGroup('Fasilitas', facilities)}
            {renderItemGroup('Layanan', services)}

            <label className="flex flex-row items-center gap-2 text-white pt-2">
                <input
                    type="checkbox"
                    checked={wantsOwnEditor}
                    onChange={(e) => {
                        setWantsOwnEditor(e.target.checked);
                        setSelectedEditorId(null);
                    }}
                />
                Saya ingin memilih editor sendiri (biaya tambahan)
            </label>

            {wantsOwnEditor && (
                <div className="flex flex-col gap-2">
                    {editors.length === 0 ? (
                        <p className="text-white/70 text-sm">
                            Belum ada editor yang tersedia.
                        </p>
                    ) : (
                        editors.map((editor) => (
                            <label
                                key={editor.user_id}
                                className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-3 text-white cursor-pointer"
                            >
                                <div className="flex flex-row items-center gap-2">
                                    <input
                                        type="radio"
                                        name="editor"
                                        checked={
                                            selectedEditorId ===
                                            editor.user_id
                                        }
                                        onChange={() =>
                                            setSelectedEditorId(
                                                editor.user_id
                                            )
                                        }
                                    />
                                    <span>{editor.name}</span>
                                </div>
                                <span className="text-forest-moss-300 text-sm">
                                    +{rupiahFormatter.format(
                                        Number(editor.fee)
                                    )}
                                </span>
                            </label>
                        ))
                    )}
                </div>
            )}

            <div className="border-t border-white/20 pt-4">
                <p className="text-white text-lg font-semibold">
                    Total: {rupiahFormatter.format(total)}
                </p>
            </div>

            {errorMessage && (
                <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Memproses...' : 'Ambil Paket Custom'}
            </Button>
        </div>
    );
}
