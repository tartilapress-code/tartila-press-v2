import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Badge from '@/components/Badge';
import Button from '@/components/Button/Button';
import CoauthorOffer from '@/components/coauthor/CoauthorOffer';
import { useCoauthorOffer } from '@/components/coauthor/useCoauthorOffer';
import EditorPicker, {
    type EditorOption,
} from '@/components/editor/EditorPicker';
import * as customPackageItemApi from '@/data/customPackageItem/customPackageItemApi';
import type { CustomItem } from '@/data/customPackageItem/customPackageItemApi';
import * as editorApi from '@/data/editor/editorApi';
import * as orderApi from '@/data/order/orderApi';
import VoucherField from '@/components/voucher/VoucherField';
import { useVoucher } from '@/components/voucher/useVoucher';
import { ApiError } from '@/lib/http';
import PaymentMethodPicker from '@/components/order/PaymentMethodPicker';
import { usePaymentMethodChoice } from '@/hooks/usePaymentMethodChoice';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function CustomPackagePage() {
    const navigate = useNavigate();
    const paymentChoice = usePaymentMethodChoice();
    const [searchParams] = useSearchParams();

    const [items, setItems] = useState<CustomItem[]>([]);
    // Terpilih lebih dulu dari halaman Layanan (?item=1&item=6); id yang tidak
    // ada di daftar item diabaikan.
    const [selectedIds, setSelectedIds] = useState<number[]>(() =>
        [...new Set(searchParams.getAll('item').map(Number))].filter((id) =>
            Number.isInteger(id)
        )
    );
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const coauthorOffer = useCoauthorOffer();
    const [wantsOwnEditor, setWantsOwnEditor] = useState<boolean>(false);
    const [editors, setEditors] = useState<EditorOption[]>([]);
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
            editorApi.directory().then((response) => setEditors(response.data));
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

    const selectedItems = items.filter((item) => selectedIds.includes(item.id));

    const subtotal = selectedItems.reduce(
        (sum, item) => sum + Number(item.price),
        0
    );
    // Dibulatkan ke sen supaya sisa desimal float tidak ikut tampil.
    const discountTotal =
        Math.round(
            selectedItems.reduce(
                (sum, item) => sum + (Number(item.price) - item.final_price),
                0
            ) * 100
        ) / 100;

    const voucher = useVoucher(
        selectedItems.length > 0
            ? {
                  type: 'custom',
                  custom_item_ids: selectedItems.map((item) => item.id),
              }
            : null
    );

    const selectedEditor = editors.find(
        (editor) => editor.user_id === selectedEditorId
    );
    const editorFee = selectedEditor ? Number(selectedEditor.fee) : 0;
    const total =
        subtotal -
        discountTotal -
        (voucher.quote?.voucher_discount ?? 0) +
        editorFee +
        coauthorOffer.fee;

    async function handleSubmit() {
        if (selectedItems.length === 0) {
            setErrorMessage('Pilih minimal 1 fasilitas atau layanan.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await orderApi.create({
                payment_method_id: paymentChoice.selectedId ?? undefined,
                type: 'custom',
                custom_item_ids: selectedItems.map((item) => item.id),
                voucher_code: voucher.code,
                ...coauthorOffer.payload,
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

    function renderItemGroup(title: string, group: CustomItem[]) {
        return (
            <div className="flex flex-col gap-2">
                <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                    {title}
                </h5>
                {group.length === 0 ? (
                    <p className="text-oxford-navy-900/65 text-sm">
                        Belum ada item.
                    </p>
                ) : (
                    group.map((item) => (
                        <label
                            key={item.id}
                            className="flex flex-row items-start justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3 text-oxford-navy-900 cursor-pointer"
                        >
                            <div className="flex flex-row items-start gap-2">
                                <input
                                    type="checkbox"
                                    className="mt-1.5"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                />
                                <div className="flex flex-col gap-0.5">
                                    <span>{item.name}</span>
                                    {item.description && (
                                        <span className="text-oxford-navy-900/65 text-sm whitespace-pre-line">
                                            {item.description}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                {item.discount > 0 && (
                                    <span className="text-oxford-navy-900/45 line-through text-xs">
                                        {rupiahFormatter.format(
                                            Number(item.price)
                                        )}
                                    </span>
                                )}
                                <span className="text-forest-moss-700 text-sm">
                                    {rupiahFormatter.format(item.final_price)}
                                </span>
                                {item.discount > 0 && (
                                    <Badge variant="primary">
                                        Diskon {item.discount}%
                                    </Badge>
                                )}
                            </div>
                        </label>
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 max-w-xl">
            <div>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Rakit Paket Custom
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Pilih fasilitas dan layanan sesuai kebutuhan Anda.
                </p>
            </div>

            {renderItemGroup('Fasilitas', facilities)}
            {renderItemGroup('Layanan', services)}

            <label className="flex flex-row items-center gap-2 text-oxford-navy-900 pt-2">
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

            <CoauthorOffer
                offer={coauthorOffer}
                formatFee={rupiahFormatter.format}
            />

            <VoucherField voucher={voucher} />
            <PaymentMethodPicker choice={paymentChoice} />

            <div className="flex flex-col gap-1 border-t border-forest-moss-200 pt-4">
                {(discountTotal > 0 ||
                    editorFee > 0 ||
                    coauthorOffer.fee > 0 ||
                    voucher.quote) && (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Subtotal: {rupiahFormatter.format(subtotal)}
                    </p>
                )}
                {discountTotal > 0 && (
                    <p className="text-forest-moss-700 text-sm">
                        Diskon: −{rupiahFormatter.format(discountTotal)}
                    </p>
                )}
                {voucher.quote && (
                    <p className="text-forest-moss-700 text-sm">
                        Voucher ({voucher.quote.code}): −
                        {rupiahFormatter.format(voucher.quote.voucher_discount)}
                    </p>
                )}
                {editorFee > 0 && (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Biaya editor: +{rupiahFormatter.format(editorFee)}
                    </p>
                )}
                {coauthorOffer.fee > 0 && (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Biaya co-author: +
                        {rupiahFormatter.format(coauthorOffer.fee)}
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
                {isSubmitting ? 'Memproses...' : 'Ambil Paket Custom'}
            </Button>
        </div>
    );
}
