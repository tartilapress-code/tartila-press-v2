import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';
import * as bookChapterProjectApi from '@/data/bookChapterProject/bookChapterProjectApi';
import Button from '@/components/Button/Button';
import Badge from '@/components/Badge';

type Category = { id: number; name: string };

type ChapterSlot = {
    id: number;
    chapter_number: number;
    title: string;
    sop_terms?: string | null;
    effective_price: string | number;
    effective_discount: number;
    final_price: number;
    slot_status: 'open' | 'reserved' | 'submitted' | 'completed';
};

type ProjectDetail = {
    id: number;
    title: string;
    front_cover: string | null;
    back_cover: string | null;
    description?: string | null;
    about: string | null;
    facilities: string[] | null;
    services: string[] | null;
    price: string;
    discount: number;
    final_price: number;
    estimated_publish_date: string | null;
    submission_deadline: string | null;
    category: Category | null;
    field_category: Category | null;
    owner_editor: { id: number; name: string } | null;
    chapters: ChapterSlot[];
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const monthYearFormatter = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
});

const slotStatusLabels: Record<ChapterSlot['slot_status'], string> = {
    open: 'Terbuka',
    reserved: 'Dipesan',
    submitted: 'Sedang Ditulis/Diedit',
    completed: 'Selesai',
};

const slotStatusClasses: Record<ChapterSlot['slot_status'], string> = {
    open: 'text-forest-moss-300',
    reserved: 'text-yellow-400',
    submitted: 'text-blue-300',
    completed: 'text-white/60',
};

export default function BookChapterProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        Promise.resolve()
            .then(() => bookChapterProjectApi.get(id ?? ''))
            .then((response) => setProject(response.data))
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <p className="text-oxford-navy-900">Memuat...</p>
            </div>
        );
    }

    if (notFound || !project) {
        return <ErrorPage />;
    }

    function handleBuySlot(chapterId: number) {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        navigate(`/dashboard/beli-slot-bab/${project!.id}/${chapterId}`);
    }

    return (
        <div className="flex flex-col gap-6 my-10 max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row gap-6 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-8">
                {project.front_cover && (
                    <img
                        src={project.front_cover}
                        alt={project.title}
                        className="w-48 h-64 object-cover rounded-lg self-center md:self-start"
                    />
                )}

                <div className="flex flex-col gap-2">
                    {(project.category || project.field_category) && (
                        <p className="text-forest-moss-300 text-sm">
                            {[project.category?.name, project.field_category?.name]
                                .filter(Boolean)
                                .join(' • ')}
                        </p>
                    )}
                    <h1 className="text-white text-3xl font-bold">
                        {project.title}
                    </h1>

                    {project.estimated_publish_date && (
                        <p className="text-white/70 text-sm">
                            Perkiraan terbit:{' '}
                            {monthYearFormatter.format(
                                new Date(project.estimated_publish_date)
                            )}
                        </p>
                    )}
                    {project.submission_deadline && (
                        <p className="text-white/70 text-sm">
                            Batas pengumpulan naskah:{' '}
                            {new Date(
                                project.submission_deadline
                            ).toLocaleString('id-ID')}
                        </p>
                    )}
                    {project.owner_editor && (
                        <p className="text-white/70 text-sm">
                            Editor: {project.owner_editor.name}
                        </p>
                    )}

                    <div className="flex flex-row items-center gap-3 mt-1">
                        {project.discount > 0 && (
                            <span className="text-white/50 line-through">
                                {rupiahFormatter.format(Number(project.price))}
                            </span>
                        )}
                        <span className="text-forest-moss-300 text-xl font-semibold">
                            {rupiahFormatter.format(project.final_price)}
                        </span>
                        {project.discount > 0 && (
                            <Badge variant="primary">
                                Diskon {project.discount}%
                            </Badge>
                        )}
                    </div>

                    {project.description && (
                        <p className="text-white/80 mt-2">
                            {project.description}
                        </p>
                    )}
                </div>
            </div>

            {!isAuthenticated && (
                <div className="flex flex-row items-center justify-between gap-3 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl px-6 py-4">
                    <p className="text-white/80 text-sm">
                        Masuk untuk melihat deskripsi lengkap proyek dan SOP
                        tiap bab.
                    </p>
                    <Link to="/login">
                        <Button variant="secondary">Masuk</Button>
                    </Link>
                </div>
            )}

            {(project.about || project.facilities?.length || project.services?.length) && (
                <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                    {project.about && (
                        <div>
                            <h2 className="text-white text-lg font-semibold mb-1">
                                Tentang Buku
                            </h2>
                            <p className="text-white/80 text-sm">
                                {project.about}
                            </p>
                        </div>
                    )}
                    {!!project.services?.length && (
                        <div>
                            <h3 className="text-white font-semibold mb-1">
                                Layanan
                            </h3>
                            <ul className="text-white/80 text-sm">
                                {project.services.map((service) => (
                                    <li
                                        key={service}
                                        className="list-disc list-inside"
                                    >
                                        {service}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {!!project.facilities?.length && (
                        <div>
                            <h3 className="text-white font-semibold mb-1">
                                Fasilitas
                            </h3>
                            <ul className="text-white/80 text-sm">
                                {project.facilities.map((facility) => (
                                    <li
                                        key={facility}
                                        className="list-disc list-inside"
                                    >
                                        {facility}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-white text-xl font-semibold">
                    Daftar Bab
                </h2>
                <div className="flex flex-col gap-3">
                    {project.chapters.map((chapter) => (
                        <div
                            key={chapter.id}
                            className="flex flex-col gap-2 bg-oxford-navy-900/40 rounded-lg p-4"
                        >
                            <div className="flex flex-row items-center justify-between gap-4">
                                <div>
                                    <p className="text-white font-semibold">
                                        Bab {chapter.chapter_number} —{' '}
                                        {chapter.title}
                                    </p>
                                    <p className="text-forest-moss-300 text-sm">
                                        {rupiahFormatter.format(
                                            chapter.final_price
                                        )}
                                    </p>
                                    <p
                                        className={`text-xs font-semibold ${slotStatusClasses[chapter.slot_status]}`}
                                    >
                                        {slotStatusLabels[chapter.slot_status]}
                                    </p>
                                </div>
                                {chapter.slot_status === 'open' && (
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            handleBuySlot(chapter.id)
                                        }
                                    >
                                        Beli Slot Ini
                                    </Button>
                                )}
                            </div>
                            {chapter.sop_terms && (
                                <p className="text-white/60 text-xs">
                                    SOP: {chapter.sop_terms}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <Link
                to="/buku-bab"
                className="text-forest-moss-300 text-sm hover:text-forest-moss-200 self-center"
            >
                ← Kembali ke daftar Book Chapter
            </Link>
        </div>
    );
}
