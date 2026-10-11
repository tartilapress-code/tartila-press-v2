import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import ChapterPromoSection from '@/components/bookChapter/ChapterPromoSection';
import * as certificateApi from '@/data/certificate/certificateApi';
import * as socialApi from '@/data/social/socialApi';
import { useCertificateFonts } from '@/hooks/useCertificateFonts';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';
import { apiUrl } from '@/lib/http';
import {
    DEFAULT_CTA,
    DEFAULT_HASHTAGS,
    buildCaption,
    drawPoster,
    formatAuthors,
    loadPosterFonts,
    type PosterData,
} from '@/lib/socialPoster';
import { drawTemplatePoster } from '@/lib/socialTemplate';
import Pagination from '@/components/ui/Pagination';
import type { PageMeta } from '@/lib/pagination';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';
const fieldClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm font-normal text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

const CTA_KEY = 'tartila_social_cta';
const TAGS_KEY = 'tartila_social_hashtags';

function readSaved(key: string, fallback: string): string {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function save(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // penyimpanan tidak tersedia: nilai tetap dipakai di sesi ini
    }
}

const formatPrice = (value: number) =>
    `Rp ${value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SocialPostPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [books, setBooks] = useState<socialApi.SocialBook[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [query, setQuery] = useState<string>('');
    const [book, setBook] = useState<socialApi.SocialBook | null>(null);

    const [data, setData] = useState<PosterData>({
        title: '',
        blurb: '',
        authors: '',
        isbn: '',
        price: '',
        link: '',
        quote: '',
    });
    const [synopsis, setSynopsis] = useState<string>('');
    const [cta, setCta] = useState<string>(() =>
        readSaved(CTA_KEY, DEFAULT_CTA)
    );
    const [hashtags, setHashtags] = useState<string>(() =>
        readSaved(TAGS_KEY, DEFAULT_HASHTAGS)
    );
    const [captionOverride, setCaptionOverride] = useState<string | null>(null);

    const [cover, setCover] = useState<ImageBitmap | null>(null);
    const [coverNote, setCoverNote] = useState<string>('');
    const [logo, setLogo] = useState<HTMLImageElement | null>(null);
    const [templates, setTemplates] = useState<
        certificateApi.CertificateTemplate[]
    >([]);
    const [meta, setMeta] = useState<certificateApi.EditorMeta | null>(null);
    // 'default' = desain bawaan (TERBIT); angka = id templat buatan admin.
    const [templateId, setTemplateId] = useState<'default' | number>('default');
    const [background, setBackground] = useState<ImageBitmap | null>(null);
    const [fontsReady, setFontsReady] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);

    const [bookPage, setBookPage] = useState<number>(1);
    const [bookMeta, setBookMeta] = useState<PageMeta | null>(null);

    // Daftar buku: pencarian & halaman dikerjakan server.
    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(() => {
            socialApi
                .books({ search: query.trim(), page: bookPage })
                .then((response) => {
                    if (cancelled) return;
                    setBooks(response.data);
                    setBookMeta(response.meta ?? null);
                })
                .catch((caught) => {
                    if (cancelled) return;
                    setIsError(true);
                    setMessage(describeApiError(caught));
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query, bookPage]);

    useEffect(() => {
        Promise.all([
            certificateApi.adminList('social'),
            certificateApi.adminMeta(),
        ])
            .then(([list, metaResponse]) => {
                setTemplates(
                    (list.data as certificateApi.CertificateTemplate[]).filter(
                        (template) => template.is_active
                    )
                );
                setMeta(metaResponse.data);
            })
            .catch(() => undefined);

        loadPosterFonts(apiUrl(''))
            .then(() => setFontsReady(true))
            .catch(() => {
                setIsError(true);
                setMessage(
                    'Font poster gagal dimuat; tampilan memakai font cadangan.'
                );
                setFontsReady(true);
            });

        const image = new Image();
        image.onload = () => setLogo(image);
        image.src = '/logo.png';
    }, []);

    const template =
        templateId === 'default'
            ? null
            : (templates.find((item) => item.id === templateId) ?? null);

    // Font templat buatan admin (file yang sama dengan editor).
    const fontsVersion = useCertificateFonts(
        meta?.fonts ?? [],
        template?.fields ?? []
    );

    // Gambar ulang poster tiap data / gambar / font / templat berubah.
    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas || !fontsReady) {
            return;
        }

        if (template && meta) {
            if (background) {
                drawTemplatePoster(canvas, {
                    template,
                    background,
                    meta,
                    data,
                    cover,
                });
            }

            return;
        }

        drawPoster(canvas, data, { cover, logo });
    }, [
        data,
        cover,
        logo,
        fontsReady,
        template,
        meta,
        background,
        fontsVersion,
    ]);

    const caption = useMemo(
        () =>
            captionOverride ??
            buildCaption({
                synopsis,
                cta,
                hashtags,
                title: data.title.replace(/\n/g, ' '),
                isbn: data.isbn,
                price: data.price,
                link: data.link,
            }),
        [captionOverride, synopsis, cta, hashtags, data]
    );

    const visible = books;

    async function selectBook(item: socialApi.SocialBook) {
        setBook(item);
        setCaptionOverride(null);
        setMessage('');
        setIsError(false);
        setData((prev) => ({
            ...prev,
            title: item.title,
            authors: formatAuthors(item.authors),
            isbn: item.isbn ?? '',
            price: formatPrice(item.final_price),
            link: item.url,
        }));
        setSynopsis(item.description ?? '');
        setCover(null);
        setCoverNote(
            item.has_cover
                ? 'Memuat cover…'
                : 'Buku ini belum punya foto cover.'
        );

        if (item.has_cover) {
            try {
                const { blob } = await socialApi.cover(item.id);
                setCover(await createImageBitmap(blob));
                setCoverNote('');
            } catch (caught) {
                setCoverNote(describeApiError(caught, 'Cover gagal dimuat.'));
            }
        }
    }

    async function chooseTemplate(value: string) {
        const next = value === 'default' ? 'default' : Number(value);
        setTemplateId(next);
        setBackground(null);

        if (next === 'default') {
            return;
        }

        try {
            const { blob } = await certificateApi.adminTemplateImage(next);
            setBackground(await createImageBitmap(blob));
        } catch (caught) {
            setIsError(true);
            setMessage(
                describeApiError(caught, 'Gambar templat gagal dimuat.')
            );
        }
    }

    async function uploadCover(file: File) {
        try {
            setCover(await createImageBitmap(file));
            setCoverNote('');
        } catch {
            setCoverNote('Berkas bukan gambar yang bisa dibaca.');
        }
    }

    function set<K extends keyof PosterData>(key: K, value: PosterData[K]) {
        setData((prev) => ({ ...prev, [key]: value }));
    }

    function download() {
        canvasRef.current?.toBlob((blob) => {
            if (!blob) {
                setIsError(true);
                setMessage('Gagal membuat gambar.');

                return;
            }

            saveBlob(
                blob,
                `poster-${(book?.title ?? 'buku').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
            );
        }, 'image/png');
    }

    async function copyCaption() {
        try {
            await navigator.clipboard.writeText(caption);
            setIsError(false);
            setMessage('Caption disalin.');
        } catch {
            setIsError(true);
            setMessage('Gagal menyalin. Salin manual dari kotak caption.');
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Konten Sosmed
                </h5>
                <p className="text-oxford-navy-900/80 text-sm">
                    Pilih buku terbit: poster &quot;TERBIT&quot; terisi otomatis
                    (judul, penulis, ISBN, harga, link, cover). Tulisan di bawah
                    judul diisi manual. Hasilnya poster PNG + caption siap
                    salin. Halaman ini hanya untuk admin.
                </p>

                <div className="flex flex-col gap-1">
                    <label
                        htmlFor="social-template"
                        className="text-xs text-oxford-navy-900/70"
                    >
                        Template poster
                    </label>
                    <div className="flex flex-row flex-wrap items-center gap-3">
                        <select
                            id="social-template"
                            value={String(templateId)}
                            onChange={(e) => chooseTemplate(e.target.value)}
                            className="rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm outline-none focus:border-forest-moss-500"
                        >
                            <option value="default">Bawaan — TERBIT</option>
                            {templates.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                        <Link
                            to="/admin/certificate-templates/new?type=social"
                            className="text-forest-moss-700 text-sm underline"
                        >
                            Tambah template
                        </Link>
                        <Link
                            to="/admin/certificate-templates"
                            className="text-forest-moss-700 text-sm underline"
                        >
                            Kelola template
                        </Link>
                    </div>
                </div>

                <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setBookPage(1);
                    }}
                    placeholder="Cari buku terbit..."
                    className={fieldClass}
                />

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : visible.length === 0 ? (
                    <p className="text-oxford-navy-900/60 text-sm">
                        Tidak ada buku terbit.
                    </p>
                ) : (
                    <div className="flex flex-row flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {visible.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => selectBook(item)}
                                className={`rounded-lg px-3 py-2 text-left text-sm ring-1 hover:cursor-pointer ${
                                    book?.id === item.id
                                        ? 'bg-oxford-navy-700 text-white ring-oxford-navy-700'
                                        : 'bg-forest-moss-50 text-oxford-navy-900 ring-forest-moss-100 hover:bg-forest-moss-100'
                                }`}
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>
                )}

                <Pagination meta={bookMeta} onPageChange={setBookPage} />

                {message && (
                    <p
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className={cardClass}>
                    <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                        Isi poster
                    </h5>

                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Judul (satu baris = satu baris di poster; tanda
                        &quot;:&quot; juga memisah)
                        <textarea
                            rows={2}
                            className={fieldClass}
                            value={data.title}
                            onChange={(e) => set('title', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Tulisan di bawah judul (manual) — teks otomatis mengecil
                        agar muat di kotak poster ({data.blurb.length} karakter)
                        <textarea
                            rows={4}
                            className={fieldClass}
                            value={data.blurb}
                            placeholder="mis. Kumpulan puisi tentang perjalanan seorang anak perempuan pertama…"
                            onChange={(e) => set('blurb', e.target.value)}
                        />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                            Penulis
                            <input
                                className={fieldClass}
                                value={data.authors}
                                onChange={(e) => set('authors', e.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                            ISBN
                            <input
                                className={fieldClass}
                                value={data.isbn}
                                onChange={(e) => set('isbn', e.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                            Harga
                            <input
                                className={fieldClass}
                                value={data.price}
                                onChange={(e) => set('price', e.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                            Link buku
                            <input
                                className={fieldClass}
                                value={data.link}
                                onChange={(e) => set('link', e.target.value)}
                            />
                        </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Tulisan bilah bawah (opsional, manual)
                        <textarea
                            rows={2}
                            className={fieldClass}
                            value={data.quote}
                            placeholder="mis. Untuk siapa pun yang pernah merasa terlalu lelah…"
                            onChange={(e) => set('quote', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Foto cover (otomatis dari data buku; bisa diganti)
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="text-xs"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';

                                if (file) {
                                    uploadCover(file);
                                }
                            }}
                        />
                    </label>
                    {coverNote && (
                        <p className="text-amber-700 text-xs">{coverNote}</p>
                    )}
                </div>

                <div className={cardClass}>
                    <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                        Hasil
                    </h5>
                    <canvas
                        ref={canvasRef}
                        aria-label="Pratinjau poster"
                        className="w-full max-w-md self-center rounded-xl ring-1 ring-forest-moss-100"
                    />
                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={download}
                        disabled={!book || !fontsReady}
                    >
                        Unduh poster (PNG)
                    </Button>
                </div>
            </div>

            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                    Caption
                </h5>
                <p className="text-oxford-navy-900/70 text-xs">
                    Caption = sinopsis + ajakan beli + hashtag. Ubah bagian di
                    bawah, atau langsung edit hasilnya.
                </p>

                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Sinopsis
                    <textarea
                        rows={4}
                        className={fieldClass}
                        value={synopsis}
                        onChange={(e) => {
                            setSynopsis(e.target.value);
                            setCaptionOverride(null);
                        }}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Ajakan beli (penanda: {'{judul} {isbn} {harga} {link}'})
                    <textarea
                        rows={4}
                        className={fieldClass}
                        value={cta}
                        onChange={(e) => {
                            setCta(e.target.value);
                            save(CTA_KEY, e.target.value);
                            setCaptionOverride(null);
                        }}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Hashtag
                    <textarea
                        rows={2}
                        className={fieldClass}
                        value={hashtags}
                        onChange={(e) => {
                            setHashtags(e.target.value);
                            save(TAGS_KEY, e.target.value);
                            setCaptionOverride(null);
                        }}
                    />
                </label>

                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Caption hasil
                    <textarea
                        rows={10}
                        className={fieldClass}
                        value={caption}
                        onChange={(e) => setCaptionOverride(e.target.value)}
                    />
                </label>
                <div className="flex flex-row gap-2">
                    <Button variant="primary" onClick={copyCaption}>
                        Salin caption
                    </Button>
                    {captionOverride !== null && (
                        <Button
                            variant="outline2"
                            onClick={() => setCaptionOverride(null)}
                        >
                            Susun ulang otomatis
                        </Button>
                    )}
                </div>
            </div>

            <ChapterPromoSection />
        </div>
    );
}
