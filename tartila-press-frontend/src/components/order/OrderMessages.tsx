import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import * as orderApi from '@/data/order/orderApi';
import type { OrderMessage } from '@/data/order/orderApi';
import { ApiError } from '@/lib/http';

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function OrderMessages({
    orderId,
    canSend,
}: {
    orderId: number;
    canSend: boolean;
}) {
    const [messages, setMessages] = useState<OrderMessage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [body, setBody] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        orderApi
            .listMessages(orderId)
            .then((response) => setMessages(response.data))
            .finally(() => setIsLoading(false));
    }, [orderId]);

    async function handleSend() {
        if (!body.trim()) {
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const response = await orderApi.sendMessage(orderId, body);
            setMessages((previous) => [...previous, response.data]);
            setBody('');
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : 'Gagal mengirim pesan.'
            );
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-3">
            <p className="text-oxford-navy-900 font-semibold text-sm">Pesan ke Admin</p>

            {isLoading ? (
                <p className="text-oxford-navy-900/55 text-xs">Memuat...</p>
            ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                    {messages.length === 0 && (
                        <p className="text-oxford-navy-900/55 text-xs">
                            Belum ada pesan.
                        </p>
                    )}
                    {messages.map((message) => (
                        <div key={message.id} className="text-xs">
                            <span className="text-oxford-navy-900/55">
                                {message.is_admin
                                    ? 'Admin'
                                    : message.user.name}{' '}
                                ·{' '}
                                {dateTimeFormatter.format(
                                    new Date(message.created_at)
                                )}
                                :
                            </span>{' '}
                            <span className="text-oxford-navy-900/80">
                                {message.body}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {canSend ? (
                <div className="flex flex-row gap-2">
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={2}
                        placeholder="Tulis pesan atau pertanyaan..."
                        className="flex-1 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-forest-moss-50 text-oxford-navy-900 text-xs outline-none"
                    />
                    <Button
                        variant="primary"
                        onClick={handleSend}
                        disabled={isSending}
                    >
                        {isSending ? 'Mengirim...' : 'Kirim'}
                    </Button>
                </div>
            ) : (
                <p className="text-oxford-navy-900/55 text-xs">
                    Pesanan sudah selesai, tidak bisa mengirim pesan baru.
                </p>
            )}

            {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
    );
}
