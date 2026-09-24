import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as packageApi from '@/data/package/packageApi';
import * as editorApi from '@/data/editor/editorApi';
import * as orderApi from '@/data/order/orderApi';
import { ApiError } from '@/lib/http';

type PackageSummary = {
    id: number;
    name: string;
    final_price: number;
};

type EditorItem = {
    user_id: number;
    name: string;
    fee: string;
    bio: string | null;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function TakePackagePage() {
    const { packageId } = useParams<{ packageId: string }>();
    const navigate = useNavigate();

    const [pkg, setPkg] = useState<PackageSummary | null>(null);
    const [wantsOwnEditor, setWantsOwnEditor] = useState<boolean>(false);
    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [selectedEditorId, setSelectedEditorId] = useState<number | null>(
        null
    );
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        packageApi
            .get(packageId ?? '')
            .then((response) => setPkg(response.data))
            .finally(() => setIsLoading(false));
    }, [packageId]);

    useEffect(() => {
        if (wantsOwnEditor && editors.length === 0) {
            editorApi
                .directory()
                .then((response) => setEditors(response.data));
        }
    }, [wantsOwnEditor, editors.length]);

    const selectedEditor = editors.find(
        (editor) => editor.user_id === selectedEditorId
    );
    const editorFee = selectedEditor ? Number(selectedEditor.fee) : 0;
    const total = (pkg?.final_price ?? 0) + editorFee;

    async function handleSubmit() {
        if (!pkg) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            await orderApi.create({
                type: 'package',
                package_id: pkg.id,
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

    if (!pkg) {
        return <p className="text-oxford-navy-900">Paket tidak ditemukan.</p>;
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 max-w-xl">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Ambil Paket: {pkg.name}
            </h5>

            <p className="text-oxford-navy-900/80">
                Harga paket: {rupiahFormatter.format(pkg.final_price)}
            </p>

            <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
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
                        <p className="text-oxford-navy-900/70 text-sm">
                            Belum ada editor yang tersedia.
                        </p>
                    ) : (
                        editors.map((editor) => (
                            <label
                                key={editor.user_id}
                                className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3 text-oxford-navy-900 cursor-pointer"
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
                                <span className="text-forest-moss-700 text-sm">
                                    +{rupiahFormatter.format(
                                        Number(editor.fee)
                                    )}
                                </span>
                            </label>
                        ))
                    )}
                </div>
            )}

            <div className="border-t border-forest-moss-200 pt-4">
                <p className="text-oxford-navy-900 text-lg font-semibold">
                    Total: {rupiahFormatter.format(total)}
                </p>
            </div>

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Ambil Paket'}
            </Button>
        </div>
    );
}
