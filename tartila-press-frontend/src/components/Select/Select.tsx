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
                    className="text-sm font-medium text-oxford-navy-900"
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
                            border border-oxford-navy-900/15
                            bg-white
                            px-4 py-3 pr-10
                            text-sm text-oxford-navy-900
                            outline-none

                            transition-all duration-200

                            hover:border-oxford-navy-900/30

                            focus:border-forest-moss-500
                            focus:ring-2
                            focus:ring-forest-moss-500/30

                            disabled:cursor-not-allowed
                            disabled:bg-forest-moss-50
                            disabled:opacity-70
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
                            text-oxford-navy-700
                        "
                    >
                        <RiArrowDownSFill />
                    </div>
                </div>
            </div>
        </>
    );
}
