import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

type PaymentMethodRecord = {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder_name: string;
    is_active: boolean;
};

export default function PaymentMethodsPage() {
    const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [bankName, setBankName] = useState<string>('');
    const [accountNumber, setAccountNumber] = useState<string>('');
    const [accountHolderName, setAccountHolderName] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function loadMethods() {
        adminApi
            .listPaymentMethodsAdmin()
            .then((response) => setMethods(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        loadMethods();
    }, []);

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await adminApi.createPaymentMethod({
                bank_name: bankName,
                account_number: accountNumber,
                account_holder_name: accountHolderName,
            });
            setBankName('');
            setAccountNumber('');
            setAccountHolderName('');
            loadMethods();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleToggleActive(method: PaymentMethodRecord) {
        await adminApi.updatePaymentMethod(method.id, {
            is_active: !method.is_active,
        });
        loadMethods();
    }

    async function handleDelete(id: number) {
        await adminApi.deletePaymentMethod(id);
        loadMethods();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Tambah Metode Pembayaran
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Rekening di sini akan ditampilkan ke pembeli sebagai
                    tujuan transfer saat checkout.
                </p>

                <Input
                    label="Nama Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="BCA"
                    required
                />
                <Input
                    label="Nomor Rekening"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                />
                <Input
                    label="Nama Pemilik Rekening"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    required
                />

                {statusMessage && (
                    <p className="text-red-600 text-sm">{statusMessage}</p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Tambah'}
                </Button>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Daftar Metode Pembayaran
                </h5>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : methods.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada metode pembayaran.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {methods.map((method) => (
                            <div
                                key={method.id}
                                className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <div>
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {method.bank_name}{' '}
                                        {!method.is_active && (
                                            <span className="text-red-600 text-xs">
                                                (nonaktif)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        {method.account_number} a.n.{' '}
                                        {method.account_holder_name}
                                    </p>
                                </div>
                                <div className="flex flex-row gap-2 shrink-0">
                                    <Button
                                        variant="outline2"
                                        onClick={() =>
                                            handleToggleActive(method)
                                        }
                                    >
                                        {method.is_active
                                            ? 'Nonaktifkan'
                                            : 'Aktifkan'}
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() =>
                                            handleDelete(method.id)
                                        }
                                    >
                                        Hapus
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
