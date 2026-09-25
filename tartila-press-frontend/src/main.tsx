import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import router from '@/router.tsx';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthProvider';
import { CartProvider } from '@/context/CartProvider';
import { initI18n } from '@/i18n';

const root = document.getElementById('root');

// Terjemahan disiapkan lebih dulu supaya halaman tidak sempat tampil dalam
// bahasa yang salah.
void initI18n().then(() => {
    createRoot(root!).render(
        <StrictMode>
            <AuthProvider>
                <CartProvider>
                    <RouterProvider router={router} />
                </CartProvider>
            </AuthProvider>
        </StrictMode>
    );
});
