import { createBrowserRouter } from 'react-router-dom';
import HomeLayout from './layouts/HomeLayout';
import HomePage from './pages/Home/HomePage';
import LayananPage from './pages/Home/LayananPage';
import ErrorPage from './pages/ErrorPage';
import RegistrationPage from './pages/Registration/RegistrationPage';
import LoginPage from './pages/Login/LoginPage';
import VerifyEmailPage from './pages/Auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage';
import AuthorProfilePage from './pages/PublicProfile/AuthorProfilePage';
import ProtectedRoute from './routes/ProtectedRoute';
import UserLayout from './layouts/UserLayout';
import AccountSettingsPage from './pages/Dashboard/AccountSettingsPage';
import DashboardHomePage from './pages/Dashboard/DashboardHomePage';
import MyPublishedBooksPage from './pages/Dashboard/MyPublishedBooksPage';
import ManuscriptPoolSettingsPage from './pages/Admin/ManuscriptPoolSettingsPage';
import PersonalDataPage from './pages/Dashboard/PersonalDataPage';
import PublicProfilePage from './pages/Dashboard/PublicProfilePage';
import AdminRoute from './routes/AdminRoute';
import AdminLayout from './layouts/AdminLayout';
import RoleRequestsPage from './pages/Admin/RoleRequestsPage';
import UserManagementPage from './pages/Admin/UserManagementPage';
import PackageListPage from './pages/Package/PackageListPage';
import PackageDetailPage from './pages/Package/PackageDetailPage';
import TakePackagePage from './pages/Dashboard/TakePackagePage';
import CustomPackagePage from './pages/Dashboard/CustomPackagePage';
import MyOrdersPage from './pages/Dashboard/MyOrdersPage';
import InvoicePage from './pages/Dashboard/InvoicePage';
import EditorProfilePage from './pages/Dashboard/EditorProfilePage';
import PackagesPage from './pages/Admin/PackagesPage';
import CustomPackageItemsPage from './pages/Admin/CustomPackageItemsPage';
import OrdersPage from './pages/Admin/OrdersPage';
import PenulisListPage from './pages/PublicProfile/PenulisListPage';
import EditorListPage from './pages/PublicProfile/EditorListPage';
import ManuscriptSubmitPage from './pages/Dashboard/ManuscriptSubmitPage';
import ManuscriptDetailPage from './pages/Dashboard/ManuscriptDetailPage';
import MyManuscriptsPage from './pages/Dashboard/MyManuscriptsPage';
import NotificationsPage from './pages/Dashboard/NotificationsPage';
import AuthorsManagementPage from './pages/Admin/AuthorsManagementPage';
import CoverProjectPage from './pages/Admin/CoverProjectPage';
import CoversPage from './pages/Admin/CoversPage';
import RecommendationsPage from './pages/Admin/RecommendationsPage';
import EditorsManagementPage from './pages/Admin/EditorsManagementPage';
import EditorCoauthorManuscriptsPage from './pages/Dashboard/EditorCoauthorManuscriptsPage';
import EditorCoauthorPoolPage from './pages/Dashboard/EditorCoauthorPoolPage';
import EditorManuscriptPoolPage from './pages/Dashboard/EditorManuscriptPoolPage';
import EditorManuscriptsPage from './pages/Dashboard/EditorManuscriptsPage';
import EditorFeePage from './pages/Dashboard/EditorFeePage';
import ManuscriptsPage from './pages/Admin/ManuscriptsPage';
import BookCatalogPage from './pages/Book/BookCatalogPage';
import BookDetailPage from './pages/Book/BookDetailPage';
import BookChapterPreviewPage from './pages/Book/BookChapterPreviewPage';
import BooksPage from './pages/Admin/BooksPage';
import CombineBookChapterPage from './pages/Admin/CombineBookChapterPage';
import BookCategoriesPage from './pages/Admin/BookCategoriesPage';
import FieldCategoriesPage from './pages/Admin/FieldCategoriesPage';
import BookChapterProjectListPage from './pages/BookChapterProject/BookChapterProjectListPage';
import BookChapterProjectDetailPage from './pages/BookChapterProject/BookChapterProjectDetailPage';
import BuyBookChapterSlotPage from './pages/Dashboard/BuyBookChapterSlotPage';
import MyBookChapterProjectsPage from './pages/Dashboard/MyBookChapterProjectsPage';
import MyBookChapterProjectDetailPage from './pages/Dashboard/MyBookChapterProjectDetailPage';
import AdminBookChapterProjectsPage from './pages/Admin/BookChapterProjectsPage';
import AdminBookChapterProjectDetailPage from './pages/Admin/BookChapterProjectDetailPage';
import BookChapterBulkImportPage from './pages/Admin/BookChapterBulkImportPage';
import BookChapterSettingsPage from './pages/Admin/BookChapterSettingsPage';
import BuyBookPage from './pages/Dashboard/BuyBookPage';
import CartPage from './pages/Dashboard/CartPage';
import PaymentMethodsPage from './pages/Admin/PaymentMethodsPage';
import RoyaltyPage from './pages/Dashboard/RoyaltyPage';
import MyVouchersPage from './pages/Dashboard/MyVouchersPage';
import WalletPage from './pages/Dashboard/WalletPage';
import IsbnApplicationPage from './pages/Dashboard/IsbnApplicationPage';
import MouPage from './pages/Dashboard/MouPage';
import RoyaltiesPage from './pages/Admin/RoyaltiesPage';
import VouchersPage from './pages/Admin/VouchersPage';
import WithdrawalsPage from './pages/Admin/WithdrawalsPage';
import FinancePage from './pages/Admin/FinancePage';
import HkiPage from './pages/Admin/HkiPage';
import AboutSettingsPage from './pages/Admin/AboutSettingsPage';
import AboutPage from './pages/About/AboutPage';
import PublishManuscriptsPage from './pages/Admin/PublishManuscriptsPage';
import IsbnSettingsPage from './pages/Admin/IsbnSettingsPage';
import MouTemplatePage from './pages/Admin/MouTemplatePage';
import MousPage from './pages/Admin/MousPage';
import MouDetailPage from './pages/Admin/MouDetailPage';
import SocialPostPage from './pages/Admin/SocialPostPage';
import ManuscriptTemplatesPage from './pages/Admin/ManuscriptTemplatesPage';
import ManuscriptTemplateEditorPage from './pages/Admin/ManuscriptTemplateEditorPage';
import ArticleListPage from './pages/Article/ArticleListPage';
import ArticleDetailPage from './pages/Article/ArticleDetailPage';
import WriteArticlePage from './pages/Dashboard/WriteArticlePage';
import MyArticlesPage from './pages/Dashboard/MyArticlesPage';
import AdminArticlesPage from './pages/Admin/ArticlesPage';
import EventListPage from './pages/Event/EventListPage';
import EventDetailPage from './pages/Event/EventDetailPage';
import EventRegistrationPage from './pages/Dashboard/EventRegistrationPage';
import MyEventsPage from './pages/Dashboard/MyEventsPage';
import AdminEventsPage from './pages/Admin/EventsPage';
import AdminEventCategoriesPage from './pages/Admin/EventCategoriesPage';
import AdminEventAttendancePage from './pages/Admin/EventAttendancePage';
import AdminCertificateTemplatesPage from './pages/Admin/CertificateTemplatesPage';
import AdminCertificateTemplateEditorPage from './pages/Admin/CertificateTemplateEditorPage';
import MyCertificatesPage from './pages/Dashboard/MyCertificatesPage';
import EventAttendanceFormPage from './pages/Dashboard/EventAttendanceFormPage';

