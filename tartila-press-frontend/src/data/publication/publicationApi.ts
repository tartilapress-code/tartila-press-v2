import { http } from '@/lib/http';

// Riwayat status proses penerbitan: Terbitkan Naskah (ISBN), HAKI, buku fisik.

export type StepState = 'done' | 'current' | 'pending' | 'rejected';

export type PublicationStep = {
    key: string;
    label: string;
    state: StepState;
    at: string | null;
    // Pengajuan ISBN
    receipt?: string | null;
    tracking_url?: string;
    // ISBN ditolak
    note?: string | null;
    // ISBN terbit
    isbn?: string | null;
    // HAKI
    application_number?: string | null;
    registration_number?: string | null;
    has_certificate?: boolean;
};

export type PublicationSection = {
    key: 'isbn' | 'hki' | 'physical';
    title: string;
    included: boolean;
    steps: PublicationStep[];
    note?: string | null;
};

export type PublicationProgress = {
    subject: string;
    title: string | null;
    completed: boolean;
    completed_at: string | null;
    current: string;
    sections: PublicationSection[];
    includes: {
        hki: boolean;
        physical: boolean;
        physical_auto: boolean;
        physical_override: boolean | null;
    };
    history: {
        stage: string;
        label: string;
        note: string | null;
        at: string | null;
    }[];
    can_confirm_delivery?: boolean;
};

export type PhysicalStep = 'printed' | 'shipped' | 'delivered';

/** Penulis: null bila naskah belum sampai tahap penerbitan. */
export const forManuscript = (
    manuscriptId: number | string
): Promise<{ data: PublicationProgress | null }> =>
    http.get(`/manuscripts/${manuscriptId}/publication-progress`);

export const confirmDelivery = (
    manuscriptId: number | string
): Promise<{ data: PublicationProgress | null }> =>
    http.post(
        `/manuscripts/${manuscriptId}/publication-progress/confirm-delivery`
    );

// --- Admin (per surat ISBN di Terbitkan Naskah) --------------------------------

export const adminProgress = (
    applicationId: number
): Promise<{ data: PublicationProgress }> =>
    http.get(`/admin/isbn-applications/${applicationId}/process`);

export const adminIsbn = (
    applicationId: number,
    payload: {
        action: 'submit' | 'reject' | 'publish';
        receipt?: string;
        isbn?: string;
        note?: string;
    }
): Promise<{ data: PublicationProgress }> =>
    http.post(
        `/admin/isbn-applications/${applicationId}/process/isbn`,
        payload
    );

export const adminPhysical = (
    applicationId: number,
    payload: { step: PhysicalStep | null; note?: string }
): Promise<{ data: PublicationProgress }> =>
    http.post(
        `/admin/isbn-applications/${applicationId}/process/physical`,
        payload
    );

export const adminSettings = (
    applicationId: number,
    payload: { includes_physical: boolean | null }
): Promise<{ data: PublicationProgress }> =>
    http.patch(
        `/admin/isbn-applications/${applicationId}/process/settings`,
        payload
    );
