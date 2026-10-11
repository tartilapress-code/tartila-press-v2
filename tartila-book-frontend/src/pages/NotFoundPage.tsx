import { Link } from 'react-router-dom';
import Button from '@/components/Button';

export default function NotFoundPage() {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
            <p className="font-display text-6xl font-bold text-forest-moss-600">
                404
            </p>
            <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                Halaman tidak ditemukan
            </h1>
            <p className="text-oxford-navy-900/70">
                Alamat yang Anda buka tidak ada atau sudah dipindahkan.
            </p>
            <Link to="/">
                <Button>Ke beranda</Button>
            </Link>
        </div>
    );
}
