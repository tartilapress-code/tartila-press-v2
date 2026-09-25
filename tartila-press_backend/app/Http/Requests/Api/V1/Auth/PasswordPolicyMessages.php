<?php

namespace App\Http\Requests\Api\V1\Auth;

/**
 * Pesan (Bahasa Indonesia) untuk aturan Password::defaults() — dipakai
 * bersama oleh semua form yang menetapkan password baru (register, ganti
 * password, reset password) supaya pesannya seragam.
 *
 * Aturan sebenarnya didefinisikan di AppServiceProvider (Password::defaults);
 * ubah di sana bila kebijakan berubah, lalu sesuaikan teks di sini.
 */
trait PasswordPolicyMessages
{
    protected function passwordPolicyMessages(string $field = 'password'): array
    {
        return [
            "{$field}.min" => 'Password minimal 8 karakter.',
            "{$field}.mixed" => 'Password harus mengandung huruf besar dan huruf kecil.',
            "{$field}.numbers" => 'Password harus mengandung angka.',
            "{$field}.symbols" => 'Password harus mengandung simbol.',
        ];
    }
}
