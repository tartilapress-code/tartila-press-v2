/**
 * Aturan password sama dengan backend (Password::min(8)->mixedCase()
 * ->numbers()->symbols()), dicek di browser supaya user langsung tahu apa
 * yang kurang. Backend tetap yang menentukan.
 *
 * Yang dikembalikan adalah kunci terjemahan (bukan kalimat jadi), supaya
 * pesannya mengikuti bahasa yang dipilih: tampilkan dengan `t(problem)`.
 * Petunjuk aturannya ada di kunci `auth.password.hint`.
 */
export type PasswordProblem =
    | 'auth.password.tooShort'
    | 'auth.password.needsCase'
    | 'auth.password.needsNumber'
    | 'auth.password.needsSymbol';

export function validatePassword(password: string): PasswordProblem | null {
    if (password.length < 8) {
        return 'auth.password.tooShort';
    }

    if (!/\p{Ll}/u.test(password) || !/\p{Lu}/u.test(password)) {
        return 'auth.password.needsCase';
    }

    if (!/\p{N}/u.test(password)) {
        return 'auth.password.needsNumber';
    }

    if (!/[\p{Z}\p{S}\p{P}]/u.test(password)) {
        return 'auth.password.needsSymbol';
    }

    return null;
}
