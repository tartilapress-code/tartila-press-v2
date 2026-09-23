import BookSearcBar from '@/components/book/BookSearchBar';
import BookFilter from '@/components/book/BookFilter';
import BookSortBy from '@/components/book/BookSortBy';
import BookCatalog from '@/components/book/BookCatalog';
import { useState } from 'react';

export default function Book(): React.ReactNode {
    const [bookCategory, setBookCategory] = useState<string>('');
    const [search, setSearch] = useState<string>('');

    const handleFilterByCategory = (data) => setBookCategory(data);
    const handleSearch = (data) => setSearch(data);

    return (
        <>
            <main className="mx-10 my-2 relative">
                <div className="flex flex-col  bg-oxford-navy-900 p-2 rounded-sm">
                    <div className="flex  gap-6 items-center">
                        <BookSearcBar onSearch={handleSearch} />
                        <BookFilter
                            onFilterByCategory={handleFilterByCategory}
                        />
                        <BookSortBy />
                    </div>
                    <div className="mt-4">
                        <p className="text-white p-2">search: {search}</p>
                        <h1 className="text-white p-2 ">
                            Filter:
                            <span className="bg-forest-moss-500 px-4 py-1 ml-5 rounded-full">
                                {bookCategory}
                            </span>
                        </h1>
                    </div>
                </div>
                <div className="mt-10">
                    <BookCatalog
                        selectedCategory={bookCategory}
                        search={search}
                    />
                </div>
            </main>
        </>
    );
}
