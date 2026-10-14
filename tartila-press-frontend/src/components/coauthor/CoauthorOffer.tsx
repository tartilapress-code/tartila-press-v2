import EditorPicker from '@/components/editor/EditorPicker';
import type { CoauthorOfferState } from './useCoauthorOffer';

export default function CoauthorOffer({
    offer,
    formatFee,
}: {
    offer: CoauthorOfferState;
    formatFee: (fee: number) => string;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
            <label className="flex flex-row items-center gap-2 font-medium text-oxford-navy-900">
                <input
                    type="checkbox"
                    checked={offer.wants}
                    onChange={(event) => offer.setWants(event.target.checked)}
                />
                Saya punya naskah mentah dan ingin dibantu disusun co-author
            </label>

            {offer.wants && (
                <>
                    <div className="rounded-lg bg-white p-3 text-sm leading-relaxed text-oxford-navy-900/85 ring-1 ring-forest-moss-100">
                        <p className="font-semibold text-oxford-navy-800">
                            Perlu Anda ketahui tentang co-author
                        </p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5">
                            <li>
                                Co-author membantu menyusun naskah mentah Anda,
                                lalu naskah dikoreksi editor (orang yang berbeda
                                dari co-author).
                            </li>
                            <li>
                                Nama co-author dicantumkan sebagai{' '}
                                <strong>penulis terakhir</strong> buku ini,
                                termasuk di halaman buku dan MOU.
                            </li>
                            <li>
                                Co-author mendapat jatah royalti tetap{' '}
                                <strong>{offer.royaltyPercent}%</strong> untuk
                                buku cetak maupun ebook, dan ikut menandatangani
                                MOU seperti penulis lain. Jatah ini terpisah
                                dari pembagian royalti antar-penulis.
                            </li>
                            <li>
                                Alur: naskah Anda dikoreksi admin → disusun
                                co-author → dikoreksi admin → Anda setujui atau
                                minta revisi → baru dikerjakan editor.
                            </li>
                        </ul>
                    </div>

                    <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                        <input
                            type="checkbox"
                            checked={offer.choosesOwn}
                            onChange={(event) =>
                                offer.setChoosesOwn(event.target.checked)
                            }
                        />
                        Saya ingin memilih co-author sendiri (biaya tambahan).
                        Jika tidak, admin yang menentukan.
                    </label>

                    {offer.choosesOwn && (
                        <EditorPicker
                            editors={offer.coauthors}
                            selectedId={offer.selectedId}
                            onSelect={offer.setSelectedId}
                            formatFee={formatFee}
                            groupName="coauthor"
                            hint="Klik nama co-author untuk melihat bahasa yang dikuasai dan keterangannya."
                            emptyText="Belum ada co-author yang tersedia."
                        />
                    )}
                </>
            )}
        </div>
    );
}
