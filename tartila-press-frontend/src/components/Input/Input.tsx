import { useState } from 'react';
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
    const [focus, setFocus] = useState<boolean>(false);
    const [showPassword, setShowPassword] = useState<boolean>(false);

    function handleOnfocus() {
        setFocus(!focus);
    }

    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    // return
    return (
        <>
            <div className="flex flex-col gap-2">
                <label
                    className={`${focus ? 'text-oxford-navy-200' : 'text-white'}`}
                    htmlFor=""
                >
                    {label}
                </label>
                <div className="relative">
                    <input
                        onFocus={handleOnfocus}
                        onBlur={handleOnfocus}
                        type={inputType}
                        className={`
                        w-full p-3 outline-none rounded-xl ring-1 ring-white/30 placeholder:text-white
                        focus:ring-1 focus:ring-oxford-navy-500 focus:bg-oxford-navy-300/50
                        ${isPassword ? 'pr-11' : ''} `}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                            aria-label={
                                showPassword
                                    ? 'Sembunyikan password'
                                    : 'Lihat password'
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
                <small className="text-red-400 none">{errorMessage}</small>
            </div>
        </>
    );
}

// style
