import sortBy from '@/data/sort-by-values.json';

export default function BookFilter(): React.ReactNode {
    // const [sortingType, setSortTYpe] = useState<string>('');

    // const handleSorting = (e : React.) => {
    //     const value = e.
    // };

    return (
        <>
            <div
                className="
                    self-start bg-white rounded-sm w-fit items-center max-w-md                "
            >
                <label
                    htmlFor=""
                    className="
                        flex p-2 gap-2
                    "
                >
                    Sort
                    <select
                        name="sort by"
                        id="sort by"
                        className="
                            border-none
                        "
                        onChange={() => handleSorting}
                    >
                        {sortBy.map((sorting) => (
                            <option
                                className="
                                    border border-greeen-500
                                "
                                value={sorting.value}
                            >
                                {sorting.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </>
    );
}
