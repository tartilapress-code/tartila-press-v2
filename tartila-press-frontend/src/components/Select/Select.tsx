import { RiArrowDownSFill } from '@remixicon/react';

// type
type SelectOption = {
    value: string;
    label: string;
};

type SelectProps = {
    name?: string;
    option_data: SelectOption[];
    label?: string;
} & React.ComponentProps<'select'>;

export default function Option({
    name = '',
    option_data,
    label,
    ...props
}: SelectProps) {
    return (
        <>
            <div className="flex flex-col gap-2">
                <label
                    htmlFor={name}
                    className={`
                        text-sm font-medium transition-colors duration-200
                        text-white
                    `}
                >
                    {label}
                </label>

                <div className="relative">
                    <select
                        name={name}
                        id={name}
                        className="
                            w-full appearance-none
                            rounded-xl
                            border border-white/20
                            bg-white/5
                            px-4 py-3 pr-10
                            text-white
                            outline-none
                            backdrop-blur-sm

                            transition-all duration-200

                            hover:border-white/40
                            hover:bg-white/10

                            focus:border-oxford-navy-500
                            focus:bg-oxford-navy-300/10
                            focus:ring-2
                            focus:ring-oxford-navy-500/30

                            disabled:cursor-not-allowed
                            disabled:opacity-50

                            [&>option]:bg-oxford-navy-400
                            [&>option]:text-white
                        "
                        {...props}
                    >
                        {option_data.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    {/* Custom arrow */}
                    <div
                        className="
                            pointer-events-none
                            absolute
                            right-4
                            top-1/2
                            -translate-y-1/2
                            text-white/70
                        "
                    >
                        <RiArrowDownSFill />
                    </div>
                </div>
            </div>
        </>
    );
}
