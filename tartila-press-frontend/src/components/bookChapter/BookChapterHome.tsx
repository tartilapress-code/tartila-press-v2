import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as projectApi from '@/data/bookChapterProject/bookChapterProjectApi';
import ChapterProjectCard, {
    ChapterProjectCardSkeleton,
} from '@/components/bookChapter/ChapterProjectCard';
import type { ChapterProject } from '@/lib/bookChapterPublic';

const COUNT = 3;

/**
 * Proyek Book Chapter yang masih membuka slot, di beranda: yang direkomendasikan admin (pin)
 * paling atas, lalu yang terbaru. Daftar lengkap ada di /buku-bab.
 */
export default function BookChapterHome() {
    const { t } = useTranslation();
    const [projects, setProjects] = useState<ChapterProject[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        projectApi
            .list({ per_page: COUNT })
            .then((response) => setProjects(response.data))
            .catch(() => setProjects([]))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: COUNT }).map((_, index) => (
                    <ChapterProjectCardSkeleton key={index} />
                ))}
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                {t('bookChapter.list.empty')}
            </p>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
                <ChapterProjectCard key={project.id} project={project} />
            ))}
        </div>
    );
}
