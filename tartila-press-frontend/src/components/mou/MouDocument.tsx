import { useAboutPage } from '@/hooks/useAboutPage';
import * as mouApi from '@/data/mou/mouApi';
import { whatsappUrl } from '@/lib/siteContact';

const { formatSignedAt } = mouApi;

function Article({
    number,
    title,
    children,
}: {
    number: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-2">
            <h6 className="text-center text-sm font-bold text-oxford-navy-900">
                Pasal {number}
                <br />
                {title}
            </h6>
            {children}
        </section>
    );
}

function Terms({ items }: { items: string[] }) {
    return (
        <ol className="list-decimal flex flex-col gap-1 pl-5 text-sm text-oxford-navy-900/90">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ol>
    );
}

/**
 * Isi MOU distribusi buku untuk ditinjau sebelum tanda tangan: para pihak,
 * hak distribusi (dengan pilihan bila penulis pertama yang memilih),
 * royalti per penulis, hak & tanggung jawab, ketentuan adendum, dan daftar
 * tanda tangan penulis.
 */
export default function MouDocument({
    mou,
    choice,
    onChoiceChange,
}: {
    mou: mouApi.Mou;
    // Penulis pertama memilih satu hak distribusi (mode "pilih salah satu").
    choice?: string | null;
    onChoiceChange?: (key: string) => void;
}) {
    const { about } = useAboutPage();
    const content = mou.content;
    const types = content.royalty_types;
    const choosing = Boolean(onChoiceChange) && mou.me?.chooses_distribution;
    const chosen = content.distribution_options.filter((option) =>
        mou.distribution_choice.includes(option.key)
    );
    const isChapter = mou.type === 'chapter';
    const several = mou.signatories.length > 1;

    return (
        <div className="flex flex-col gap-5 rounded-xl bg-white p-5 ring-1 ring-oxford-navy-900/10 sm:p-7">
            <div className="flex flex-col items-center gap-1 text-center">
                <p className="font-display text-lg font-bold text-oxford-navy-900">
                    {content.title}
                </p>
                <p className="text-xs text-oxford-navy-900/60">
                    Nomor: {mou.number} • {mou.type_label}
                </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-oxford-navy-900/90">
                <p>
                    <span className="font-semibold">Pihak Pertama:</span>{' '}
                    {mou.publisher.responsible_name}, Penanggung Jawab{' '}
                    {mou.publisher.name}, {mou.publisher.address}.
                </p>
                <p>
                    <span className="font-semibold">Pihak Kedua:</span>{' '}
                    {mou.signatories.map((row) => row.name).join(', ')}
                    {several ? ' (bersama-sama)' : ''}.
                </p>
                <p>{content.opening}</p>
            </div>

            <Article number={1} title="Objek Perjanjian">
                <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-oxford-navy-900/60">Judul buku</dt>
                    <dd className="text-oxford-navy-900">{mou.title}</dd>
                    <dt className="text-oxford-navy-900/60">Layanan ISBN</dt>
                    <dd className="text-oxford-navy-900">
                        {[
                            types.physical ? 'Buku cetak' : null,
                            types.ebook ? 'Buku elektronik (ebook)' : null,
                        ]
                            .filter(Boolean)
                            .join(' dan ')}
                    </dd>
                </dl>
            </Article>

            <Article number={2} title="Hak Distribusi">
                {choosing ? (
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-sm text-oxford-navy-900">
                            Pilih <strong>satu</strong> hak distribusi buku:
                        </legend>
                        {content.distribution_options.map((option) => (
                            <label
                                key={option.key}
                                className={`flex cursor-pointer flex-row gap-3 rounded-lg p-3 ring-1 ${choice === option.key ? 'bg-forest-moss-50 ring-forest-moss-400' : 'ring-oxford-navy-900/15'}`}
                            >
                                <input
                                    type="radio"
                                    name={`distribution-${mou.id}`}
                                    className="mt-1"
                                    checked={choice === option.key}
                                    onChange={() =>
                                        onChoiceChange?.(option.key)
                                    }
                                />
                                <span className="text-sm">
                                    <span className="font-semibold text-oxford-navy-900">
                                        {option.name}
                                    </span>
                                    {option.description && (
                                        <span className="block text-oxford-navy-900/70">
                                            {option.description}
                                        </span>
                                    )}
                                </span>
                            </label>
                        ))}
                    </fieldset>
                ) : chosen.length > 0 ? (
                    <>
                        <p className="text-sm text-oxford-navy-900/90">
                            Pihak Kedua memberikan hak distribusi buku kepada
                            Pihak Pertama melalui:
                        </p>
                        <Terms
                            items={chosen.map(
                                (option) =>
                                    option.name +
                                    (option.description
                                        ? ` — ${option.description}`
                                        : '')
                            )}
                        />
                    </>
                ) : (
                    <p className="text-sm text-amber-700">
                        {content.distribution_mode === 'one'
                            ? isChapter
                                ? 'Hak distribusi ditetapkan admin.'
                                : 'Dipilih penulis pertama saat menandatangani (satu dari pilihan berikut).'
                            : 'Belum ada hak distribusi.'}
                    </p>
                )}
            </Article>

            <Article number={3} title="Royalti">
                <p className="text-sm text-oxford-navy-900/90">
                    Royalti dihitung dari harga jual buku yang terjual sesuai
                    jenis penjualannya.{' '}
                    {several &&
                        (isChapter
                            ? 'Nilai royalti dibagi per bab yang ditulis masing-masing penulis.'
                            : 'Nilai royalti dibagi rata antar-penulis.')}{' '}
                    Jenis royalti mengikuti layanan ISBN yang diambil.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-sm">
                        <thead>
                            <tr className="bg-forest-moss-50 text-left text-oxford-navy-900">
                                <th className="p-2 font-semibold">No</th>
                                <th className="p-2 font-semibold">
                                    Nama penulis
                                </th>
                                {isChapter && (
                                    <th className="p-2 font-semibold">Bab</th>
                                )}
                                <th className="p-2 text-right font-semibold">
                                    Royalti buku fisik
                                </th>
                                <th className="p-2 text-right font-semibold">
                                    Royalti ebook
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {mou.signatories.map((row, index) => (
                                <tr
                                    key={row.user_id}
                                    className={`border-t border-forest-moss-100 ${row.is_me ? 'bg-amber-50/50' : ''}`}
                                >
                                    <td className="p-2">{index + 1}</td>
                                    <td className="p-2">
                                        {row.name}
                                        {row.is_me && (
                                            <span className="ml-1 text-xs text-oxford-navy-900/60">
                                                (Anda)
                                            </span>
                                        )}
                                    </td>
                                    {isChapter && (
                                        <td className="p-2">
                                            {row.chapters ?? '—'}
                                        </td>
                                    )}
                                    <td className="p-2 text-right">
                                        {types.physical
                                            ? mouApi.percent(
                                                  row.royalty_physical
                                              )
                                            : 'Tidak berlaku'}
                                    </td>
                                    <td className="p-2 text-right">
                                        {types.ebook
                                            ? mouApi.percent(row.royalty_ebook)
                                            : 'Tidak berlaku'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Article>

            <Article number={4} title="Hak dan Tanggung Jawab Pihak Pertama">
                <Terms items={content.first_party_terms} />
            </Article>

            <Article number={5} title="Hak dan Tanggung Jawab Pihak Kedua">
                <Terms items={content.second_party_terms} />
            </Article>

            <Article number={6} title="Perubahan, Adendum dan Penyelesaian">
                <Terms items={content.closing_terms} />
            </Article>

            {content.contact_note && (
                <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                    <p>{content.contact_note}</p>
                    <div className="flex flex-row flex-wrap gap-2">
                        <a
                            href={whatsappUrl(about.profile.whatsapp)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md bg-forest-moss-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-moss-700"
                        >
                            Hubungi admin via WhatsApp
                        </a>
                        {about.profile.contact_email && (
                            <a
                                href={`mailto:${about.profile.contact_email}?subject=${encodeURIComponent(`MOU ${mou.number} — ${mou.title}`)}`}
                                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-oxford-navy-800 ring-1 ring-oxford-navy-900/20 hover:bg-oxford-navy-900/[0.03]"
                            >
                                Email {about.profile.contact_email}
                            </a>
                        )}
                    </div>
                </div>
            )}

            <section className="flex flex-col gap-2">
                <h6 className="text-sm font-bold text-oxford-navy-900">
                    Tanda tangan Pihak Kedua
                </h6>
                <ul className="flex flex-col divide-y divide-forest-moss-100 rounded-lg ring-1 ring-forest-moss-100">
                    {mou.signatories.map((row) => (
                        <li
                            key={row.user_id}
                            className="flex flex-col gap-0.5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                            <span className="text-oxford-navy-900">
                                Penulis {row.position}: {row.name}
                            </span>
                            {row.signed_at ? (
                                <span className="text-xs text-forest-moss-700">
                                    Ditandatangani{' '}
                                    {formatSignedAt(row.signed_at)}
                                </span>
                            ) : (
                                <span className="text-xs text-amber-700">
                                    Belum ditandatangani
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-oxford-navy-900/60">
                    Setelah semua penulis menandatangani, Pihak Pertama
                    menandatangani, memberi stempel dan membubuhkan meterai.
                </p>
            </section>
        </div>
    );
}
