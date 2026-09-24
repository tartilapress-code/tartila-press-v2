import { useEffect, useState } from 'react';
import * as adminApi from '@/data/admin/adminApi';
import Button from '@/components/Button/Button';
import { ApiError } from '@/lib/http';

type RoleRequestItem = {
    id: number;
    requested_role: string;
    status: string;
    created_at: string;
    user: {
        id: number;
        name: string;
        email: string;
    };
};

const roleLabels: Record<string, string> = {
    penulis: 'Penulis',
    editor: 'Editor',
};

export default function RoleRequestsPage() {
    const [requests, setRequests] = useState<RoleRequestItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [processingId, setProcessingId] = useState<number | null>(null);

    useEffect(() => {
        adminApi
            .listRoleRequests('pending')
            .then((response) => setRequests(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    async function handleApprove(id: number) {
        setProcessingId(id);
        setErrorMessage('');

        try {
            await adminApi.approveRoleRequest(id);
            setRequests((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setProcessingId(null);
        }
    }

    async function handleReject(id: number) {
        setProcessingId(id);
        setErrorMessage('');

        try {
            await adminApi.rejectRoleRequest(id);
            setRequests((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setProcessingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Permintaan Role Menunggu Persetujuan
            </h5>

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : requests.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Tidak ada permintaan yang menunggu.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {requests.map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-oxford-navy-900 font-semibold">
                                    {item.user.name}{' '}
                                    <span className="text-oxford-navy-900/65 font-normal">
                                        ({item.user.email})
                                    </span>
                                </p>
                                <p className="text-oxford-navy-900/70 text-sm">
                                    Mengajukan jadi{' '}
                                    {roleLabels[item.requested_role] ??
                                        item.requested_role}
                                </p>
                            </div>
                            <div className="flex flex-row gap-2 shrink-0">
                                <Button
                                    variant="primary"
                                    onClick={() => handleApprove(item.id)}
                                    disabled={processingId === item.id}
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="outline2"
                                    onClick={() => handleReject(item.id)}
                                    disabled={processingId === item.id}
                                >
                                    Reject
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