const router = createBrowserRouter([
    {
        path: '/',
        element: <HomeLayout />,
        errorElement: <ErrorPage />,
        children: [
            {
                index: true,
                element: <HomePage />,
            },
            {
                path: 'layanan',
                element: <LayananPage />,
            },
            {
                path: 'penulis',
                element: <PenulisListPage />,
            },
            {
                path: 'penulis/:slug',
                element: <AuthorProfilePage />,
            },
            {
                path: 'editor',
                element: <EditorListPage />,
            },
            {
                path: 'editor/:slug',
                element: <AuthorProfilePage />,
            },
            {
                path: 'paket',
                element: <PackageListPage />,
            },
            {
                path: 'paket/:id',
                element: <PackageDetailPage />,
            },
            {
                path: 'buku',
                element: <BookCatalogPage />,
            },
            {
                path: 'buku/:id',
                element: <BookDetailPage />,
            },
            {
                path: 'buku/:id/bab/:chapterId',
                element: <BookChapterPreviewPage />,
            },
            {
                path: 'buku-bab',
                element: <BookChapterProjectListPage />,
            },
            {
                path: 'buku-bab/:id',
                element: <BookChapterProjectDetailPage />,
            },
            {
                path: 'artikel',
                element: <ArticleListPage />,
            },
            {
                path: 'tentang-kami',
                element: <AboutPage />,
            },
            {
                path: 'artikel/:slug',
                element: <ArticleDetailPage />,
            },
            {
                path: 'event',
                element: <EventListPage />,
            },
            {
                path: 'event/:slug',
                element: <EventDetailPage />,
            },
            {
                path: 'verifikasi-email',
                element: <VerifyEmailPage />,
            },
            {
                path: 'lupa-password',
                element: <ForgotPasswordPage />,
            },
            {
                path: 'reset-password',
                element: <ResetPasswordPage />,
            },
            {
                path: 'register',
                element: <RegistrationPage />,
            },
            {
                path: 'login',
                element: <LoginPage />,
            },
            {
                path: 'dashboard',
                element: <ProtectedRoute />,
                children: [
                    {
                        element: <UserLayout />,
                        children: [
                            {
                                index: true,
                                element: <DashboardHomePage />,
                            },
                            {
                                path: 'akun',
                                element: <AccountSettingsPage />,
                            },
                            {
                                path: 'data-pribadi',
                                element: <PersonalDataPage />,
                            },
                            {
                                path: 'profil-publik',
                                element: <PublicProfilePage />,
                            },
                            {
                                path: 'ambil-paket/:packageId',
                                element: <TakePackagePage />,
                            },
                            {
                                path: 'paket-custom',
                                element: <CustomPackagePage />,
                            },
                            {
                                path: 'pesanan',
                                element: <MyOrdersPage />,
                            },
                            {
                                path: 'pesanan/:id/invoice',
                                element: <InvoicePage />,
                            },
                            {
                                path: 'profil-editor',
                                element: <EditorProfilePage />,
                            },
                            {
                                path: 'submit-naskah/:orderId',
                                element: <ManuscriptSubmitPage />,
                            },
                            {
                                path: 'naskah',
                                element: <MyManuscriptsPage />,
                            },
                            {
                                path: 'notifikasi',
                                element: <NotificationsPage />,
                            },
                            {
                                path: 'naskah/:id',
                                element: <ManuscriptDetailPage />,
                            },
                            {
                                path: 'pool-naskah',
                                element: <EditorManuscriptPoolPage />,
                            },
                            {
                                path: 'pool-coauthor',
                                element: <EditorCoauthorPoolPage />,
                            },
                            {
                                path: 'naskah-coauthor',
                                element: <EditorCoauthorManuscriptsPage />,
                            },
                            {
                                path: 'naskah-ditugaskan',
                                element: <EditorManuscriptsPage />,
                            },
                            {
                                path: 'fee-saya',
                                element: <EditorFeePage />,
                            },
                            {
                                path: 'beli-slot-bab/:projectId/:chapterId',
                                element: <BuyBookChapterSlotPage />,
                            },
                            {
                                path: 'proyek-bab-buku-saya',
                                element: <MyBookChapterProjectsPage />,
                            },
                            {
                                path: 'proyek-bab-buku-saya/:id',
                                element: <MyBookChapterProjectDetailPage />,
                            },
                            {
                                path: 'beli-buku/:bookSlug',
                                element: <BuyBookPage />,
                            },
                            {
                                path: 'keranjang',
                                element: <CartPage />,
                            },
                            {
                                path: 'royalti',
                                element: <RoyaltyPage />,
                            },
                            {
                                path: 'voucher-saya',
                                element: <MyVouchersPage />,
                            },
                            {
                                path: 'dompet',
                                element: <WalletPage />,
                            },
                            {
                                path: 'isbn/:id',
                                element: <IsbnApplicationPage />,
                            },
                            {
                                path: 'mou/:id',
                                element: <MouPage />,
                            },
                            {
                                path: 'tulis-artikel',
                                element: <WriteArticlePage />,
                            },
                            {
                                path: 'artikel-saya',
                                element: <MyArticlesPage />,
                            },
                            {
                                path: 'daftar-event/:slug',
                                element: <EventRegistrationPage />,
                            },
                            {
                                path: 'event-saya',
                                element: <MyEventsPage />,
                            },
                            {
                                path: 'absensi-event/:slug',
                                element: <EventAttendanceFormPage />,
                            },
                            {
                                path: 'sertifikat-saya',
                                element: <MyCertificatesPage />,
                            },
                            {
                                path: 'buku-terbit',
                                element: <MyPublishedBooksPage />,
                            },
                        ],
                    },
                ],
            },
            {
                path: 'admin',
                element: <AdminRoute />,
                children: [
                    {
                        element: <AdminLayout />,
                        children: [
                            {
                                index: true,
                                element: <RoleRequestsPage />,
                            },
                            {
                                path: 'users',
                                element: <UserManagementPage />,
                            },
                            {
                                path: 'packages',
                                element: <PackagesPage />,
                            },
                            {
                                path: 'custom-package-items',
                                element: <CustomPackageItemsPage />,
                            },
                            {
                                path: 'orders',
                                element: <OrdersPage />,
                            },
                            {
                                path: 'manuscripts',
                                element: <ManuscriptsPage />,
                            },
                            {
                                path: 'books',
                                element: <BooksPage />,
                            },
                            {
                                path: 'books/gabung-bab',
                                element: <CombineBookChapterPage />,
                            },
                            {
                                path: 'book-categories',
                                element: <BookCategoriesPage />,
                            },
                            {
                                path: 'field-categories',
                                element: <FieldCategoriesPage />,
                            },
                            {
                                path: 'book-chapter-projects',
                                element: <AdminBookChapterProjectsPage />,
                            },
                            {
                                path: 'book-chapter-projects/bulk-import',
                                element: <BookChapterBulkImportPage />,
                            },
                            {
                                path: 'book-chapter-projects/:id',
                                element: <AdminBookChapterProjectDetailPage />,
                            },
                            {
                                path: 'book-chapter-settings',
                                element: <BookChapterSettingsPage />,
                            },
                            {
                                path: 'payment-methods',
                                element: <PaymentMethodsPage />,
                            },
                            {
                                path: 'royalties',
                                element: <RoyaltiesPage />,
                            },
                            {
                                path: 'vouchers',
                                element: <VouchersPage />,
                            },
                            {
                                path: 'withdrawals',
                                element: <WithdrawalsPage />,
                            },
                            {
                                path: 'keuangan',
                                element: <FinancePage />,
                            },
                            {
                                path: 'hki',
                                element: <HkiPage />,
                            },
                            {
                                path: 'tentang-kami',
                                element: <AboutSettingsPage />,
                            },
                            {
                                path: 'recommendations',
                                element: <RecommendationsPage />,
                            },
                            {
                                path: 'covers',
                                element: <CoversPage />,
                            },
                            {
                                path: 'covers/:projectId',
                                element: <CoverProjectPage />,
                            },
                            {
                                path: 'authors',
                                element: <AuthorsManagementPage />,
                            },
                            {
                                path: 'editors',
                                element: <EditorsManagementPage />,
                            },
                            {
                                path: 'pool-naskah',
                                element: <ManuscriptPoolSettingsPage />,
                            },
                            {
                                path: 'terbitkan-naskah',
                                element: <PublishManuscriptsPage />,
                            },
                            {
                                path: 'isbn-settings',
                                element: <IsbnSettingsPage />,
                            },
                            {
                                path: 'mou-template',
                                element: <MouTemplatePage />,
                            },
                            {
                                path: 'mou',
                                element: <MousPage />,
                            },
                            {
                                path: 'mou/:id',
                                element: <MouDetailPage />,
                            },
                            {
                                path: 'sosmed',
                                element: <SocialPostPage />,
                            },
                            {
                                path: 'manuscript-templates',
                                element: <ManuscriptTemplatesPage />,
                            },
                            {
                                path: 'manuscript-templates/new',
                                element: <ManuscriptTemplateEditorPage />,
                            },
                            {
                                path: 'manuscript-templates/:id',
                                element: <ManuscriptTemplateEditorPage />,
                            },
                            {
                                path: 'articles',
                                element: <AdminArticlesPage />,
                            },
                            {
                                path: 'events',
                                element: <AdminEventsPage />,
                            },
                            {
                                path: 'events/:id/absensi',
                                element: <AdminEventAttendancePage />,
                            },
                            {
                                path: 'event-categories',
                                element: <AdminEventCategoriesPage />,
                            },
                            {
                                path: 'certificate-templates',
                                element: <AdminCertificateTemplatesPage />,
                            },
                            {
                                path: 'certificate-templates/new',
                                element: <AdminCertificateTemplateEditorPage />,
                            },
                            {
                                path: 'certificate-templates/:id',
                                element: <AdminCertificateTemplateEditorPage />,
                            },
                        ],
                    },
                ],
            },
        ],
    },
]);

export default router;
