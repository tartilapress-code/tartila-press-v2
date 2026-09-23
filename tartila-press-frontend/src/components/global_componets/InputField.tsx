import React, { useState, type InputHTMLAttributes } from 'react';
import registrationValidation from '@/utils/registrationValidation';

const labelStyle = {
    inputOnFocus: 'text-forest-moss-300',
    default: 'text-white',
};

const inputDefaultStyle =
    'w-full px-4 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-forest-moss-300 focus:ring-1 focus:ring-forest-moss-300';

const variants = {
    invalid: 'invalid:border-red-500 invalid:text-red-600',
    disabled:
        'disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none',
    focusInvalid: 'focus:invalid:border-red-500 focus:invalid:ring-red-500',
};

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    pass_max_length?: number;
    stateValidationMessage?: string;
    variant?: 'invalid' | 'disabled' | 'focusInvalid';
};

export default function InputField({
    label = '',
    id,
    pass_max_length,
    variant = 'invalid',
    ...props
}: InputFieldProps) {
    const [isFocus, setIsFocus] = useState<boolean>(false);
    const [validationMessage, setValidationMessage] = useState<string>('');

    const [isEmpty, setIsEmpty] = useState<boolean>(false);

    const handleInputState = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        console.log(value);
        if (validationMessage === '' || value === '') {
            setIsEmpty(false);
        } else {
            setIsEmpty(true);
        }
    };

    return (
        <div className=" flex flex-col gap-1">
            <label
                id={id}
                htmlFor={id}
                className={
                    isFocus
                        ? `${labelStyle.inputOnFocus}`
                        : `${labelStyle.default}`
                }
            >
                {label}
            </label>
            <div className="relative">
                <input
                    onChange={(e) => {
                        const message = registrationValidation(
                            e,
                            label,
                            pass_max_length ?? 0
                        );
                        setValidationMessage(message);
                        handleInputState(e);
                    }}
                    onFocus={() => setIsFocus(!isFocus)}
                    onBlur={() => setIsFocus(!isFocus)}
                    className={`
                            ${inputDefaultStyle}
                            ${variants[variant]}
                            `}
                    {...props}
                />
            </div>

            <small className={`${isEmpty ? 'text-red-300' : 'hidden'}`}>
                {`${validationMessage}`}
            </small>
        </div>
    );
}
