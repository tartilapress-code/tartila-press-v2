import { http } from '@/lib/http';

export type CertificateTemplateType = 'event' | 'publication' | 'social';
export type CertificateRole = 'author' | 'editor';
export type CertificateCategory = 'event' | CertificateRole;

export type TemplateField = {
    id: string;
    /** Free text; may contain {tokens} such as {name} or {book_title}. */
    text: string;
    /** Box of the text, as fractions (0..1) of the page width/height. */
    x: number;
    y: number;
    w: number;
    h: number;
    font: string;
    bold: boolean;
    /** Font size in points on a page whose long side is `page_long_side_pt`. */
    size: number;
    color: string;
    align: 'left' | 'center' | 'right';
    valign: 'top' | 'middle' | 'bottom';
    uppercase: boolean;
    autoFit: boolean;
};

export type CertificateTemplate = {
    id: number;
    type: CertificateTemplateType;
    name: string;
    role: CertificateRole | null;
    image_path: string;
    image_width: number;
    image_height: number;
    image_url: string;
    fields: TemplateField[];
    is_active: boolean;
    events_count?: number;
    created_at: string;
    updated_at: string;
};

export type CertificateFont = {
    key: string;
    label: string;
    category: 'serif' | 'script' | 'sans';
    ascent: number;
    descent: number;
    regular_file: string;
    bold_file: string | null;
};

export type CertificateVariable = {
    token: string;
    label: string;
    sample: string;
    sample_long: string | null;
    /** `answer_` is a prefix: the admin appends the attendance field key. */
    dynamic: boolean;
};

export type LayoutConfig = {
    page_long_side_pt: number;
    line_height: number;
    min_font_size_ratio: number;
    min_font_size_pt: number;
    step_pt: number;
    max_fields: number;
};

export type EditorMeta = {
    fonts: CertificateFont[];
    default_font: string;
    variables: Record<CertificateTemplateType, CertificateVariable[]>;
    layout: LayoutConfig;
};

export type UploadedTemplateImage = {
    path: string;
    width: number;
    height: number;
    url: string;
};

export type TemplatePayload = {
    type?: CertificateTemplateType;
    name?: string;
    role?: CertificateRole | null;
    image_path?: string;
    is_active?: boolean;
    fields?: TemplateField[];
};

export type PreviewPayload = {
    type: CertificateTemplateType;
    role?: CertificateRole | null;
    image_path: string;
    fields: TemplateField[];
    long?: boolean;
};

export type AttendanceFieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'phone'
    | 'date'
    | 'select'
    | 'radio'
    | 'checkbox';

export type AttendanceField = {
    id: number;
    key: string;
    label: string;
    type: AttendanceFieldType;
    options: string[] | null;
    required: boolean;
    help_text: string | null;
    sort_order: number;
};

export type AttendanceState = 'disabled' | 'upcoming' | 'open' | 'closed';

export type AttendanceAnswers = Record<string, string | boolean>;

/** What the admin sees/edits for one event. */
export type AdminAttendanceSettings = {
    event: {
        id: number;
        slug: string;
        title: string;
        starts_at: string;
        ends_at: string | null;
    };
    attendance_enabled: boolean;
    attendance_opens_at: string | null;
    attendance_closes_at: string | null;
    certificate_template_id: number | null;
    state: AttendanceState;
    fields: AttendanceField[];
    attendance_count: number;
    confirmed_registrations_count: number;
};

export type AttendanceFieldPayload = {
    id?: number;
    label: string;
    type: AttendanceFieldType;
    options?: string[];
    required: boolean;
    help_text?: string;
};

export type AttendanceSettingsPayload = {
    attendance_enabled: boolean;
    attendance_opens_at: string | null;
    attendance_closes_at: string | null;
    certificate_template_id: number | null;
    fields: AttendanceFieldPayload[];
};

export type AdminAttendance = {
    id: number;
    submitted_at: string;
    answers: AttendanceAnswers;
    user: { id: number; name: string; email: string };
    certificate: { id: number; number: string } | null;
};

/** What a registered participant sees for one event. */
export type ParticipantAttendance = {
    event: {
        id: number;
        slug: string;
        title: string;
        starts_at: string;
        ends_at: string | null;
    };
    state: AttendanceState;
    opens_at: string | null;
    closes_at: string | null;
    fields: AttendanceField[];
    submitted: boolean;
    submitted_at: string | null;
    answers: AttendanceAnswers | null;
    has_certificate_template: boolean;
    certificate: { id: number; number: string } | null;
};

export type MyCertificate = {
    id: number;
    number: string;
    category: CertificateCategory;
    title: string;
    subtitle: string;
    issued_at: string;
};

// --- Admin: templates -------------------------------------------------------

export const adminMeta = () => http.get('/admin/certificate-templates/meta');

export const adminList = (type?: CertificateTemplateType) =>
    http.get(
        type
            ? `/admin/certificate-templates?type=${type}`
            : '/admin/certificate-templates'
    );

/** Gambar latar templat lewat API (kanvas poster sosmed tanpa lintas-origin). */
export const adminTemplateImage = (id: number) =>
    http.fetchFile(`/admin/certificate-templates/${id}/image`);

export const adminGet = (id: number) =>
    http.get(`/admin/certificate-templates/${id}`);

export const adminUploadImage = (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    return http.upload('/admin/certificate-templates/upload-image', formData);
};

export const adminCreate = (payload: TemplatePayload) =>
    http.post('/admin/certificate-templates', payload);

export const adminUpdate = (id: number, payload: TemplatePayload) =>
    http.patch(`/admin/certificate-templates/${id}`, payload);

export const adminDelete = (id: number) =>
    http.delete(`/admin/certificate-templates/${id}`);

export const adminPreview = (payload: PreviewPayload) =>
    http.fetchFile('/admin/certificate-templates/preview', {
        method: 'POST',
        data: payload,
    });

// --- Admin: event attendance ------------------------------------------------

export const adminGetAttendance = (eventId: number) =>
    http.get(`/admin/events/${eventId}/attendance`);

export const adminSaveAttendance = (
    eventId: number,
    payload: AttendanceSettingsPayload
) => http.put(`/admin/events/${eventId}/attendance`, payload);

export const adminListAttendances = (eventId: number) =>
    http.get(`/admin/events/${eventId}/attendances`);

export const adminExportAttendances = (eventId: number) =>
    http.fetchFile(`/admin/events/${eventId}/attendances/export`);

export const adminDeleteAttendance = (eventId: number, attendanceId: number) =>
    http.delete(`/admin/events/${eventId}/attendances/${attendanceId}`);

// --- Participant ------------------------------------------------------------

export const getAttendance = (slug: string) =>
    http.get(`/events/${slug}/attendance`);

export const submitAttendance = (slug: string, answers: AttendanceAnswers) =>
    http.post(`/events/${slug}/attendance`, { answers });

export const myCertificates = () => http.get('/certificates');

export const downloadCertificate = (id: number, inline = false) =>
    http.fetchFile(`/certificates/${id}/download${inline ? '?inline=1' : ''}`);
