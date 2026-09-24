import type { CustomItem } from '@/data/customPackageItem/customPackageItemApi';
import type { PackageSummary } from '@/data/package/packageApi';
import { formatRupiah } from '@/lib/bookChapterPublic';

/** Lencana dan catatan kecil yang ditempel di kartu sebuah paket. */
export type PackageHighlight = { badge?: string; note?: string };

// Fasilitas/layanan paket hanya teks bebas, sedangkan item custom punya harga.
// Keduanya dicocokkan lewat nama supaya paket bisa dibandingkan dengan harga
// satuan; jadi nama di kedua sisi sebaiknya konsisten.

// Penulisan lain untuk hal yang sama (kunci → bentuk baku).
const ALIASES: Record<string, string> = { haki: 'hki' };

const OFFER_LIMIT = 3;

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

/** Kata kunci sebuah nama: huruf kecil, tanpa tanda baca, alias disamakan. */
function nameTokens(name: string): string[] {
    return name
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .map((token) => ALIASES[token] ?? token);
}

/** Kunci penyatu baris yang sama di tabel perbandingan ("ISBN" = "isbn", "HKI" = "HAKI"). */
export function featureKey(name: string): string {
    return nameTokens(name).join(' ');
}

/**
 * Fasilitas/layanan paket setara dengan sebuah item bila semua kata salah
 * satunya termuat di yang lain ("Cover" ada di "Desain Cover Premium").
 */
export function isSameFeature(feature: string, itemName: string): boolean {
    const featureTokens = nameTokens(feature);
    const itemTokens = nameTokens(itemName);

    if (featureTokens.length === 0 || itemTokens.length === 0) {
        return false;
    }

    return (
        featureTokens.every((token) => itemTokens.includes(token)) ||
        itemTokens.every((token) => featureTokens.includes(token))
    );
}

function featuresOf(pkg: PackageSummary): string[] {
    return [...(pkg.facilities ?? []), ...(pkg.services ?? [])];
}

/** Total harga (setelah diskon item) dari item-item yang dipilih. */
export function itemsTotal(items: CustomItem[]): number {
    return roundMoney(items.reduce((sum, item) => sum + item.final_price, 0));
}

/**
 * Item satuan yang setara dengan isi paket. Bila satu fasilitas cocok dengan
 * beberapa item (mis. "ISBN" dengan ISBN cetak dan e-book) diambil yang
 * termurah, sehingga hitungan hemat tidak melebih-lebihkan.
 */
function matchedItems(pkg: PackageSummary, items: CustomItem[]): CustomItem[] {
    const matched = new Map<number, CustomItem>();

    for (const feature of featuresOf(pkg)) {
        const candidates = items.filter((item) =>
            isSameFeature(feature, item.name)
        );

        if (candidates.length === 0) {
            continue;
        }

        const cheapest = candidates.reduce((best, item) =>
            item.final_price < best.final_price ? item : best
        );
        matched.set(cheapest.id, cheapest);
    }

    return [...matched.values()];
}

/** Apakah isi paket mencakup semua item yang dipilih. */
function coversItems(pkg: PackageSummary, selected: CustomItem[]): boolean {
    const features = featuresOf(pkg);

    return selected.every((item) =>
        features.some((feature) => isSameFeature(feature, item.name))
    );
}

export type ComparisonFeature = {
    key: string;
    label: string;
    // has[i]: apakah paket ke-i memilikinya.
    has: boolean[];
};

/**
 * Penulisan yang paling sering dipakai di antara variannya ("ISBN" ketimbang
 * "isbn"). Bila seri, yang bukan huruf kecil semua menang, lalu yang pertama.
 */
function mostCommonSpelling(variants: Map<string, number>): string {
    let best = '';
    let bestCount = 0;

    for (const [spelling, count] of variants) {
        const isBetter =
            count > bestCount ||
            (count === bestCount &&
                best === best.toLowerCase() &&
                spelling !== spelling.toLowerCase());

        if (isBetter) {
            best = spelling;
            bestCount = count;
        }
    }

    return best;
}

