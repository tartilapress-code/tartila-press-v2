import { RiEqualizerLine } from '@remixicon/react';
import { useState } from 'react';
import filterCategories from '@/data/book/book_categories_unique.json';

export default function BookFilter({ onFilterByCategory }): React.ReactNode {
    const [filter, setFilter] = useState<string>('All');

    const sendFilterByCategory = () => onFilterByCategory(filter);

    const handleFilterByCategory = (event) => {
        setFilter(event.target.value);
    };

    return (
        <>
            <div className="flex flex-row gap-2 w-fit h-fit px-4 py-2 p-2 bg-white rounded-sm">
                <div className="flex flex-row items-center  w-fit rounded-sm overflow-hidden   self-start ">
                    <RiEqualizerLine />
                </div>

                <div
                    className="
                        transition-all duration-300 ease-out
                       "
                >
                    <div
                        className="grid grid-cols-1 auto-rows-fr bg-white rounded-sm items-center  w-fit

                        "
                    >
                        <select
                            name="filter"
                            id="filter"
                            onChange={handleFilterByCategory}
                            onClick={sendFilterByCategory}
                        >
                            {filterCategories.map((category) => (
                                <option
                                    key={category}
                                    value={category}
                                    className="hover:text-oxford-navy-900"
                                >
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </>
    );
}
