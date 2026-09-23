import { Outlet } from 'react-router-dom';

export default function RegistrationLayout() {
    return (
        <>
            <div
                className="
            flex flex-row items-center justify-center
            h-dvh w-full relative
            bg-[url('@/assets/images/buku.png')] bg-no-repeat bg-cover bg-center
            "
            >
                <Outlet />
            </div>
        </>
    );
}
