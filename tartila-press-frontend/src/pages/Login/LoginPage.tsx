import { useState } from 'react';
import loginField from '@/data/login/login.json';
import Button from '../../components/Button/Button';
import { Link, useNavigate } from 'react-router-dom';
import ArrowBack from '../../components/ArrowBack';
import Input from '../../components/Input/Input';
import { useAuth } from '@/context/useAuth';
import { ApiError } from '@/lib/http';
import type { LoginPayload } from '@/data/auth/authApi';

export default function Login(): React.ReactNode {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleLoginSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setIsSubmitting(true);
        setErrorMessage('');

        const formData = new FormData(e.currentTarget);
        const payload = Object.fromEntries(
            formData.entries()
        ) as unknown as LoginPayload;

        try {
            await login(payload);
            navigate('/');
        } catch (error) {
            if (error instanceof ApiError) {
                setErrorMessage(error.message);
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
                flex flex-row items-center justify-center
                h-dvh w-full relative
                bg-[url('@/assets/images/buku.png')] bg-no-repeat bg-cover bg-center
                "
            >
                <div className="flex flex-col gap-5 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6 w-100 ">
                    <ArrowBack />
                    <h5 className="block text-white text-2xl font-semibold text-left">
                        Login to your account
                    </h5>
                    <p className="text-white text-sm">
                        Lorem, ipsum dolor sit amet consectetur adipisicing
                        elit. Velit, ipsa!
                    </p>
                    <form onSubmit={handleLoginSubmit}>
                        <div className="flex flex-col gap-4">
                            {loginField.map((field) => (
                                <Input
                                    key={field.id}
                                    id={field.id}
                                    name={field.name}
                                    type={field.type}
                                    label={field.label}
                                    placeholder={field.placeholder}
                                    required={field.required}
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
                                {isSubmitting ? 'Memproses...' : 'Login'}
                            </Button>
                        </div>
                    </form>

                    <div className="flex flex-row gap-2 justify-center">
                        <p className="text-sm">Don't have an account?</p>
                        <Link
                            to="/register"
                            className="text-blue-800 text-sm hover:text-blue-700"
                        >
                            Sign Up
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
