import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import router from '@/router.tsx';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthProvider';
import { CartProvider } from '@/context/CartProvider';

const root = document.getElementById('root');
createRoot(root!).render(
    <StrictMode>
        <AuthProvider>
            <CartProvider>
                <RouterProvider router={router} />
            </CartProvider>
        </AuthProvider>
    </StrictMode>
);