/**
 * Kolom tabel perbandingan untuk satu jenis (layanan atau fasilitas): satu
 * kolom per nama (penulisan yang berbeda huruf besarnya disatukan), urut
 * kemunculan pertama.
 */
export function comparisonFeatures(
    packages: PackageSummary[],
    pick: (pkg: PackageSummary) => string[] | null
): ComparisonFeature[] {
    const features = new Map<
        string,
        { spellings: Map<string, number>; has: boolean[] }
    >();

    packages.forEach((pkg, index) => {
        for (const rawFeature of pick(pkg) ?? []) {
            const feature = rawFeature.trim();
            const key = featureKey(feature);

            if (key === '') {
                continue;
            }

            let entry = features.get(key);

            if (!entry) {
                entry = {
                    spellings: new Map(),
                    has: packages.map(() => false),
                };
                features.set(key, entry);
            }

            entry.spellings.set(
                feature,
                (entry.spellings.get(feature) ?? 0) + 1
            );
            entry.has[index] = true;
        }
    });

    return [...features].map(([key, entry]) => ({
        key,
        label: mostCommonSpelling(entry.spellings),
        has: entry.has,
    }));
}

export type PackageOffers = {
    // general: tanpa pilihan · selection: paket yang mencakup pilihan ·
    // uncovered: ada pilihan tetapi tidak ada paket yang mencakup dengan hemat.
    mode: 'general' | 'selection' | 'uncovered';
    packages: PackageSummary[];
    highlights: Record<number, PackageHighlight>;
};

function withHighlights(
    entries: { pkg: PackageSummary; saving: number }[],
    basis: string
): Pick<PackageOffers, 'packages' | 'highlights'> {
    const highlights: Record<number, PackageHighlight> = {};
    let bestAssigned = false;

    for (const { pkg, saving } of entries) {
        if (saving <= 0) {
            continue;
        }

        highlights[pkg.id] = {
            badge: bestAssigned ? undefined : 'Paling Hemat',
            note: `Hemat ${formatRupiah(saving)} ${basis}`,
        };
        bestAssigned = true;
    }

    return { packages: entries.map((entry) => entry.pkg), highlights };
}

/**
 * Paket yang ditawarkan di halaman Layanan, yang paling hemat lebih dulu.
 * - Ada item terpilih: paket yang mencakup semuanya dan lebih murah dari
 *   totalnya; hematnya dihitung dari total pilihan.
 * - Selain itu: hemat dihitung dari harga item satuan yang setara dengan isi
 *   paket (batas bawah, karena isi paket yang tak punya padanan tidak dihitung).
 */
export function packageOffers(
    packages: PackageSummary[],
    items: CustomItem[],
    selected: CustomItem[]
): PackageOffers {
    if (selected.length > 0) {
        const total = itemsTotal(selected);
        const covering = packages
            .filter(
                (pkg) => coversItems(pkg, selected) && pkg.final_price < total
            )
            .sort((a, b) => a.final_price - b.final_price)
            .slice(0, OFFER_LIMIT)
            .map((pkg) => ({
                pkg,
                saving: roundMoney(total - pkg.final_price),
            }));

        if (covering.length > 0) {
            return {
                mode: 'selection',
                ...withHighlights(covering, 'dari pilihan Anda'),
            };
        }
    }

    const ranked = packages
        .map((pkg) => {
            const unitValue = itemsTotal(matchedItems(pkg, items));

            return {
                pkg,
                saving: Math.max(0, roundMoney(unitValue - pkg.final_price)),
            };
        })
        .sort(
            (a, b) =>
                b.saving - a.saving || a.pkg.final_price - b.pkg.final_price
        )
        .slice(0, OFFER_LIMIT);

    return {
        mode: selected.length > 0 ? 'uncovered' : 'general',
        ...withHighlights(ranked, 'dari harga satuan'),
    };
}
