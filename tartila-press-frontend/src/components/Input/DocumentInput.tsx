import { useState, type ChangeEvent } from 'react';
import { ApiError } from '@/lib/http';
import * as uploadApi from '@/data/upload/uploadApi';
import type { DocumentFolder } from '@/data/upload/uploadApi';

type DocumentInputProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    folder?: DocumentFolder;
};

export default function DocumentInput({
    label,
    value,
    onChange,
    folder,
}: DocumentInputProps) {
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file) {
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            const response = await uploadApi.uploadDocument(file, folder);
            onChange(response.data.url);
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal mengunggah dokumen.'
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-oxford-navy-900">
                {label}
            </label>
            <input
                type="file"
                accept="application/pdf,.doc,.docx,image/png,image/jpeg"
                onChange={handleFileChange}
                disabled={isUploading}
                className="w-full text-xs text-oxford-navy-900/70 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-forest-moss-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-forest-moss-800 hover:file:bg-forest-moss-200"
            />
            {isUploading && (
                <span className="text-oxford-navy-900/60 text-xs">
                    Mengunggah...
                </span>
            )}
            {error && <p className="text-red-600 text-xs">{error}</p>}
            {value && (
                <a
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-forest-moss-700 underline hover:text-forest-moss-800"
                >
                    Lihat dokumen yang sudah diunggah
                </a>
            )}
        </div>
    );
}
