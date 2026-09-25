// import
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowBack from '@/components/ArrowBack';
import AuthCard from '@/components/AuthCard';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';

import { Link, useNavigate } from 'react-router-dom';

import {
    EDUCATION_LEVELS,
    GENDERS,
    REGISTER_FIELDS,
} from '@/data/registration/registrationFields';
import Select from '@/components/Select/Select';
import { useAuth } from '@/context/useAuth';
import { ApiError } from '@/lib/http';
import { validatePassword } from '@/lib/passwordPolicy';
import type { RegisterPayload } from '@/data/auth/authApi';

//template
export default function RegistrationPage() {
    const { t } = useTranslation();
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
            setFieldErrors({ password: [t(passwordProblem)] });
            setIsSubmitting(false);
            return;
        }

        if (payload.password !== payload.password_confirmation) {
            setFieldErrors({
                password_confirmation: [t('auth.password.mismatch')],
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
                setErrorMessage(t('common.genericError'));
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
                    {t('auth.register.title')}
                </h1>
                <p className="text-sm leading-relaxed text-oxford-navy-900/65">
                    {t('auth.register.subtitle')}
                </p>
            </div>
            <form onSubmit={handleRegistrationSubmit}>
                <div className="flex flex-col gap-4">
                    {REGISTER_FIELDS.map((field) => (
                        <Fragment key={field.name}>
                            <Input
                                id={field.name}
                                name={field.name}
                                type={field.type}
                                label={t(
                                    `auth.register.fields.${field.name}.label`
                                )}
                                placeholder={t(
                                    `auth.register.fields.${field.name}.placeholder`
                                )}
                                errorMessage={
                                    fieldErrors[field.name]?.[0] ?? ''
                                }
                                pattern={field.pattern}
                                required={field.required}
                            />
                            {field.name === 'password' && (
                                <small className="-mt-2 text-oxford-navy-900/60">
                                    {t('auth.password.hint')}
                                </small>
                            )}
                        </Fragment>
                    ))}

                    <Select
                        name="education_level"
                        label={t('auth.register.fields.education_level.label')}
                        option_data={EDUCATION_LEVELS.map((level) => ({
                            value: level,
                            label: t(
                                `auth.register.options.education_level.${level}`
                            ),
                        }))}
                        required
                    />
                    <Select
                        name="gender"
                        label={t('auth.register.fields.gender.label')}
                        option_data={GENDERS.map((gender) => ({
                            value: gender,
                            label: t(`auth.register.options.gender.${gender}`),
                        }))}
                        required
                    />

                    {errorMessage && (
                        <p className="text-sm text-red-600">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? t('auth.register.submitting')
                            : t('auth.register.submit')}
                    </Button>
                </div>
            </form>

            <div className="flex flex-row justify-center gap-2 text-sm">
                <p className="text-oxford-navy-900/65">
                    {t('auth.register.haveAccount')}
                </p>
                <Link
                    to="/login"
                    className="font-semibold text-forest-moss-700 hover:text-forest-moss-800 hover:underline"
                >
                    {t('auth.register.login')}
                </Link>
            </div>
        </AuthCard>
    );
}
