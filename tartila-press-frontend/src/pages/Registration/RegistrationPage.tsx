// import
import { Fragment, useState } from 'react';
import ArrowBack from '@/components/ArrowBack';
import AuthCard from '@/components/AuthCard';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';

import { Link, useNavigate } from 'react-router-dom';

import registerField from '@/data/registration/registration.json';
import registerOption from '@/data/registration/registration_option.json';
import Select from '@/components/Select/Select';
import { useAuth } from '@/context/useAuth';
import { ApiError } from '@/lib/http';
import { PASSWORD_HINT, validatePassword } from '@/lib/passwordPolicy';
import type { RegisterPayload } from '@/data/auth/authApi';

//template
export default function RegistrationPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {}
    );

    const handleRegistrationSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setIsSubmitting(true);
        setErrorMessage('');
        setFieldErrors({});

        const formData = new FormData(e.currentTarget);
        const payload = Object.fromEntries(
            formData.entries()
        ) as unknown as RegisterPayload;

        const passwordProblem = validatePassword(payload.password);
        if (passwordProblem) {
            setFieldErrors({ password: [passwordProblem] });
            setIsSubmitting(false);
            return;
        }

        if (payload.password !== payload.password_confirmation) {
            setFieldErrors({
                password_confirmation: ['Konfirmasi password tidak sesuai.'],
            });
            setIsSubmitting(false);
            return;
        }

        try {
            await register(payload);
            navigate('/verifikasi-email?status=pending');
        } catch (error) {
            if (error instanceof ApiError) {
                if (error.status === 422 && error.errors) {
                    setFieldErrors(error.errors);
                } else {
                    setErrorMessage(error.message);
                }
            } else {
                setErrorMessage('Terjadi kesalahan. Silakan coba lagi.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthCard size="lg">
            <ArrowBack />
            <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Registration
                </h1>
                <p className="text-sm leading-relaxed text-oxford-navy-900/65">
                    Buat Akun Baru dan mulai menerbitkan buku
                </p>
            </div>
            <form onSubmit={handleRegistrationSubmit}>
                <div className="flex flex-col gap-4">
                    {registerField.map((field) => (
                        <Fragment key={field.id}>
                            <Input
                                id={field.id}
                                name={field.name}
                                type={field.type}
                                label={field.label}
                                placeholder={field.placeholder}
                                errorMessage={
                                    fieldErrors[field.name]?.[0] ?? ''
                                }
                                pattern={field.pattern}
                                required={field.required}
                            />
                            {field.name === 'password' && (
                                <small className="-mt-2 text-oxford-navy-900/60">
                                    {PASSWORD_HINT}
                                </small>
                            )}
                        </Fragment>
                    ))}

                    {registerOption.map((option) => (
                        <Select
                            key={option.id}
                            name={option.name}
                            option_data={option.value}
                            label={option.label}
                            required={option.required}
                        />
                    ))}

                    {errorMessage && (
                        <p className="text-sm text-red-600">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Memproses...' : 'Register'}
                    </Button>
                </div>
            </form>

            <div className="flex flex-row justify-center gap-2 text-sm">
                <p className="text-oxford-navy-900/65">Sudah Punya akun</p>
                <Link
                    to="/login"
                    className="font-semibold text-forest-moss-700 hover:text-forest-moss-800 hover:underline"
                >
                    Login
                </Link>
            </div>
        </AuthCard>
    );
}
