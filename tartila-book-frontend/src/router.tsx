import { createBrowserRouter } from 'react-router-dom';
import RequireAuth from '@/components/RequireAuth';
import PublicLayout from '@/layouts/PublicLayout';
import BookDetailPage from '@/pages/BookDetailPage';
import CatalogPage from '@/pages/CatalogPage';
import CheckoutPage from '@/pages/CheckoutPage';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';
import NotificationsPage from '@/pages/NotificationsPage';
import OrdersPage from '@/pages/OrdersPage';
import PlansPage from '@/pages/PlansPage';
import RoyaltyPage from '@/pages/RoyaltyPage';
import ShelfPage from '@/pages/ShelfPage';
import WebOnlyPage from '@/pages/WebOnlyPage';
import { isApp } from '@/lib/platform';

const router = createBrowserRouter([
    // Layar baca penuh (tanpa navbar/footer).
    {
        path: '/baca/:id',
        lazy: async () => ({
            Component: (await import('@/pages/ReaderPage')).default,
        }),
    },
    {
        element: <PublicLayout />,
        children: [
            { index: true, element: <HomePage /> },
            { path: 'katalog', element: <CatalogPage /> },
            { path: 'buku/:id', element: <BookDetailPage /> },
            {
                path: 'langganan',
                element: isApp ? (
                    <WebOnlyPage path="/langganan" />
                ) : (
                    <PlansPage />
                ),
            },
            { path: 'masuk', element: <LoginPage /> },
            {
                element: <RequireAuth />,
                children: [
                    { path: 'rak', element: <ShelfPage /> },
                    {
                        path: 'pesanan',
                        element: isApp ? (
                            <WebOnlyPage path="/pesanan" />
                        ) : (
                            <OrdersPage />
                        ),
                    },
                    {
                        path: 'beli/buku/:id',
                        element: isApp ? (
                            <WebOnlyPage />
                        ) : (
                            <CheckoutPage kind="book" />
                        ),
                    },
                    {
                        path: 'beli/langganan/:id',
                        element: isApp ? (
                            <WebOnlyPage />
                        ) : (
                            <CheckoutPage kind="plan" />
                        ),
                    },
                    { path: 'notifikasi', element: <NotificationsPage /> },
                    { path: 'royalti', element: <RoyaltyPage /> },
                ],
            },
            {
                path: 'admin',
                element: isApp ? (
                    <WebOnlyPage path="/admin" />
                ) : (
                    <RequireAuth admin />
                ),
                children: [
                    {
                        lazy: async () => ({
                            Component: (await import('@/layouts/AdminLayout'))
                                .default,
                        }),
                        children: [
                            {
                                index: true,
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminBooksPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'buku/baru',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminBookFormPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'buku/:bookId',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminBookFormPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'pilihan',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminTermsPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'langganan',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminPlansPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'akses',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminRulesPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'pembayaran',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminOrdersPage')
                                    ).default,
                                }),
                            },
                            {
                                path: 'royalti',
                                lazy: async () => ({
                                    Component: (
                                        await import('@/pages/admin/AdminRoyaltiesPage')
                                    ).default,
                                }),
                            },
                        ],
                    },
                ],
            },
            { path: '*', element: <NotFoundPage /> },
        ],
    },
]);

export default router;
