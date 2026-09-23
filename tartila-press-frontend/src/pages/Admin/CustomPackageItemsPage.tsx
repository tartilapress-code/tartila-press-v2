import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

type ItemRecord = {
    id: number;
    type: 'facility' | 'service';
    name: string;
    price: string;
    is_active: boolean;
};

const typeOptions = [
    { value: 'facility', label: 'Fasilitas' },
    { value: 'service', label: 'Layanan' },
];

export default function CustomPackageItemsPage() {
    const [items, setItems] = useState<ItemRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [type, setType] = useState<'facility' | 'service'>('facility');
    const [name, setName] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function loadItems() {
        adminApi
            .listCustomItems()
            .then((response) => setItems(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        loadItems();
    }, []);

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await adminApi.createCustomItem({ type, name, price });
            setName('');
            setPrice('');
            loadItems();
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

    async function handleToggleActive(item: ItemRecord) {
        await adminApi.updateCustomItem(item.id, {
            is_active: !item.is_active,
        });
        loadItems();
    }

    async function handleDelete(id: number) {
        await adminApi.deleteCustomItem(id);
        loadItems();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Tambah Item Paket Custom
                </h5>

                <Select
                    name="type"
                    label="Tipe"
                    option_data={typeOptions}
                    value={type}
                    onChange={(e) =>
                        setType(e.target.value as 'facility' | 'service')
                    }
                />
                <Input
                    label="Nama"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <Input
                    label="Harga"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                />

                {statusMessage && (
                    <p className="text-red-400 text-sm">{statusMessage}</p>
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

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Daftar Item
                </h5>

                {isLoading ? (
                    <p className="text-white/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <div>
                                    <p className="text-white font-semibold">
                                        {item.name}{' '}
                                        {!item.is_active && (
                                            <span className="text-red-400 text-xs">
                                                (nonaktif)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-white/60 text-sm">
                                        {item.type === 'facility'
                                            ? 'Fasilitas'
                                            : 'Layanan'}{' '}
                                        — Rp {item.price}
                                    </p>
                                </div>
                                <div className="flex flex-row gap-2 shrink-0">
                                    <Button
                                        variant="outline2"
                                        onClick={() =>
                                            handleToggleActive(item)
                                        }
                                    >
                                        {item.is_active
                                            ? 'Nonaktifkan'
                                            : 'Aktifkan'}
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() => handleDelete(item.id)}
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
