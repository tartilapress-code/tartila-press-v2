<?php

use App\Http\Controllers\Api\V1\About\AboutController;
use App\Http\Controllers\Api\V1\Admin\AboutController as AdminAboutController;
use App\Http\Controllers\Api\V1\Admin\ArticleController as AdminArticleController;
use App\Http\Controllers\Api\V1\Admin\AuthorManagementController;
use App\Http\Controllers\Api\V1\Admin\BookChapterCompilationController as AdminBookChapterCompilationController;
use App\Http\Controllers\Api\V1\Admin\BookChapterProjectController as AdminBookChapterProjectController;
use App\Http\Controllers\Api\V1\Admin\BookChapterSettingController as AdminBookChapterSettingController;
use App\Http\Controllers\Api\V1\Admin\BookController as AdminBookController;
use App\Http\Controllers\Api\V1\Admin\BookEbookController as AdminBookEbookController;
use App\Http\Controllers\Api\V1\Admin\BookShipmentController;
use App\Http\Controllers\Api\V1\Admin\CertificateTemplateController as AdminCertificateTemplateController;
use App\Http\Controllers\Api\V1\Admin\CoverAdminController;
use App\Http\Controllers\Api\V1\Admin\DiscountController as AdminDiscountController;
use App\Http\Controllers\Api\V1\Admin\EditorManagementController;
use App\Http\Controllers\Api\V1\Admin\EventAttendanceController as AdminEventAttendanceController;
use App\Http\Controllers\Api\V1\Admin\EventCategoryController as AdminEventCategoryController;
use App\Http\Controllers\Api\V1\Admin\EventController as AdminEventController;
use App\Http\Controllers\Api\V1\Admin\FinanceController as AdminFinanceController;
use App\Http\Controllers\Api\V1\Admin\HkiController as AdminHkiController;
use App\Http\Controllers\Api\V1\Admin\IsbnApplicationController as AdminIsbnApplicationController;
use App\Http\Controllers\Api\V1\Admin\IsbnSettingController as AdminIsbnSettingController;
use App\Http\Controllers\Api\V1\Admin\ManuscriptController as AdminManuscriptController;
use App\Http\Controllers\Api\V1\Admin\ManuscriptPoolController as AdminManuscriptPoolController;
use App\Http\Controllers\Api\V1\Admin\ManuscriptTemplateController as AdminManuscriptTemplateController;
use App\Http\Controllers\Api\V1\Admin\MouController as AdminMouController;
use App\Http\Controllers\Api\V1\Admin\MouTemplateController as AdminMouTemplateController;
use App\Http\Controllers\Api\V1\Admin\RoyaltyController as AdminRoyaltyController;
use App\Http\Controllers\Api\V1\Admin\SocialPostController as AdminSocialPostController;
use App\Http\Controllers\Api\V1\Admin\UserManagementController;
use App\Http\Controllers\Api\V1\Admin\VoucherController as AdminVoucherController;
use App\Http\Controllers\Api\V1\Admin\VoucherGrantController as AdminVoucherGrantController;
use App\Http\Controllers\Api\V1\Admin\WithdrawalController as AdminWithdrawalController;
use App\Http\Controllers\Api\V1\Article\ArticleCommentController;
use App\Http\Controllers\Api\V1\Article\ArticleController;
use App\Http\Controllers\Api\V1\Article\ArticleLikeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Book\BookCategoryController;
use App\Http\Controllers\Api\V1\Book\BookChapterProjectController;
use App\Http\Controllers\Api\V1\Book\BookController;
use App\Http\Controllers\Api\V1\Book\BookReviewController;
use App\Http\Controllers\Api\V1\Book\FieldCategoryController;
use App\Http\Controllers\Api\V1\Book\MyPublishedBookController;
use App\Http\Controllers\Api\V1\Certificate\FontController as CertificateFontController;
use App\Http\Controllers\Api\V1\Certificate\MyCertificateController;
use App\Http\Controllers\Api\V1\Certificate\MyHkiController;
use App\Http\Controllers\Api\V1\Cover\CoverController;
use App\Http\Controllers\Api\V1\Dashboard\DashboardSummaryController;
use App\Http\Controllers\Api\V1\Editor\BookChapterProjectController as EditorBookChapterProjectController;
use App\Http\Controllers\Api\V1\Editor\BookChapterSettingController as EditorBookChapterSettingController;
use App\Http\Controllers\Api\V1\Editor\CoauthorDirectoryController;
use App\Http\Controllers\Api\V1\Editor\EditorDirectoryController;
use App\Http\Controllers\Api\V1\Editor\ManuscriptController as EditorManuscriptController;
use App\Http\Controllers\Api\V1\Editor\MyEditorProfileController;
use App\Http\Controllers\Api\V1\Event\AttendanceController as EventAttendanceController;
use App\Http\Controllers\Api\V1\Event\EventController;
use App\Http\Controllers\Api\V1\Event\EventRegistrationController;
use App\Http\Controllers\Api\V1\Event\MyEventController;
use App\Http\Controllers\Api\V1\Isbn\IsbnApplicationController;
use App\Http\Controllers\Api\V1\Manuscript\CompilationChapterController;
use App\Http\Controllers\Api\V1\Manuscript\ManuscriptController as PenulisManuscriptController;
use App\Http\Controllers\Api\V1\Manuscript\PublicationProgressController;
use App\Http\Controllers\Api\V1\Mou\MyMouController;
use App\Http\Controllers\Api\V1\Notification\NotificationController;
use App\Http\Controllers\Api\V1\Order\OrderController;
use App\Http\Controllers\Api\V1\Order\OrderMessageController;
use App\Http\Controllers\Api\V1\Package\CustomPackageItemController;
use App\Http\Controllers\Api\V1\Package\PackageController;
use App\Http\Controllers\Api\V1\Payment\PaymentMethodController;
use App\Http\Controllers\Api\V1\Profile\ProfileController;
use App\Http\Controllers\Api\V1\PublicProfile\MyPublicProfileController;
use App\Http\Controllers\Api\V1\PublicProfile\ProfileExperienceController;
use App\Http\Controllers\Api\V1\PublicProfile\PublicProfileController;
use App\Http\Controllers\Api\V1\Reader\AdminBookController as ReaderAdminBookController;
use App\Http\Controllers\Api\V1\Reader\AdminConfigController as ReaderAdminConfigController;
use App\Http\Controllers\Api\V1\Reader\AdminOrderController as ReaderAdminOrderController;
use App\Http\Controllers\Api\V1\Reader\AdminPartnerController as ReaderAdminPartnerController;
use App\Http\Controllers\Api\V1\Reader\CatalogController as ReaderCatalogController;
use App\Http\Controllers\Api\V1\Reader\InteractionController as ReaderInteractionController;
use App\Http\Controllers\Api\V1\Reader\MeController as ReaderMeController;
use App\Http\Controllers\Api\V1\Reader\PartnerBookController as ReaderPartnerBookController;
use App\Http\Controllers\Api\V1\Reader\ReadingController as ReaderReadingController;
use App\Http\Controllers\Api\V1\RoleRequest\RoleRequestController;
use App\Http\Controllers\Api\V1\Royalty\RoyaltyController as UserRoyaltyController;
use App\Http\Controllers\Api\V1\Upload\DocumentUploadController;
use App\Http\Controllers\Api\V1\Upload\ImageUploadController;
use App\Http\Controllers\Api\V1\User\UserSearchController;
use App\Http\Controllers\Api\V1\Voucher\MyVoucherController;
use App\Http\Controllers\Api\V1\Wallet\WalletController;
use App\Http\Controllers\Scholar\BookPageController as ScholarBookPageController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Authentication & Private User Area
    |--------------------------------------------------------------------------
    */

    Route::prefix('auth')->group(function () {

        /*
        |--------------------------------------------------------------------------
        | Authentication
        |--------------------------------------------------------------------------
        */

        Route::post(
            '/register',
            [AuthController::class, 'register']
        );

        Route::post(
            '/login',
            [AuthController::class, 'login']
        );

        Route::post(
            '/forgot-password',
            [AuthController::class, 'forgotPassword']
        )->middleware('throttle:5,1');

        Route::post(
            '/reset-password',
            [AuthController::class, 'resetPassword']
        )->middleware('throttle:10,1');

        /*
        |--------------------------------------------------------------------------
        | Authenticated User
        |--------------------------------------------------------------------------
        */

        Route::middleware('auth:sanctum')->group(function () {

            /*
            |------------------------------------------------------------------
            | Authentication Session
            |------------------------------------------------------------------
            */

            Route::get(
                '/me',
                [AuthController::class, 'me']
            );

            Route::post(
                '/logout',
                [AuthController::class, 'logout']
            );

            /*
            |------------------------------------------------------------------
            | Email Verification
            |------------------------------------------------------------------
            */

            Route::post(
                '/email/verification-notification',
                [EmailVerificationController::class, 'send']
            )->middleware('throttle:3,1');

            /*
            |------------------------------------------------------------------
            | Account Management
            |------------------------------------------------------------------
            */

            // Change Password
            Route::post(
                '/change-password',
                [AuthController::class, 'changePassword']
            );

            // Change Email
            Route::post(
                '/change-email',
                [AuthController::class, 'changeEmail']
            );

            /*
            |------------------------------------------------------------------
            | Private Profile
            |------------------------------------------------------------------
            */

            Route::get(
                '/profile',
                [ProfileController::class, 'show']
            );

            Route::patch(
                '/profile',
                [ProfileController::class, 'update']
            );

            /*
            |------------------------------------------------------------------
            | My Public Profile
            |------------------------------------------------------------------
            */

            Route::get(
                '/public-profile',
                [MyPublicProfileController::class, 'show']
            );

            Route::post(
                '/public-profile',
                [MyPublicProfileController::class, 'upsert']
            );

            /*
            |------------------------------------------------------------------
            | My Public Profile Experiences
            |------------------------------------------------------------------
            */

            Route::get(
                '/public-profile/experiences',
                [ProfileExperienceController::class, 'index']
            );

            Route::post(
                '/public-profile/experiences',
                [ProfileExperienceController::class, 'store']
            );

            Route::patch(
                '/public-profile/experiences/{id}',
                [ProfileExperienceController::class, 'update']
            );

            Route::delete(
                '/public-profile/experiences/{id}',
                [ProfileExperienceController::class, 'destroy']
            );

            /*
            |------------------------------------------------------------------
            | Image Upload (cover buku, foto profil, foto bio, dll)
            |------------------------------------------------------------------
            */

            Route::post(
                '/uploads/images',
                [ImageUploadController::class, 'store']
            );

            Route::post(
                '/uploads/documents',
                [DocumentUploadController::class, 'store']
            );

        });

        /*
        |--------------------------------------------------------------------------
        | Email Verification Link
        |--------------------------------------------------------------------------
        */

        // Signature divalidasi di controller (bukan middleware "signed")
        // supaya link yang salah/kedaluwarsa tetap dialihkan ke halaman
        // frontend, bukan menampilkan error mentah di browser.
        Route::get(
            '/email/verify/{id}/{hash}',
            [EmailVerificationController::class, 'verify']
        )->name('verification.verify');

        /*
        |--------------------------------------------------------------------------
        | Change Email Verification Link
        |--------------------------------------------------------------------------
        */

        // Signature divalidasi di controller (lihat catatan di route
        // verifikasi email di atas).
        Route::get(
            '/change-email/verify/{id}',
            [AuthController::class, 'verifyChangeEmail']
        )->name('auth.email.change.verify');

    });

    /*
    |--------------------------------------------------------------------------
    | Public Profile
    |--------------------------------------------------------------------------
    */

    // Semua rute publik di bawah ini disaring lewat `public.sanitize`
    // (menyembunyikan email pengguna dan data internal editor dari respons).
    Route::prefix('public')->middleware('public.sanitize')->group(function () {

        Route::get(
            '/authors',
            [PublicProfileController::class, 'index']
        );

        Route::get(
            '/authors/{slug}',
            [PublicProfileController::class, 'show']
        );

    });

    // Halaman "Tentang Kami" (juga kontak & sosial media di footer).
    Route::get('/about', [AboutController::class, 'show'])->middleware('public.sanitize');

    /*
    |--------------------------------------------------------------------------
    | Paket Penerbitan (katalog publik)
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/packages',
        [PackageController::class, 'index']
    )->middleware('public.sanitize');

    Route::get(
        '/packages/{package}',
        [PackageController::class, 'show']
    )->middleware('public.sanitize');

    Route::get(
        '/custom-package-items',
        [CustomPackageItemController::class, 'index']
    )->middleware('public.sanitize');

    Route::get(
        '/payment-methods',
        [PaymentMethodController::class, 'index']
    )->middleware('public.sanitize');

    /*
    |--------------------------------------------------------------------------
    | Katalog Buku (publik)
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/books',
        [BookController::class, 'index']
    )->middleware('public.sanitize');

    // Tumpukan sampul di hero beranda (sebelum rute slug).
    Route::get(
        '/books/hero-covers',
        [BookController::class, 'heroCovers']
    )->middleware('public.sanitize');

    Route::get(
        '/books/{book:slug}',
        [BookController::class, 'show']
    )->middleware('public.sanitize');

    Route::get(
        '/books/{book:slug}/preview',
        [BookController::class, 'preview']
    )->middleware('public.sanitize');

    // Alamat PDF yang stabil dan berakhiran .pdf untuk metadata sitasi
    // (citation_pdf_url): selalu menyajikan preview terbaru, jadi mengganti
    // file tidak membuat tautan lama mati.
    Route::get(
        '/books/{book:slug}/preview.pdf',
        [BookController::class, 'preview']
    )->name('books.preview.pdf')->middleware('public.sanitize');

    Route::get(
        '/book-categories',
        [BookCategoryController::class, 'index']
    )->middleware('public.sanitize');

    Route::get(
        '/field-categories',
        [FieldCategoryController::class, 'index']
    )->middleware('public.sanitize');

    /*
    |--------------------------------------------------------------------------
    | Book Chapter Projects (publik - jual slot bab)
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/book-chapter-projects',
        [BookChapterProjectController::class, 'index']
    )->middleware('public.sanitize');

    Route::get(
        '/book-chapter-projects/{bookChapterProject}',
        [BookChapterProjectController::class, 'show']
    )->middleware('public.sanitize');

    Route::middleware('auth:sanctum')->group(function () {

        Route::post(
            '/books/{book}/reviews',
            [BookReviewController::class, 'store']
        );

        Route::delete(
            '/books/{book}/reviews',
            [BookReviewController::class, 'destroy']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Articles (publik + semua user login bisa menulis)
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/articles',
        [ArticleController::class, 'index']
    )->middleware('public.sanitize');

    Route::middleware('auth:sanctum')->group(function () {

        // Didaftarkan sebelum {article:slug} supaya "mine" tidak
        // dianggap sebagai nilai slug.
        Route::get(
            '/articles/mine',
            [ArticleController::class, 'mine']
        );

        Route::post(
            '/articles',
            [ArticleController::class, 'store']
        )->middleware('email.verified');

        Route::post(
            '/articles/{article:slug}/like',
            [ArticleLikeController::class, 'store']
        );

        Route::delete(
            '/articles/{article:slug}/like',
            [ArticleLikeController::class, 'destroy']
        );

        Route::post(
            '/articles/{article:slug}/comments',
            [ArticleCommentController::class, 'store']
        )->middleware('email.verified');

        Route::delete(
            '/articles/{article:slug}/comments/{comment}',
            [ArticleCommentController::class, 'destroy']
        );

    });

    Route::get(
        '/articles/{article:slug}',
        [ArticleController::class, 'show']
    )->middleware('public.sanitize');

    Route::get(
        '/articles/{article:slug}/comments',
        [ArticleCommentController::class, 'index']
    )->middleware('public.sanitize');

    /*
    |--------------------------------------------------------------------------
    | Events (publik + semua user login bisa daftar)
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/events',
        [EventController::class, 'index']
    )->middleware('public.sanitize');

    Route::get(
        '/event-categories',
        [AdminEventCategoryController::class, 'index']
    )->middleware('public.sanitize');

    Route::middleware('auth:sanctum')->group(function () {

        // Didaftarkan sebelum {event:slug} supaya "mine" tidak dianggap
        // sebagai nilai slug.
        Route::get(
            '/events/mine',
            [MyEventController::class, 'index']
        );

        Route::post(
            '/events/{event:slug}/register',
            [EventRegistrationController::class, 'store']
        )->middleware('email.verified');

        // Absensi event (formulir + status) -- hanya peserta terkonfirmasi.
        Route::get(
            '/events/{event:slug}/attendance',
            [EventAttendanceController::class, 'show']
        );

        Route::post(
            '/events/{event:slug}/attendance',
            [EventAttendanceController::class, 'store']
        )->middleware('email.verified');

    });

    Route::get(
        '/events/{event:slug}',
        [EventController::class, 'show']
    )->middleware('public.sanitize');

    /*
    |--------------------------------------------------------------------------
    | Sertifikat (otomatis dari templat) + font untuk editor templat
    |--------------------------------------------------------------------------
    */

    // Font open source untuk pratinjau editor templat; lewat API supaya
    // mendapat header CORS.
    Route::get(
        '/certificate-fonts/{file}',
        [CertificateFontController::class, 'show']
    )->where('file', '[A-Za-z0-9._-]+')->middleware('public.sanitize');

    Route::middleware('auth:sanctum')->group(function () {

        Route::get(
            '/certificates',
            [MyCertificateController::class, 'index']
        );

        Route::get(
            '/certificates/{certificate}/download',
            [MyCertificateController::class, 'download']
        );

        // Sertifikat HKI karya yang ditulis user.
        Route::get('/hki-certificates', [MyHkiController::class, 'index']);
        Route::get('/hki-certificates/{hkiRecord}/download', [MyHkiController::class, 'download']);

    });

    /*
    |--------------------------------------------------------------------------
    | Direktori Editor & Profil Editor
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->group(function () {

        Route::get(
            '/editors',
            [EditorDirectoryController::class, 'index']
        );

        Route::get(
            '/coauthors',
            [CoauthorDirectoryController::class, 'index']
        );

        Route::get(
            '/editor/profile',
            [MyEditorProfileController::class, 'show']
        );

        // Level & performa milik sendiri (hanya dilihat editor itu sendiri dan admin).
        Route::get(
            '/editor/insight',
            [MyEditorProfileController::class, 'insight']
        );

        Route::post(
            '/editor/profile',
            [MyEditorProfileController::class, 'upsert']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Pencarian Pengguna (untuk memilih co-author naskah)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('users')->group(function () {

        Route::get(
            '/search',
            [UserSearchController::class, 'search']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Pesanan (Order)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('orders')->group(function () {

        Route::post(
            '/',
            [OrderController::class, 'store']
        )->middleware(['email.verified', 'throttle:20,1']);

        // Dibatasi supaya kode voucher tidak bisa ditebak beruntun.
        Route::post(
            '/check-voucher',
            [OrderController::class, 'checkVoucher']
        )->middleware('throttle:20,1');

        Route::get(
            '/mine',
            [OrderController::class, 'mine']
        );

        Route::post(
            '/{order}/confirm-received',
            [OrderController::class, 'confirmShipmentReceived']
        );

        Route::post(
            '/{order}/payment-proof',
            [OrderController::class, 'uploadPaymentProof']
        );

        // Invoice pesanan: pembeli pemilik pesanan atau admin.
        Route::get(
            '/{order}/invoice',
            [OrderController::class, 'invoice']
        );

        Route::get(
            '/{order}/messages',
            [OrderMessageController::class, 'index']
        );

        Route::post(
            '/{order}/messages',
            [OrderMessageController::class, 'store']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Royalti (Penulis)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('royalties')->group(function () {

        Route::get(
            '/mine',
            [UserRoyaltyController::class, 'mine']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Voucher Saya (Penulis / Editor)
    |--------------------------------------------------------------------------
    */

    /*
    |--------------------------------------------------------------------------
    | Dompet Saya
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('isbn-applications')->group(function () {

        Route::post('/', [IsbnApplicationController::class, 'store'])
            ->middleware('email.verified');
        Route::get('/{isbnApplication}', [IsbnApplicationController::class, 'show']);
        Route::post('/{isbnApplication}/sign', [IsbnApplicationController::class, 'sign']);
        Route::get('/{isbnApplication}/download', [IsbnApplicationController::class, 'download']);

    });

    /*
    |--------------------------------------------------------------------------
    | Tartila Book (situs baca buku) - publik
    |--------------------------------------------------------------------------
    */

    Route::prefix('reader')->group(function () {
        Route::get('/filters', [ReaderCatalogController::class, 'filters'])->middleware('public.sanitize');
        Route::get('/books', [ReaderCatalogController::class, 'index'])->middleware('public.sanitize');
        Route::get('/books/{readerBook}', [ReaderCatalogController::class, 'show'])->middleware('public.sanitize');
        Route::get('/books/{readerBook}/comments', [ReaderCatalogController::class, 'comments'])->middleware('public.sanitize');
        Route::get('/plans', [ReaderCatalogController::class, 'plans'])->middleware('public.sanitize');
    });

    // Tartila Book - pembaca (login). Pembatasan baca per buku dicek di controller.
    // Dashboard mitra Tartila Book (role mitra): buku sendiri, ebook, dokumen, pengajuan, laporan.
    Route::middleware(['auth:sanctum', 'role:mitra'])->prefix('partner')->group(function () {
        Route::get('/terms', [ReaderPartnerBookController::class, 'terms']);
        Route::get('/books', [ReaderPartnerBookController::class, 'index']);
        Route::post('/books', [ReaderPartnerBookController::class, 'store']);
        Route::get('/books/{bookId}', [ReaderPartnerBookController::class, 'show'])->whereNumber('bookId');
        Route::put('/books/{bookId}', [ReaderPartnerBookController::class, 'update'])->whereNumber('bookId');
        Route::delete('/books/{bookId}', [ReaderPartnerBookController::class, 'destroy'])->whereNumber('bookId');
        Route::post('/books/{bookId}/ebook', [ReaderPartnerBookController::class, 'ebook'])->whereNumber('bookId');
        Route::post('/books/{bookId}/documents/{kind}', [ReaderPartnerBookController::class, 'document'])->whereNumber('bookId')->whereIn('kind', ['turnitin', 'originality', 'mou']);
        Route::get('/books/{bookId}/documents/{kind}', [ReaderPartnerBookController::class, 'download'])->whereNumber('bookId')->whereIn('kind', ['ebook', 'turnitin', 'originality', 'mou']);
        Route::post('/books/{bookId}/submit', [ReaderPartnerBookController::class, 'submit'])->whereNumber('bookId');
        Route::post('/books/{bookId}/reopen', [ReaderPartnerBookController::class, 'reopen'])->whereNumber('bookId');
        Route::get('/report', [ReaderPartnerBookController::class, 'report']);
    });

    Route::middleware('auth:sanctum')->prefix('reader')->group(function () {
        Route::get('/books/{readerBook}/file', [ReaderReadingController::class, 'file']);
        Route::post('/books/{readerBook}/reads', [ReaderReadingController::class, 'reads'])->middleware('throttle:240,1');
        Route::put('/books/{readerBook}/progress', [ReaderReadingController::class, 'progress'])->middleware('throttle:240,1');
        Route::get('/books/{readerBook}/bookmarks', [ReaderReadingController::class, 'bookmarks']);
        Route::post('/books/{readerBook}/bookmarks', [ReaderReadingController::class, 'storeBookmark']);
        Route::delete('/bookmarks/{bookmark}', [ReaderReadingController::class, 'destroyBookmark']);

        Route::post('/books/{readerBook}/like', [ReaderInteractionController::class, 'like']);
        Route::delete('/books/{readerBook}/like', [ReaderInteractionController::class, 'unlike']);
        Route::post('/books/{readerBook}/save', [ReaderInteractionController::class, 'save']);
        Route::delete('/books/{readerBook}/save', [ReaderInteractionController::class, 'unsave']);
        Route::post('/books/{readerBook}/comments', [ReaderInteractionController::class, 'storeComment'])->middleware('throttle:30,1');
        Route::delete('/comments/{comment}', [ReaderInteractionController::class, 'destroyComment']);

        Route::get('/me/shelf', [ReaderMeController::class, 'shelf']);
        Route::get('/me/bookmarks', [ReaderMeController::class, 'bookmarks']);
        Route::get('/me/access', [ReaderMeController::class, 'access']);
        Route::get('/me/royalty', [ReaderMeController::class, 'royalty']);
        Route::get('/orders', [ReaderMeController::class, 'orders']);
        Route::post('/orders', [ReaderMeController::class, 'storeOrder'])->middleware('throttle:20,1');
        Route::post('/orders/{order}/proof', [ReaderMeController::class, 'uploadProof']);
    });

    // MOU distribusi buku (penulis): daftar di Royalti Saya, tanda tangan, PDF.
    // Berkas cover (gambar) untuk admin dan penulis buku itu.
    Route::middleware('auth:sanctum')->prefix('covers')->group(function () {
        Route::get('/{cover}/image', [CoverController::class, 'image']);
        Route::get('/{cover}/download', [CoverController::class, 'download']);
    });

    Route::middleware('auth:sanctum')->prefix('mous')->group(function () {
        Route::get('/', [MyMouController::class, 'index']);
        Route::get('/{mou}', [MyMouController::class, 'show']);
        Route::post('/{mou}/sign', [MyMouController::class, 'sign']);
        Route::get('/{mou}/pdf', [MyMouController::class, 'pdf']);
        Route::get('/{mou}/addenda/{addendum}', [MyMouController::class, 'addendum']);
    });

    // Notifikasi di aplikasi (lonceng & tanda merah di menu).
    Route::middleware('auth:sanctum')->prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/summary', [NotificationController::class, 'summary']);
        Route::post('/read', [NotificationController::class, 'markRead']);
    });

    // Ringkasan dashboard (semua fitur, per peran).
    Route::middleware('auth:sanctum')->get('/dashboard/summary', DashboardSummaryController::class);

    // Buku terbit penulis: ebook lengkap, sertifikat HKI & sertifikat penulis.
    Route::middleware('auth:sanctum')->prefix('my-published-books')->group(function () {
        Route::get('/', [MyPublishedBookController::class, 'index']);
        Route::get('/{book}/ebook', [MyPublishedBookController::class, 'ebook']);
    });

    Route::middleware('auth:sanctum')->prefix('wallet')->group(function () {

        Route::get('/', [WalletController::class, 'show']);

        Route::post('/withdrawals', [WalletController::class, 'withdraw'])
            ->middleware('email.verified');

    });

    Route::middleware('auth:sanctum')->prefix('vouchers')->group(function () {

        Route::get(
            '/mine',
            [MyVoucherController::class, 'index']
        );

        Route::post(
            '/mine',
            [MyVoucherController::class, 'store']
        )->middleware('email.verified');

        Route::patch(
            '/mine/{voucher}',
            [MyVoucherController::class, 'update']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Naskah (Penulis)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('manuscripts')->group(function () {

        Route::post(
            '/',
            [PenulisManuscriptController::class, 'store']
        );

        Route::get(
            '/mine',
            [PenulisManuscriptController::class, 'mine']
        );

        // Template naskah yang bisa dipilih penulis saat mengirim naskah.
        Route::get(
            '/template-options',
            [PenulisManuscriptController::class, 'templateOptions']
        );

        Route::get(
            '/{manuscript}',
            [PenulisManuscriptController::class, 'show']
        );

        Route::post(
            '/{manuscript}/revisions',
            [PenulisManuscriptController::class, 'addRevision']
        );

        Route::get(
            '/{manuscript}/revisions/{revision}/download',
            [PenulisManuscriptController::class, 'downloadRevision']
        );

        // Riwayat status proses penerbitan (ISBN, HAKI, buku fisik).
        Route::get(
            '/{manuscript}/publication-progress',
            [PublicationProgressController::class, 'show']
        );

        Route::post(
            '/{manuscript}/publication-progress/confirm-delivery',
            [PublicationProgressController::class, 'confirmDelivery']
        );

        // Book Chapter: naskah awal per bab dari naskah gabungan.
        Route::get(
            '/{manuscript}/compilation-chapters',
            [CompilationChapterController::class, 'index']
        );

        Route::post(
            '/{manuscript}/compilation-chapters/{chapter}/revision-request',
            [CompilationChapterController::class, 'requestRevision']
        );

        Route::post(
            '/{manuscript}/final-review',
            [PenulisManuscriptController::class, 'finalReview']
        );

        // Cover buku: lihat pilihan & hasil, memilih / voting.
        Route::get('/{manuscript}/cover', [CoverController::class, 'show']);
        Route::post('/{manuscript}/cover/vote', [CoverController::class, 'vote']);

        // Layanan co-author: penulis menyetujui / meminta revisi susunan co-author.
        Route::post(
            '/{manuscript}/coauthor-review',
            [PenulisManuscriptController::class, 'coauthorReview']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Naskah (Editor)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('editor')->group(function () {

        Route::get(
            '/manuscript-pool',
            [EditorManuscriptController::class, 'pool']
        );

        Route::post(
            '/manuscript-pool/{manuscript}/claim',
            [EditorManuscriptController::class, 'claim']
        );

        Route::get(
            '/manuscripts',
            [EditorManuscriptController::class, 'mine']
        );

        Route::get(
            '/fees',
            [EditorManuscriptController::class, 'fees']
        );

        // Layanan co-author: pool, ambil, dan naskah yang disusun sebagai co-author.
        Route::get('/coauthor-pool', [EditorManuscriptController::class, 'coauthorPool']);
        Route::post('/coauthor-pool/{manuscript}/claim', [EditorManuscriptController::class, 'claimCoauthor']);
        Route::get('/coauthor-manuscripts', [EditorManuscriptController::class, 'coauthorMine']);

        // Book Chapter Settings (hint batas minimum/maksimum)
        Route::get(
            '/book-chapter-settings',
            [EditorBookChapterSettingController::class, 'show']
        );

        // Fasilitas & layanan yang bisa dicentang pada proyek Book Chapter
        Route::get(
            '/book-chapter-package-items',
            [EditorBookChapterSettingController::class, 'packageItems']
        );

        // Book Chapter Projects milik sendiri
        Route::get(
            '/book-chapter-projects',
            [EditorBookChapterProjectController::class, 'index']
        );

        Route::post(
            '/book-chapter-projects',
            [EditorBookChapterProjectController::class, 'store']
        );

        Route::get(
            '/book-chapter-projects/{bookChapterProject}',
            [EditorBookChapterProjectController::class, 'show']
        );

        // Data poster "Promosikan Projek" untuk sosmed.
        Route::get(
            '/book-chapter-projects/{bookChapterProject}/promo',
            [EditorBookChapterProjectController::class, 'promo']
        );

        Route::patch(
            '/book-chapter-projects/{bookChapterProject}',
            [EditorBookChapterProjectController::class, 'update']
        );

        Route::post(
            '/book-chapter-projects/{bookChapterProject}/chapters',
            [EditorBookChapterProjectController::class, 'storeChapter']
        );

        Route::patch(
            '/book-chapter-projects/chapters/{chapter}',
            [EditorBookChapterProjectController::class, 'updateChapter']
        );

        Route::delete(
            '/book-chapter-projects/chapters/{chapter}',
            [EditorBookChapterProjectController::class, 'destroyChapter']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Role Request (User mengajukan jadi Penulis/Editor)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('role-requests')->group(function () {

        Route::post(
            '/',
            [RoleRequestController::class, 'store']
        );

        Route::get(
            '/mine',
            [RoleRequestController::class, 'mine']
        );

    });

    /*
    |--------------------------------------------------------------------------
    | Admin
    |--------------------------------------------------------------------------
    */

    Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {

        Route::get(
            '/role-requests',
            [RoleRequestController::class, 'index']
        );

        Route::post(
            '/role-requests/{roleRequest}/approve',
            [RoleRequestController::class, 'approve']
        );

        Route::post(
            '/role-requests/{roleRequest}/reject',
            [RoleRequestController::class, 'reject']
        );

        Route::get(
            '/users',
            [UserManagementController::class, 'index']
        );

        Route::patch(
            '/users/{user}/roles',
            [UserManagementController::class, 'updateRoles']
        );

        // Packages
        Route::get(
            '/packages',
            [PackageController::class, 'adminIndex']
        );

        Route::post(
            '/packages',
            [PackageController::class, 'store']
        );

        Route::patch(
            '/packages/{package}',
            [PackageController::class, 'update']
        );

        Route::delete(
            '/packages/{package}',
            [PackageController::class, 'destroy']
        );

        // Custom Package Items
        Route::get(
            '/custom-package-items',
            [CustomPackageItemController::class, 'adminIndex']
        );

        Route::post(
            '/custom-package-items',
            [CustomPackageItemController::class, 'store']
        );

        Route::patch(
            '/custom-package-items/{customPackageItem}',
            [CustomPackageItemController::class, 'update']
        );

        Route::delete(
            '/custom-package-items/{customPackageItem}',
            [CustomPackageItemController::class, 'destroy']
        );

        // Payment Methods
        Route::get(
            '/payment-methods',
            [PaymentMethodController::class, 'adminIndex']
        );

        Route::post(
            '/payment-methods',
            [PaymentMethodController::class, 'store']
        );

        Route::patch(
            '/payment-methods/{paymentMethod}',
            [PaymentMethodController::class, 'update']
        );

        Route::delete(
            '/payment-methods/{paymentMethod}',
            [PaymentMethodController::class, 'destroy']
        );

        // Orders
        Route::get(
            '/orders',
            [OrderController::class, 'index']
        );

        Route::patch(
            '/orders/{order}/status',
            [OrderController::class, 'updateStatus']
        );

        Route::post(
            '/orders/{order}/verify-payment',
            [OrderController::class, 'verifyPayment']
        );

        Route::patch(
            '/book-shipments/{bookShipment}',
            [BookShipmentController::class, 'update']
        );

        // Manuscripts
        Route::get(
            '/manuscripts',
            [AdminManuscriptController::class, 'index']
        );

        Route::post(
            '/manuscripts/{manuscript}/revisions/{revision}/review',
            [AdminManuscriptController::class, 'reviewRevision']
        );

        // Pratinjau auto layout (unduh .docx hasil template, tidak disimpan)
        Route::get(
            '/manuscripts/{manuscript}/revisions/{revision}/auto-layout',
            [AdminManuscriptController::class, 'autoLayoutPreview']
        );

        Route::post(
            '/manuscripts/{manuscript}/assign-editor',
            [AdminManuscriptController::class, 'assignEditor']
        );

        Route::post(
            '/manuscripts/{manuscript}/open-pool',
            [AdminManuscriptController::class, 'openPool']
        );

        Route::post(
            '/manuscripts/{manuscript}/assign-coauthor',
            [AdminManuscriptController::class, 'assignCoauthor']
        );

        Route::post(
            '/manuscripts/{manuscript}/open-coauthor-pool',
            [AdminManuscriptController::class, 'openCoauthorPool']
        );

        // Tingkat kesulitan & kriteria editor pool sebuah naskah.
        Route::put(
            '/manuscripts/{manuscript}/pool-settings',
            [AdminManuscriptController::class, 'updatePoolSettings']
        );

        // Pengaturan pool naskah: bidang keahlian editor.
        Route::get('/manuscript-pool', [AdminManuscriptPoolController::class, 'index']);
        Route::put('/manuscript-pool/editors/{user}', [AdminManuscriptPoolController::class, 'updateEditorFields']);

        // Kelola Editor: statistik, performa, level, fee, dalam pemantauan (ban) dan promosi.
        Route::get('/editors', [EditorManagementController::class, 'index']);
        Route::put('/editors/{user}/ban', [EditorManagementController::class, 'ban']);
        Route::put('/editors/{user}/promote', [EditorManagementController::class, 'promote']);

        // Cover khusus: cover paket, cover Book Chapter, cover buku terbit.
        Route::get('/covers/packages', [CoverAdminController::class, 'packages']);
        Route::get('/covers/chapters', [CoverAdminController::class, 'chapters']);
        Route::get('/covers/books', [CoverAdminController::class, 'books']);
        Route::get('/covers/projects/{project}', [CoverAdminController::class, 'show']);
        Route::post('/covers/projects/{project}/covers', [CoverAdminController::class, 'upload']);
        Route::post('/covers/projects/{project}/revision', [CoverAdminController::class, 'revision']);
        Route::post('/covers/projects/{project}/decide', [CoverAdminController::class, 'decide']);
        Route::delete('/covers/covers/{cover}', [CoverAdminController::class, 'destroyCover']);
        Route::post('/covers/books/{book}', [CoverAdminController::class, 'replaceBookCover']);

        // Kelola Penulis: buku terbit, naskah dalam proses, royalti, dan catatan progres/hak.
        Route::get('/authors', [AuthorManagementController::class, 'index']);
        Route::put('/authors/{user}/note', [AuthorManagementController::class, 'note']);

        // Books
        Route::get(
            '/books',
            [AdminBookController::class, 'index']
        );

        Route::post(
            '/books/from-manuscript/{manuscript}',
            [AdminBookController::class, 'storeFromManuscript']
        );

        Route::post(
            '/books/manual',
            [AdminBookController::class, 'storeManual']
        );

        Route::post(
            '/books/chapter-compilation',
            [AdminBookController::class, 'combineChapters']
        );

        Route::patch(
            '/books/{book}',
            [AdminBookController::class, 'update']
        );

        Route::delete(
            '/books/{book}',
            [AdminBookController::class, 'destroy']
        );

        Route::post(
            '/books/{book}/preview',
            [AdminBookController::class, 'uploadPreview']
        );

        Route::post(
            '/books/chapters/{chapter}/preview',
            [AdminBookController::class, 'uploadChapterPreview']
        );

        // Ebook lengkap (privat, untuk penulis buku).
        Route::post('/books/{book}/ebook', [AdminBookEbookController::class, 'store']);
        Route::get('/books/{book}/ebook', [AdminBookEbookController::class, 'download']);
        Route::delete('/books/{book}/ebook', [AdminBookEbookController::class, 'destroy']);

        // Articles
        Route::get(
            '/articles',
            [AdminArticleController::class, 'index']
        );

        Route::post(
            '/articles/{article}/approve',
            [AdminArticleController::class, 'approve']
        );

        Route::post(
            '/articles/{article}/reject',
            [AdminArticleController::class, 'reject']
        );

        // Events
        Route::get(
            '/events',
            [AdminEventController::class, 'index']
        );

        Route::post(
            '/events',
            [AdminEventController::class, 'store']
        );

        Route::patch(
            '/events/{event}',
            [AdminEventController::class, 'update']
        );

        Route::delete(
            '/events/{event}',
            [AdminEventController::class, 'destroy']
        );

        // Absensi event: pengaturan + kolom formulir, daftar yang sudah
        // absen, ekspor CSV.
        Route::get(
            '/events/{event}/attendance',
            [AdminEventAttendanceController::class, 'show']
        );

        Route::put(
            '/events/{event}/attendance',
            [AdminEventAttendanceController::class, 'update']
        );

        Route::get(
            '/events/{event}/attendances',
            [AdminEventAttendanceController::class, 'attendances']
        );

        Route::get(
            '/events/{event}/attendances/export',
            [AdminEventAttendanceController::class, 'export']
        );

        Route::delete(
            '/events/{event}/attendances/{attendance}',
            [AdminEventAttendanceController::class, 'destroyAttendance']
        );

        // Templat sertifikat (rute tetap didaftarkan sebelum {certificateTemplate}).
        Route::get(
            '/certificate-templates',
            [AdminCertificateTemplateController::class, 'index']
        );

        Route::get(
            '/certificate-templates/meta',
            [AdminCertificateTemplateController::class, 'meta']
        );

        Route::post(
            '/certificate-templates/upload-image',
            [AdminCertificateTemplateController::class, 'uploadImage']
        );

        Route::post(
            '/certificate-templates/preview',
            [AdminCertificateTemplateController::class, 'preview']
        );

        Route::post(
            '/certificate-templates',
            [AdminCertificateTemplateController::class, 'store']
        );

        Route::get(
            '/certificate-templates/{certificateTemplate}',
            [AdminCertificateTemplateController::class, 'show']
        );

        // Gambar templat lewat API (untuk kanvas poster sosmed: tanpa lintas-origin).
        Route::get(
            '/certificate-templates/{certificateTemplate}/image',
            [AdminCertificateTemplateController::class, 'image']
        );

        Route::patch(
            '/certificate-templates/{certificateTemplate}',
            [AdminCertificateTemplateController::class, 'update']
        );

        Route::delete(
            '/certificate-templates/{certificateTemplate}',
            [AdminCertificateTemplateController::class, 'destroy']
        );

        Route::post(
            '/event-categories',
            [AdminEventCategoryController::class, 'store']
        );

        Route::patch(
            '/event-categories/{eventCategory}',
            [AdminEventCategoryController::class, 'update']
        );

        Route::delete(
            '/event-categories/{eventCategory}',
            [AdminEventCategoryController::class, 'destroy']
        );

        // Template naskah (tata letak buku otomatis)
        Route::get('/manuscript-templates/meta', [AdminManuscriptTemplateController::class, 'meta']);
        Route::get('/manuscript-templates', [AdminManuscriptTemplateController::class, 'index']);
        Route::post('/manuscript-templates', [AdminManuscriptTemplateController::class, 'store']);
        Route::get('/manuscript-templates/{manuscriptTemplate}', [AdminManuscriptTemplateController::class, 'show']);
        Route::patch('/manuscript-templates/{manuscriptTemplate}', [AdminManuscriptTemplateController::class, 'update']);
        Route::post('/manuscript-templates/{manuscriptTemplate}/duplicate', [AdminManuscriptTemplateController::class, 'duplicate']);
        Route::post('/manuscript-templates/{manuscriptTemplate}/make-default', [AdminManuscriptTemplateController::class, 'makeDefault']);
        Route::delete('/manuscript-templates/{manuscriptTemplate}', [AdminManuscriptTemplateController::class, 'destroy']);

        // Konten sosmed (poster + caption buku terbit)
        Route::get('/social/books', [AdminSocialPostController::class, 'books']);
        Route::get('/social/books/{book}/cover', [AdminSocialPostController::class, 'cover']);

        // Terbitkan naskah (surat ISBN) + template surat
        Route::get('/isbn-applications', [AdminIsbnApplicationController::class, 'index']);
        Route::get('/isbn-applications/{isbnApplication}/download', [AdminIsbnApplicationController::class, 'download']);
        Route::get('/isbn-applications/{isbnApplication}/dummy', [AdminIsbnApplicationController::class, 'dummy']);
        Route::get('/isbn-applications/{isbnApplication}/cover', [AdminIsbnApplicationController::class, 'cover']);
        Route::get('/isbn-applications/{isbnApplication}/process', [AdminIsbnApplicationController::class, 'process']);
        Route::post('/isbn-applications/{isbnApplication}/process/isbn', [AdminIsbnApplicationController::class, 'updateIsbnProcess']);
        Route::post('/isbn-applications/{isbnApplication}/process/physical', [AdminIsbnApplicationController::class, 'updatePhysicalProcess']);
        Route::patch('/isbn-applications/{isbnApplication}/process/settings', [AdminIsbnApplicationController::class, 'updateProcessSettings']);
        Route::patch('/isbn-applications/{isbnApplication}/form', [AdminIsbnApplicationController::class, 'updateForm']);

        Route::get('/isbn-settings', [AdminIsbnSettingController::class, 'show']);
        Route::put('/isbn-settings', [AdminIsbnSettingController::class, 'update']);
        Route::post('/isbn-settings/reset', [AdminIsbnSettingController::class, 'reset']);
        Route::get('/isbn-settings/preview', [AdminIsbnSettingController::class, 'preview']);
        Route::get('/isbn-settings/assets/{kind}', [AdminIsbnSettingController::class, 'asset']);
        Route::post('/isbn-settings/assets/{kind}', [AdminIsbnSettingController::class, 'uploadAsset']);
        Route::delete('/isbn-settings/assets/{kind}', [AdminIsbnSettingController::class, 'deleteAsset']);

        // Tartila Book (situs baca buku)
        Route::prefix('reader')->group(function () {
            Route::get('/books', [ReaderAdminBookController::class, 'index']);
            Route::get('/books/candidates', [ReaderAdminBookController::class, 'candidates']);
            Route::post('/books', [ReaderAdminBookController::class, 'store']);
            Route::get('/books/{readerBook}', [ReaderAdminBookController::class, 'show']);
            Route::patch('/books/{readerBook}', [ReaderAdminBookController::class, 'update']);
            Route::delete('/books/{readerBook}', [ReaderAdminBookController::class, 'destroy']);

            // Mitra: kelola mitra dan tinjau ebook mitra (setujui / tolak dengan catatan).
            Route::get('/partners', [ReaderAdminPartnerController::class, 'partners']);
            Route::post('/partners', [ReaderAdminPartnerController::class, 'storePartner']);
            Route::put('/partners/{partner}', [ReaderAdminPartnerController::class, 'updatePartner']);
            Route::delete('/partners/{partner}', [ReaderAdminPartnerController::class, 'destroyPartner']);
            Route::get('/partner-books', [ReaderAdminPartnerController::class, 'books']);
            Route::get('/partner-books/{bookId}', [ReaderAdminPartnerController::class, 'book'])->whereNumber('bookId');
            Route::post('/partner-books/{bookId}/approve', [ReaderAdminPartnerController::class, 'approve'])->whereNumber('bookId');
            Route::post('/partner-books/{bookId}/reject', [ReaderAdminPartnerController::class, 'reject'])->whereNumber('bookId');
            Route::get('/partner-books/{bookId}/documents/{kind}', [ReaderAdminPartnerController::class, 'download'])->whereNumber('bookId')->whereIn('kind', ['ebook', 'turnitin', 'originality', 'mou']);

            Route::get('/terms', [ReaderAdminConfigController::class, 'terms']);
            Route::post('/terms', [ReaderAdminConfigController::class, 'storeTerm']);
            Route::put('/terms/{term}', [ReaderAdminConfigController::class, 'updateTerm']);
            Route::delete('/terms/{term}', [ReaderAdminConfigController::class, 'destroyTerm']);

            Route::get('/plans', [ReaderAdminConfigController::class, 'plans']);
            Route::post('/plans', [ReaderAdminConfigController::class, 'storePlan']);
            Route::put('/plans/{plan}', [ReaderAdminConfigController::class, 'updatePlan']);
            Route::delete('/plans/{plan}', [ReaderAdminConfigController::class, 'destroyPlan']);

            Route::get('/rules', [ReaderAdminConfigController::class, 'rules']);
            Route::post('/rules', [ReaderAdminConfigController::class, 'storeRule']);
            Route::delete('/rules/{rule}', [ReaderAdminConfigController::class, 'destroyRule']);

            Route::get('/settings', [ReaderAdminConfigController::class, 'settings']);
            Route::put('/settings', [ReaderAdminConfigController::class, 'updateSettings']);

            Route::get('/orders', [ReaderAdminOrderController::class, 'index']);
            Route::get('/orders/{order}/proof', [ReaderAdminOrderController::class, 'proof']);
            Route::post('/orders/{order}/verify', [ReaderAdminOrderController::class, 'verify']);
            Route::get('/royalties', [ReaderAdminOrderController::class, 'royalties']);
        });

        // MOU distribusi buku: template per kategori + MOU per judul
        Route::get('/mou-templates/{category}', [AdminMouTemplateController::class, 'show']);
        Route::put('/mou-templates/{category}', [AdminMouTemplateController::class, 'update']);
        Route::post('/mou-templates/{category}/reset', [AdminMouTemplateController::class, 'reset']);
        Route::get('/mou-templates/{category}/preview', [AdminMouTemplateController::class, 'preview']);
        Route::get('/mous', [AdminMouController::class, 'index']);
        Route::get('/mous/{mou}', [AdminMouController::class, 'show']);
        Route::put('/mous/{mou}', [AdminMouController::class, 'update']);
        Route::post('/mous/{mou}/reset-template', [AdminMouController::class, 'resetToTemplate']);
        Route::get('/mous/{mou}/pdf', [AdminMouController::class, 'sealedPdf']);
        Route::post('/mous/{mou}/final', [AdminMouController::class, 'uploadFinal']);
        Route::get('/mous/{mou}/final', [AdminMouController::class, 'finalPdf']);
        Route::delete('/mous/{mou}/final', [AdminMouController::class, 'deleteFinal']);
        Route::post('/mous/{mou}/addenda', [AdminMouController::class, 'storeAddendum']);
        Route::get('/mous/{mou}/addenda/{addendum}', [AdminMouController::class, 'addendum']);
        Route::delete('/mous/{mou}/addenda/{addendum}', [AdminMouController::class, 'destroyAddendum']);

        // Penarikan saldo dompet
        // Keuangan
        Route::get('/finance/summary', [AdminFinanceController::class, 'summary']);
        Route::get('/finance/transactions', [AdminFinanceController::class, 'transactions']);
        Route::post('/finance/transactions', [AdminFinanceController::class, 'storeTransaction']);
        Route::patch('/finance/transactions/{transaction}', [AdminFinanceController::class, 'updateTransaction']);
        Route::delete('/finance/transactions/{transaction}', [AdminFinanceController::class, 'destroyTransaction']);
        Route::patch('/finance/accounts/{source}/{id}', [AdminFinanceController::class, 'assignAccount'])
            ->where(['source' => 'order|withdrawal', 'id' => '[0-9]+']);
        Route::get('/finance/packages', [AdminFinanceController::class, 'packages']);
        Route::get('/finance/books', [AdminFinanceController::class, 'books']);
        Route::get('/finance/ebooks', [AdminFinanceController::class, 'ebooks']);
        Route::get('/finance/events', [AdminFinanceController::class, 'events']);
        Route::put('/finance/details', [AdminFinanceController::class, 'updateDetail']);
        Route::get('/finance/settings', [AdminFinanceController::class, 'settings']);
        Route::put('/finance/settings', [AdminFinanceController::class, 'updateSettings']);
        Route::patch('/finance/payment-methods/{paymentMethod}/opening-balance', [AdminFinanceController::class, 'updateOpeningBalance']);

        // Tentang Kami
        Route::get('/about', [AdminAboutController::class, 'show']);
        Route::put('/about', [AdminAboutController::class, 'updateProfile']);
        Route::post('/about/legalities', [AdminAboutController::class, 'storeLegality']);
        Route::put('/about/legalities/order', [AdminAboutController::class, 'orderLegalities']);
        Route::put('/about/legalities/{legality}', [AdminAboutController::class, 'updateLegality']);
        Route::delete('/about/legalities/{legality}', [AdminAboutController::class, 'destroyLegality']);
        Route::post('/about/team', [AdminAboutController::class, 'storeMember']);
        Route::put('/about/team/order', [AdminAboutController::class, 'orderMembers']);
        Route::put('/about/team/{member}', [AdminAboutController::class, 'updateMember']);
        Route::delete('/about/team/{member}', [AdminAboutController::class, 'destroyMember']);

        // HKI
        Route::get('/hki', [AdminHkiController::class, 'index']);
        Route::put('/hki/{subjectType}/{subjectId}', [AdminHkiController::class, 'update'])
            ->where(['subjectType' => 'order|book', 'subjectId' => '[0-9]+']);
        Route::post('/hki/{subjectType}/{subjectId}/certificate', [AdminHkiController::class, 'uploadCertificate'])
            ->where(['subjectType' => 'order|book', 'subjectId' => '[0-9]+']);
        Route::get('/hki/records/{hkiRecord}/certificate', [AdminHkiController::class, 'downloadCertificate']);
        Route::delete('/hki/records/{hkiRecord}/certificate', [AdminHkiController::class, 'deleteCertificate']);

        Route::get('/withdrawals', [AdminWithdrawalController::class, 'index']);
        Route::post('/withdrawals/{withdrawal}/pay', [AdminWithdrawalController::class, 'pay']);
        Route::post('/withdrawals/{withdrawal}/reject', [AdminWithdrawalController::class, 'reject']);

        // Voucher dan diskon
        Route::get('/discounts', [AdminDiscountController::class, 'index']);
        Route::post('/discounts/apply', [AdminDiscountController::class, 'apply']);
        Route::post('/discounts/reset', [AdminDiscountController::class, 'reset']);

        Route::get('/vouchers', [AdminVoucherController::class, 'index']);
        Route::post('/vouchers', [AdminVoucherController::class, 'store']);
        Route::post('/vouchers/reset', [AdminVoucherController::class, 'reset']);
        Route::patch('/vouchers/{voucher}', [AdminVoucherController::class, 'update']);

        Route::get('/voucher-grants', [AdminVoucherGrantController::class, 'index']);
        Route::get('/voucher-grants/eligible-users', [AdminVoucherGrantController::class, 'eligibleUsers']);
        Route::post('/voucher-grants', [AdminVoucherGrantController::class, 'store']);
        Route::patch('/voucher-grants/{voucherGrant}', [AdminVoucherGrantController::class, 'update']);
        Route::delete('/voucher-grants/{voucherGrant}', [AdminVoucherGrantController::class, 'destroy']);

        // Royalti
        Route::get(
            '/royalties',
            [AdminRoyaltyController::class, 'index']
        );

        Route::post(
            '/books/{book}/external-sales',
            [AdminRoyaltyController::class, 'storeExternalSale']
        );

        Route::patch(
            '/external-sales/{bookExternalSale}',
            [AdminRoyaltyController::class, 'updateExternalSale']
        );

        Route::delete(
            '/external-sales/{bookExternalSale}',
            [AdminRoyaltyController::class, 'destroyExternalSale']
        );

        // Book & Field Categories
        Route::post(
            '/book-categories',
            [BookCategoryController::class, 'store']
        );

        Route::patch(
            '/book-categories/{bookCategory}',
            [BookCategoryController::class, 'update']
        );

        Route::delete(
            '/book-categories/{bookCategory}',
            [BookCategoryController::class, 'destroy']
        );

        Route::post(
            '/field-categories',
            [FieldCategoryController::class, 'store']
        );

        Route::patch(
            '/field-categories/{fieldCategory}',
            [FieldCategoryController::class, 'update']
        );

        Route::delete(
            '/field-categories/{fieldCategory}',
            [FieldCategoryController::class, 'destroy']
        );

        // Book Chapter Settings (batas minimum/maksimum untuk editor)
        Route::get(
            '/book-chapter-settings',
            [AdminBookChapterSettingController::class, 'show']
        );

        Route::patch(
            '/book-chapter-settings',
            [AdminBookChapterSettingController::class, 'update']
        );

        // Book Chapter Projects (kelola semua)
        Route::get(
            '/book-chapter-projects',
            [AdminBookChapterProjectController::class, 'index']
        );

        Route::post(
            '/book-chapter-projects',
            [AdminBookChapterProjectController::class, 'store']
        );

        Route::post(
            '/book-chapter-projects/bulk-import',
            [AdminBookChapterProjectController::class, 'bulkImport']
        );

        Route::get(
            '/book-chapter-projects/{bookChapterProject}',
            [AdminBookChapterProjectController::class, 'show']
        );

        // Data poster promosi Book Chapter (Konten Sosmed).
        Route::get(
            '/book-chapter-projects/{bookChapterProject}/promo',
            [AdminBookChapterProjectController::class, 'promo']
        );

        Route::patch(
            '/book-chapter-projects/{bookChapterProject}',
            [AdminBookChapterProjectController::class, 'update']
        );

        Route::delete(
            '/book-chapter-projects/{bookChapterProject}',
            [AdminBookChapterProjectController::class, 'destroy']
        );

        Route::post(
            '/book-chapter-projects/{bookChapterProject}/chapters',
            [AdminBookChapterProjectController::class, 'storeChapter']
        );

        Route::patch(
            '/book-chapter-projects/chapters/{chapter}',
            [AdminBookChapterProjectController::class, 'updateChapter']
        );

        Route::delete(
            '/book-chapter-projects/chapters/{chapter}',
            [AdminBookChapterProjectController::class, 'destroyChapter']
        );

        // Gabungkan naskah semua bab menjadi satu naskah buku untuk editor.
        Route::get(
            '/book-chapter-projects/{bookChapterProject}/compilation',
            [AdminBookChapterCompilationController::class, 'show']
        );

        Route::post(
            '/book-chapter-projects/{bookChapterProject}/compilation',
            [AdminBookChapterCompilationController::class, 'store']
        );

    });

});

/*
|--------------------------------------------------------------------------
| Halaman abstrak untuk mesin pencari ilmiah (Google Scholar)
|--------------------------------------------------------------------------
|
| HTML biasa dari server (bukan JSON) supaya robot yang tidak menjalankan
| JavaScript tetap bisa membaca metadata `citation_*`, daftar buku, dan tautan
| PDF. Ada di bawah /api agar tetap terjangkau bila web frontend dan API
| berbagi satu domain lewat reverse proxy (hanya /api/* yang sampai ke Laravel).
|
*/

Route::get(
    '/katalog',
    [ScholarBookPageController::class, 'index']
)->name('scholar.catalog');

// PDF cuplikan di direktori yang sama dengan halaman abstraknya: Google Scholar
// mensyaratkan citation_pdf_url berada di sub-direktori yang sama dengan
// halaman abstrak. Didaftarkan sebelum rute abstrak supaya ".pdf" tidak ikut
// terbaca sebagai bagian slug.
Route::get(
    '/abstrak/{book:slug}.pdf',
    [BookController::class, 'preview']
)->name('scholar.pdf');

Route::get(
    '/abstrak/{book:slug}',
    [ScholarBookPageController::class, 'show']
)->name('scholar.abstract');
