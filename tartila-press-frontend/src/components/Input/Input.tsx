import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiEyeLine, RiEyeOffLine } from '@remixicon/react';

//script
type InputProps = {
    label?: string;
    errorMessage?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

// template
export default function Input({
    label = '',
    errorMessage = '',
    type = 'text',
    ...props
}: InputProps) {
    //logic
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const generatedId = useId();
    const id = props.id ?? generatedId;

    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    // return
    return (
        <>
            <div className="flex flex-col gap-2">
                <label
                    className="text-sm font-medium text-oxford-navy-900"
                    htmlFor={id}
                >
                    {label}
                </label>
                <div className="relative">
                    <input
                        type={inputType}
                        className={`
                        w-full rounded-xl border bg-white p-3 text-sm text-oxford-navy-900 outline-none transition
                        placeholder:text-oxford-navy-900/40
                        focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30
                        disabled:cursor-not-allowed disabled:bg-forest-moss-50 disabled:text-oxford-navy-900/55
                        ${errorMessage ? 'border-red-400' : 'border-oxford-navy-900/15 hover:border-oxford-navy-900/30'}
                        ${isPassword ? 'pr-11' : ''} `}
                        {...props}
                        id={id}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-oxford-navy-900/55 hover:text-oxford-navy-700"
                            aria-label={
                                showPassword
                                    ? t('common.hidePassword')
                                    : t('common.showPassword')
                            }
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <RiEyeOffLine size={20} />
                            ) : (
                                <RiEyeLine size={20} />
                            )}
                        </button>
                    )}
                </div>
                <small className="text-red-600">{errorMessage}</small>
            </div>
        </>
    );
}

// style
