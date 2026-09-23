import { useState, type ChangeEvent } from 'react';
import Input from '@/components/Input/Input';
import { ApiError } from '@/lib/http';
import * as uploadApi from '@/data/upload/uploadApi';
import type { ImageFolder } from '@/data/upload/uploadApi';

type ImageInputProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    folder?: ImageFolder;
    placeholder?: string;
};

export default function ImageInput({
    label,
    value,
    onChange,
    folder,
    placeholder = 'https://...',
}: ImageInputProps) {
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
            const response = await uploadApi.uploadImage(file, folder);
            onChange(response.data.url);
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal mengunggah gambar.'
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Input
                label={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
            <div className="flex flex-row items-center gap-3">
                <label className="text-white/60 text-xs shrink-0">
                    atau unggah file:
                </label>
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="text-white text-xs w-full"
                />
                {isUploading && (
                    <span className="text-white/60 text-xs shrink-0">
                        Mengunggah...
                    </span>
                )}
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {value && (
                <img
                    src={value}
                    alt=""
                    className="h-20 w-20 object-cover rounded-lg ring-1 ring-white/20"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                    onLoad={(e) => {
                        e.currentTarget.style.display = '';
                    }}
                />
            )}
        </div>
    );
}
