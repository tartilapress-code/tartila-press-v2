import { RiSearchLine } from '@remixicon/react';

import bookSearch from '@/data/book/book-search.json';
import { useState } from 'react';

export default function BookSearcBar({ onSearch }): React.ReactNode {
    const [searchResult, setSearchResult] = useState<string>('');

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        setSearchResult(value);
        onSearch(value);
    };

    return (
        <div
            className=" relative self-start
                    bg-white rounded-sm w-full items-center max-w-md
                    "
        >
            <form action="">
                <input
                    className="
                        rounded-sm
                        px-4 py-2 w-full
                        border-gray-300 focus:ring-2 focus:ring-oxford-navy-500 focus:outline-none
                    "
                    id={bookSearch.id}
                    onChange={handleOnChange}
                    type={bookSearch.type}
                    placeholder={bookSearch.placeholder}
                />
                <div className="absolute inset-y-0 right-0 flex items-center mx-2">
                    <RiSearchLine color="black" size="24" />
                </div>
            </form>
        </div>
    );
}
