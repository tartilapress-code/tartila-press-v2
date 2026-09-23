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
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <h5 className="text-white text-xl font-semibold">
                Permintaan Role Menunggu Persetujuan
            </h5>

            {errorMessage && (
                <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
            ) : requests.length === 0 ? (
                <p className="text-white/70 text-sm">
                    Tidak ada permintaan yang menunggu.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {requests.map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-white font-semibold">
                                    {item.user.name}{' '}
                                    <span className="text-white/60 font-normal">
                                        ({item.user.email})
                                    </span>
                                </p>
                                <p className="text-white/70 text-sm">
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
