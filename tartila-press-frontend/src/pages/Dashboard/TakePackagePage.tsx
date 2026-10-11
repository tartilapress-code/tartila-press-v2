import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import EditorPicker, {
    type EditorOption,
} from '@/components/editor/EditorPicker';
import * as packageApi from '@/data/package/packageApi';
import * as editorApi from '@/data/editor/editorApi';
import * as orderApi from '@/data/order/orderApi';
import VoucherField from '@/components/voucher/VoucherField';
import { useVoucher } from '@/components/voucher/useVoucher';
import { ApiError } from '@/lib/http';
import PaymentMethodPicker from '@/components/order/PaymentMethodPicker';
import { usePaymentMethodChoice } from '@/hooks/usePaymentMethodChoice';

type PackageSummary = {
    id: number;
    name: string;
    final_price: number;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function TakePackagePage() {
    const { packageId } = useParams<{ packageId: string }>();
    const navigate = useNavigate();
    const paymentChoice = usePaymentMethodChoice();

    const [pkg, setPkg] = useState<PackageSummary | null>(null);
    const [wantsOwnEditor, setWantsOwnEditor] = useState<boolean>(false);
    const [editors, setEditors] = useState<EditorOption[]>([]);
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
            editorApi.directory().then((response) => setEditors(response.data));
        }
    }, [wantsOwnEditor, editors.length]);

    const voucher = useVoucher(
        pkg ? { type: 'package', package_id: pkg.id } : null
    );

    const selectedEditor = editors.find(
        (editor) => editor.user_id === selectedEditorId
    );
    const editorFee = selectedEditor ? Number(selectedEditor.fee) : 0;
    const total =
        (pkg?.final_price ?? 0) +
        editorFee -
        (voucher.quote?.voucher_discount ?? 0);

    async function handleSubmit() {
        if (!pkg) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await orderApi.create({
                payment_method_id: paymentChoice.selectedId ?? undefined,
                type: 'package',
                package_id: pkg.id,
                voucher_code: voucher.code,
                editor_id:
                    wantsOwnEditor && selectedEditorId
                        ? selectedEditorId
                        : undefined,
            });
            navigate(`/dashboard/pesanan/${response.data.id}/invoice`);
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
                <EditorPicker
                    editors={editors}
                    selectedId={selectedEditorId}
                    onSelect={setSelectedEditorId}
                    formatFee={rupiahFormatter.format}
                />
            )}

            <VoucherField voucher={voucher} />
            <PaymentMethodPicker choice={paymentChoice} />

            <div className="flex flex-col gap-1 border-t border-forest-moss-200 pt-4">
                {voucher.quote && (
                    <p className="text-forest-moss-700 text-sm">
                        Voucher ({voucher.quote.code}): −
                        {rupiahFormatter.format(voucher.quote.voucher_discount)}
                    </p>
                )}
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
                disabled={isSubmitting || paymentChoice.isMissing}
            >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Ambil Paket'}
            </Button>
        </div>
    );
}
