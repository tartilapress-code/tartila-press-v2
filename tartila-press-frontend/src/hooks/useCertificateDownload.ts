import { useState } from 'react';
import * as certificateApi from '@/data/certificate/certificateApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';

/**
 * Downloading (or previewing) a certificate PDF through the authenticated
 * API, with a busy flag per certificate and the last error message.
 */
export function useCertificateDownload() {
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string>('');

    async function download(id: number): Promise<void> {
        setBusyId(id);
        setError('');

        try {
            const { blob, filename } =
                await certificateApi.downloadCertificate(id);

            saveBlob(blob, filename ?? 'sertifikat.pdf');
        } catch (failure) {
            setError(describeApiError(failure, 'Sertifikat gagal diunduh.'));
        } finally {
            setBusyId(null);
        }
    }

    /** Fetches the PDF and returns an object URL to show in a viewer. */
    async function preview(id: number): Promise<string | null> {
        setBusyId(id);
        setError('');

        try {
            const { blob } = await certificateApi.downloadCertificate(id, true);

            return URL.createObjectURL(blob);
        } catch (failure) {
            setError(describeApiError(failure, 'Sertifikat gagal dibuka.'));

            return null;
        } finally {
            setBusyId(null);
        }
    }

    return { busyId, error, download, preview };
}
