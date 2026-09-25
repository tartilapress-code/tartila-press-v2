<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    use PasswordPolicyMessages;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'unique:users,email',
            ],

            'password' => [
                'required',
                'string',
                'confirmed',
                Password::defaults(),
            ],

            'education_level' => [
                'required',
                Rule::in([
                    'SMA',
                    'S1',
                    'S2',
                    'S3',
                ]),
            ],

            'institution' => [
                'nullable',
                'string',
                'max:255',
            ],

            'age' => [
                'required',
                'integer',
                'min:13',
                'max:100',
            ],

            'gender' => [
                'required',
                Rule::in([
                    'male',
                    'female',
                ]),
            ],

            'occupation' => [
                'required',
                'string',
                'max:255',
            ],

            'phone' => [
                'required',
                'string',
                'max:20',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'name.max' => 'Nama maksimal 255 karakter.',

            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah terdaftar.',

            'password.required' => 'Password wajib diisi.',
            'password.confirmed' => 'Konfirmasi password tidak sesuai.',
            ...$this->passwordPolicyMessages(),

            'education_level.required' => 'Jenjang pendidikan wajib diisi.',
            'education_level.in' => 'Jenjang pendidikan tidak valid.',

            'age.required' => 'Usia wajib diisi.',
            'age.min' => 'Usia minimal 13 tahun.',
            'age.max' => 'Usia maksimal 100 tahun.',

            'gender.required' => 'Jenis kelamin wajib diisi.',
            'gender.in' => 'Jenis kelamin tidak valid.',

            'occupation.required' => 'Pekerjaan wajib diisi.',

            'phone.required' => 'Nomor telepon wajib diisi.',
        ];
    }
}
