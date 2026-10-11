// Daftar per halaman dari API: respons { data: [...], meta: PageMeta }.
// Parameter: ?page=N&per_page=M (lihat PaginatesResults di backend).
export type PageMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

export type PageParams = { page?: number; per_page?: number };

type QueryValue = string | number | boolean | null | undefined;

/** "?a=1&b=x" dari objek; nilai kosong (undefined/null/'') dilewati. */
export function queryString(params: Record<string, QueryValue>): string {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });

    const qs = query.toString();

    return qs ? `?${qs}` : '';
}
