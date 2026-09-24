import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '@/components/Badge';
import * as editorApi from '@/data/editor/editorApi';

type FeeSource = 'admin' | 'pool' | 'author' | 'project_owner';

type FeeItem = {
    id: number;
    title: string;
    author: string | null;
    status: string;
    source: FeeSource | null;
    requested_fee: number | null;
    admin_fee: number;
    total_fee: number;
    deadline: string | null;
};

type FeeSummary = {
    count: number;
    total: number;
    completed: number;
    in_progress: number;
};

type ProjectFee = {
    id: number;
    title: string;
    is_published: boolean;
    chapter_count: number;
    sold_count: number;
    discount: number;
    max_discount: number;
    fee_percent: number;
    potential_fee: number;
    sold_fee: number;
};

type ProjectFeeSummary = {
    count: number;
    potential_fee: number;
    sold_fee: number;
};

const statusLabels: Record<string, string> = {
    in_editing: 'Sedang Diedit',
    pending_admin_review_editor: 'Menunggu Review Admin',
    editor_revision_requested: 'Perlu Revisi',
    pending_penulis_review: 'Menunggu Review Penulis',
    completed: 'Selesai',
};

const sourceLabels: Record<FeeSource, string> = {
    admin: 'Ditunjuk admin',
    pool: 'Diambil dari pool',
    author: 'Dipilih langsung penulis',
    project_owner: 'Pemilik proyek Book Chapter',
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function SummaryStat({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: number;
    highlight?: boolean;
}) {
    return (
        <div>
            <p className="text-oxford-navy-900/55 text-xs">{label}</p>
            <p
                className={`font-semibold ${
                    highlight
                        ? 'text-forest-moss-700 text-xl'
                        : 'text-oxford-navy-900 text-lg'
                }`}
            >
                {rupiahFormatter.format(value)}
            </p>
        </div>
    );
}

export default function EditorFeePage() {
    const [summary, setSummary] = useState<FeeSummary | null>(null);
    const [items, setItems] = useState<FeeItem[]>([]);
    const [projects, setProjects] = useState<ProjectFee[]>([]);
    const [projectSummary, setProjectSummary] =
        useState<ProjectFeeSummary | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        editorApi
            .myFees()
            .then((response) => {
                setSummary(response.data.summary);
                setItems(response.data.items);
                setProjects(response.data.projects ?? []);
                setProjectSummary(response.data.project_summary ?? null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const hasProjectOwnerItem = items.some(
        (item) => item.source === 'project_owner'
    );

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Fee Saya</h5>

            <div className="flex flex-col gap-1 text-oxford-navy-900/65 text-sm">
                <p>Besar fee tergantung cara Anda mendapatkan naskah:</p>
                <ul className="list-disc pl-5 flex flex-col gap-0.5">
                    <li>
                        <strong className="text-oxford-navy-900/80">
                            Ditunjuk admin
                        </strong>{' '}
                        — sesuai fee yang ditetapkan admin.
                    </li>
                    <li>
                        <strong className="text-oxford-navy-900/80">
                            Diambil dari pool
                        </strong>{' '}
                        — sesuai harga pengerjaan naskah.
                    </li>
                    <li>
                        <strong className="text-oxford-navy-900/80">
                            Dipilih langsung oleh penulis
                        </strong>{' '}
                        — fee yang Anda tetapkan + fee dari admin.
                    </li>
                </ul>
                <p>
                    Fee naskah dianggap selesai setelah naskahnya berstatus
                    Selesai.
                </p>
            </div>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : (
                <>
                    {summary && (
                        <div className="flex flex-row flex-wrap gap-8 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
                            <SummaryStat
                                label="Total Fee"
                                value={summary.total}
                                highlight
                            />
                            <SummaryStat
                                label="Naskah Selesai"
                                value={summary.completed}
                            />
                            <SummaryStat
                                label="Sedang Dikerjakan"
                                value={summary.in_progress}
                            />
                        </div>
                    )}

                    {items.length === 0 ? (
                        <p className="text-oxford-navy-900/70 text-sm">
                            Belum ada naskah yang Anda kerjakan.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {items.map((item) => (
                                <Link
                                    key={item.id}
                                    to={`/dashboard/naskah/${item.id}`}
                                    className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4 hover:bg-forest-moss-50"
                                >
                                    <div className="flex flex-row items-start justify-between gap-4">
                                        <div>
                                            <p className="text-oxford-navy-900 font-semibold">
                                                {item.title}
                                            </p>
                                            {item.author && (
                                                <p className="text-oxford-navy-900/65 text-sm">
                                                    Diajukan oleh {item.author}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-forest-moss-700 text-sm shrink-0">
                                            {statusLabels[item.status] ??
                                                item.status}
                                        </span>
                                    </div>

                                    {item.source && (
                                        <Badge variant="accent">
                                            {sourceLabels[item.source]}
                                        </Badge>
                                    )}

                                    {item.source === 'author' &&
                                    item.requested_fee !== null ? (
                                        <p className="text-oxford-navy-900/80 text-sm">
                                            Fee permintaan Anda{' '}
                                            {rupiahFormatter.format(
                                                item.requested_fee
                                            )}{' '}
                                            + fee dari admin{' '}
                                            {rupiahFormatter.format(
                                                item.admin_fee
                                            )}{' '}
                                            ={' '}
                                            <strong className="text-forest-moss-700 text-base">
                                                {rupiahFormatter.format(
                                                    item.total_fee
                                                )}
                                            </strong>
                                        </p>
                                    ) : (
                                        <p className="text-forest-moss-700 font-semibold">
                                            {rupiahFormatter.format(
                                                item.total_fee
                                            )}
                                        </p>
                                    )}

                                    {item.deadline && (
                                        <p className="text-oxford-navy-900/55 text-xs">
                                            Deadline: {item.deadline}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}

                    {hasProjectOwnerItem && (
                        <p className="text-oxford-navy-900/55 text-xs">
                            Naskah berlabel &quot;Pemilik proyek Book
                            Chapter&quot; tidak punya fee sendiri — fee-nya
                            dihitung di tingkat proyek pada bagian Proyek Book
                            Chapter di bawah.
                        </p>
                    )}

                    {projects.length > 0 && (
                        <div className="flex flex-col gap-3 pt-2">
                            <h6 className="font-display text-oxford-navy-700 text-lg font-bold">
                                Proyek Book Chapter
                            </h6>

                            <p className="text-oxford-navy-900/65 text-sm">
                                Fee per bab = diskon maksimal yang ditetapkan
                                admin − diskon yang Anda berikan (dalam persen
                                dari harga bab). Makin kecil diskon yang Anda
                                beri, makin besar fee Anda.
                            </p>

                            {projectSummary && (
                                <div className="flex flex-row flex-wrap gap-8 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
                                    <SummaryStat
                                        label="Potensi Fee (semua bab terjual & buku terbit)"
                                        value={projectSummary.potential_fee}
                                        highlight
                                    />
                                    <SummaryStat
                                        label="Fee dari Bab Terjual"
                                        value={projectSummary.sold_fee}
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                {projects.map((project) => (
                                    <Link
                                        key={project.id}
                                        to={`/dashboard/proyek-bab-buku-saya/${project.id}`}
                                        className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4 hover:bg-forest-moss-50"
                                    >
                                        <div className="flex flex-row items-start justify-between gap-4">
                                            <div>
                                                <p className="text-oxford-navy-900 font-semibold">
                                                    {project.title}
                                                </p>
                                                <p className="text-oxford-navy-900/65 text-sm">
                                                    {project.sold_count}/
                                                    {project.chapter_count} bab
                                                    terjual
                                                </p>
                                            </div>
                                            <span className="text-forest-moss-700 text-sm shrink-0">
                                                {project.is_published
                                                    ? 'Sudah terbit'
                                                    : 'Belum terbit'}
                                            </span>
                                        </div>

                                        <p className="text-oxford-navy-900/80 text-sm">
                                            Fee {project.max_discount}% − diskon{' '}
                                            {project.discount}% ={' '}
                                            <strong className="text-oxford-navy-900">
                                                {project.fee_percent}%
                                            </strong>{' '}
                                            per bab
                                        </p>

                                        <p className="text-oxford-navy-900/80 text-sm">
                                            {project.is_published
                                                ? 'Total fee bila seluruh bab terjual'
                                                : 'Potensi total fee jika buku terbit & seluruh bab terjual'}
                                            :{' '}
                                            <strong className="text-forest-moss-700 text-base">
                                                {rupiahFormatter.format(
                                                    project.potential_fee
                                                )}
                                            </strong>
                                        </p>

                                        <p className="text-oxford-navy-900/65 text-xs">
                                            Fee dari bab yang sudah terjual:{' '}
                                            {rupiahFormatter.format(
                                                project.sold_fee
                                            )}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
