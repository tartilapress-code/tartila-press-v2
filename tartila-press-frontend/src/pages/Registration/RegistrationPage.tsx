// import
import { useState } from 'react';
import ArrowBack from '@/components/ArrowBack';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';

import { Link, useNavigate } from 'react-router-dom';

import registerField from '@/data/registration/registration.json';
import registerOption from '@/data/registration/registration_option.json';
import Select from '@/components/Select/Select';
import { useAuth } from '@/context/useAuth';
import { ApiError } from '@/lib/http';
import type { RegisterPayload } from '@/data/auth/authApi';

//template
export default function RegistrationPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<
        Record<string, string[]>
    >({});

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

        if (payload.password !== payload.password_confirmation) {
            setFieldErrors({
                password_confirmation: ['Konfirmasi password tidak sesuai.'],
            });
            setIsSubmitting(false);
            return;
        }

        try {
            await register(payload);
            navigate('/');
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
        <>
            <div
                className="
                    flex flex-row justify-end
                    h-dvh w-full relative
                    bg-[url('@/assets/images/buku.png')] bg-no-repeat bg-cover bg-center
                    "
            >
                <div className="absolute inset-0 bg-oxford-navy-900/70 w-full h-full "></div>
                <div
                    className="
                     overflow-y-auto w-1/2 h-full
                    flex flex-col gap-10 bg-oxford-navy-900/70 backdrop-blur-lg px-15 py-6 justify-self-end
                    "
                >
                    <div className="flex flex-col gap-2">
                        <ArrowBack />
                        <h5 className="block text-white text-2xl font-semibold text-left">
                            Registration
                        </h5>
                        <p className="text-white text-sm">
                            Buat Akun Baru dan mulai menerbitkan buku
                        </p>
                    </div>
                    <form onSubmit={handleRegistrationSubmit}>
                        <div className="flex flex-col gap-4">
                            {registerField.map((field) => (
                                <Input
                                    key={field.id}
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
                                <p className="text-red-400 text-sm">
                                    {errorMessage}
                                </p>
                            )}

                            <Button
                                variant="primary"
                                className="shadow-black shadow-md/20"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Memproses...' : 'Register'}
                            </Button>
                        </div>
                    </form>

                    <div className="flex flex-row gap-2 justify-center">
                        <p className="text-white text-sm">Sudah Punya akun</p>
                        <Link
                            to="/login"
                            className="text-oxford-navy-500 font-bold text-sm hover:text-blue-700 duration-250"
                        >
                            Login
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
