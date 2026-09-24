/**
 * Aturan password sama dengan backend (Password::min(8)->mixedCase()
 * ->numbers()->symbols()), dicek di browser supaya user langsung tahu apa
 * yang kurang. Backend tetap yang menentukan.
 */
export const PASSWORD_HINT =
    'Minimal 8 karakter, kombinasi huruf besar, huruf kecil, angka, dan simbol.';

export function validatePassword(password: string): string | null {
    if (password.length < 8) {
        return 'Password minimal 8 karakter.';
    }

    if (!/\p{Ll}/u.test(password) || !/\p{Lu}/u.test(password)) {
        return 'Password harus mengandung huruf besar dan huruf kecil.';
    }

    if (!/\p{N}/u.test(password)) {
        return 'Password harus mengandung angka.';
    }

    if (!/[\p{Z}\p{S}\p{P}]/u.test(password)) {
        return 'Password harus mengandung simbol.';
    }

    return null;
}
