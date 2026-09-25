// Susunan kolom formulir pendaftaran. Teksnya (label, placeholder, pilihan)
// ada di berkas terjemahan: `auth.register.fields.<name>` dan
// `auth.register.options`.
export type RegisterFieldName =
    | 'name'
    | 'email'
    | 'password'
    | 'password_confirmation'
    | 'phone'
    | 'occupation'
    | 'age'
    | 'institution';

type RegisterField = {
    name: RegisterFieldName;
    type: 'text' | 'email' | 'password';
    required: boolean;
    pattern?: string;
};

export const REGISTER_FIELDS: readonly RegisterField[] = [
    {
        name: 'name',
        type: 'text',
        required: true,
        pattern: '^[a-zA-Z]+(?: [a-zA-Z]+)+$',
    },
    {
        name: 'email',
        type: 'email',
        required: true,
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    },
    { name: 'password', type: 'password', required: true },
    { name: 'password_confirmation', type: 'password', required: true },
    {
        name: 'phone',
        type: 'text',
        required: true,
        pattern: '^[0-9+ ]+$',
    },
    {
        name: 'occupation',
        type: 'text',
        required: true,
        pattern: '^[a-zA-Z\\s]+$',
    },
    { name: 'age', type: 'text', required: true, pattern: '^\\d{1,3}$' },
    { name: 'institution', type: 'text', required: false },
];

// Nilai yang dikirim ke backend (tidak diterjemahkan).
export const EDUCATION_LEVELS = ['SMA', 'S1', 'S2', 'S3'] as const;
export const GENDERS = ['male', 'female'] as const;
