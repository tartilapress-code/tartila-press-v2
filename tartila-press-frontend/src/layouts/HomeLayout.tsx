import EmailVerificationBanner from '@/components/EmailVerificationBanner';
import Footer from '@/components/Footer';
import Navbar from '@/components/navbar/Navbar';
import { Outlet, useLocation } from 'react-router-dom';

export default function HomeLayout() {
    const { pathname } = useLocation();

    return (
        <>
            <Navbar />
            {pathname !== '/verifikasi-email' && <EmailVerificationBanner />}
            <main className="mx-10 my-2">
                <Outlet />
            </main>
            <Footer />
        </>
    );
}
