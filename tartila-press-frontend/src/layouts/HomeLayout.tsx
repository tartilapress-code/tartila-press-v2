import Footer from '@/components/Footer';
import { Outlet } from 'react-router-dom';

export default function HomeLayout() {
    return (
        <>
            <main className="mx-10 my-2">
                <Outlet />
            </main>
            <Footer />
        </>
    );
}
