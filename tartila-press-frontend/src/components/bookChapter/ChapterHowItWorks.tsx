const steps = [
    {
        title: 'Pilih proyek & bab',
        text: 'Temukan proyek yang cocok, lalu pilih bab yang masih terbuka.',
    },
    {
        title: 'Pesan & bayar slot',
        text: 'Konfirmasi pesanan, lalu unggah bukti bayar di halaman Pesanan.',
    },
    {
        title: 'Tulis & terbit bersama',
        text: 'Kirim naskah bab Anda. Setelah diedit, bab terbit bersama penulis lain dalam satu buku.',
    },
];

/** Kartu "Cara Kerja" tiga langkah untuk membeli slot Book Chapter. */
export default function ChapterHowItWorks({
    className = '',
}: {
    className?: string;
}) {
    return (
        <section
            aria-labelledby="chapter-how-title"
            className={`rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ${className}`}
        >
            <h2
                id="chapter-how-title"
                className="font-display text-lg font-bold text-oxford-navy-700"
            >
                Cara Kerja
            </h2>

            <ol className="mt-4 flex flex-col gap-4">
                {steps.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                        <span
                            aria-hidden
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest-moss-100 text-sm font-semibold text-forest-moss-800"
                        >
                            {index + 1}
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-oxford-navy-700">
                                {step.title}
                            </h3>
                            <p className="mt-0.5 text-[13px] leading-relaxed text-oxford-navy-900/60">
                                {step.text}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
