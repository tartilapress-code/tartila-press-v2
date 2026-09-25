<?php

use App\Http\Controllers\Api\V1\Admin\ArticleController as AdminArticleController;
use App\Http\Controllers\Api\V1\Admin\BookChapterProjectController as AdminBookChapterProjectController;
use App\Http\Controllers\Api\V1\Admin\BookChapterSettingController as AdminBookChapterSettingController;
use App\Http\Controllers\Api\V1\Admin\BookController as AdminBookController;
use App\Http\Controllers\Api\V1\Admin\BookShipmentController;
use App\Http\Controllers\Api\V1\Admin\EventCategoryController as AdminEventCategoryController;
use App\Http\Controllers\Api\V1\Admin\EventController as AdminEventController;
use App\Http\Controllers\Api\V1\Admin\ManuscriptController as AdminManuscriptController;
use App\Http\Controllers\Api\V1\Admin\RoyaltyController as AdminRoyaltyController;
use App\Http\Controllers\Api\V1\Admin\UserManagementController;
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
use App\Http\Controllers\Api\V1\Editor\BookChapterProjectController as EditorBookChapterProjectController;
use App\Http\Controllers\Api\V1\Editor\BookChapterSettingController as EditorBookChapterSettingController;
use App\Http\Controllers\Api\V1\Editor\EditorDirectoryController;
use App\Http\Controllers\Api\V1\Editor\ManuscriptController as EditorManuscriptController;
use App\Http\Controllers\Api\V1\Editor\MyEditorProfileController;
use App\Http\Controllers\Api\V1\Event\EventController;
use App\Http\Controllers\Api\V1\Event\EventRegistrationController;
use App\Http\Controllers\Api\V1\Event\MyEventController;
use App\Http\Controllers\Api\V1\Manuscript\ManuscriptController as PenulisManuscriptController;
use App\Http\Controllers\Api\V1\Order\OrderController;
use App\Http\Controllers\Api\V1\Order\OrderMessageController;
use App\Http\Controllers\Api\V1\Package\CustomPackageItemController;
use App\Http\Controllers\Api\V1\Package\PackageController;
use App\Http\Controllers\Api\V1\Payment\PaymentMethodController;
use App\Http\Controllers\Api\V1\Profile\ProfileController;
use App\Http\Controllers\Api\V1\PublicProfile\MyPublicProfileController;
use App\Http\Controllers\Api\V1\PublicProfile\ProfileExperienceController;
use App\Http\Controllers\Api\V1\PublicProfile\PublicProfileController;
use App\Http\Controllers\Api\V1\RoleRequest\RoleRequestController;
use App\Http\Controllers\Api\V1\Royalty\RoyaltyController as UserRoyaltyController;
use App\Http\Controllers\Api\V1\Upload\DocumentUploadController;
use App\Http\Controllers\Api\V1\Upload\ImageUploadController;
use App\Http\Controllers\Api\V1\User\UserSearchController;
use App\Http\Controllers\Scholar\BookPageController as ScholarBookPageController;
use Illuminate\Support\Facades\Route;
use Modules\Publisher\Http\Controllers\DraftEditing\ContentBlockController;
use Modules\Publisher\Http\Controllers\DraftEditing\ManuscriptChapterController;
use Modules\Publisher\Http\Controllers\DraftEditing\ManuscriptController;
use Modules\Publisher\Http\Controllers\DraftEditing\ManuscriptReferenceController;
use Modules\Publisher\Http\Controllers\Layout\PageNumberingController;
use Modules\Publisher\Http\Controllers\Layout\TemplateController;

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

    });

    Route::get(
        '/events/{event:slug}',
        [EventController::class, 'show']
    )->middleware('public.sanitize');

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
            '/editor/profile',
            [MyEditorProfileController::class, 'show']
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
        )->middleware('email.verified');

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

        Route::post(
            '/{manuscript}/final-review',
            [PenulisManuscriptController::class, 'finalReview']
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

        Route::post(
            '/manuscripts/{manuscript}/assign-editor',
            [AdminManuscriptController::class, 'assignEditor']
        );

        Route::post(
            '/manuscripts/{manuscript}/open-pool',
            [AdminManuscriptController::class, 'openPool']
        );

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

    });

    /*
    |--------------------------------------------------------------------------
    | Publisher Engine (Layout & Draft Editing)
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('publisher')->group(function () {

        /*
        |------------------------------------------------------------------
        | Fitur: Layout (rancang template)
        |------------------------------------------------------------------
        */

        Route::prefix('layout')->group(function () {

            Route::get(
                '/templates',
                [TemplateController::class, 'index']
            );

            Route::post(
                '/templates',
                [TemplateController::class, 'store']
            );

            Route::get(
                '/templates/{template}',
                [TemplateController::class, 'show']
            );

            Route::patch(
                '/templates/{template}',
                [TemplateController::class, 'update']
            );

            Route::delete(
                '/templates/{template}',
                [TemplateController::class, 'destroy']
            );

            Route::get(
                '/templates/{template}/page-numbering',
                [PageNumberingController::class, 'show']
            );

            Route::put(
                '/templates/{template}/page-numbering',
                [PageNumberingController::class, 'update']
            );

        });

        /*
        |------------------------------------------------------------------
        | Fitur: Draft Editing (susun naskah)
        |------------------------------------------------------------------
        */

        Route::prefix('draft')->group(function () {

            // Manuscripts
            Route::get(
                '/manuscripts',
                [ManuscriptController::class, 'index']
            );

            Route::post(
                '/manuscripts',
                [ManuscriptController::class, 'store']
            );

            Route::get(
                '/manuscripts/{manuscript}',
                [ManuscriptController::class, 'show']
            );

            Route::patch(
                '/manuscripts/{manuscript}',
                [ManuscriptController::class, 'update']
            );

            Route::delete(
                '/manuscripts/{manuscript}',
                [ManuscriptController::class, 'destroy']
            );

            Route::post(
                '/manuscripts/{manuscript}/publish',
                [ManuscriptController::class, 'publish']
            );

            // Chapters
            Route::get(
                '/manuscripts/{manuscript}/chapters',
                [ManuscriptChapterController::class, 'index']
            );

            Route::post(
                '/manuscripts/{manuscript}/chapters',
                [ManuscriptChapterController::class, 'store']
            );

            Route::put(
                '/manuscripts/{manuscript}/chapters/reorder',
                [ManuscriptChapterController::class, 'reorder']
            );

            Route::patch(
                '/manuscripts/{manuscript}/chapters/{chapter}',
                [ManuscriptChapterController::class, 'update']
            );

            Route::delete(
                '/manuscripts/{manuscript}/chapters/{chapter}',
                [ManuscriptChapterController::class, 'destroy']
            );

            // Content Blocks
            Route::get(
                '/chapters/{chapter}/blocks',
                [ContentBlockController::class, 'index']
            );

            Route::post(
                '/chapters/{chapter}/blocks',
                [ContentBlockController::class, 'store']
            );

            Route::put(
                '/chapters/{chapter}/blocks/reorder',
                [ContentBlockController::class, 'reorder']
            );

            Route::patch(
                '/chapters/{chapter}/blocks/{block}',
                [ContentBlockController::class, 'update']
            );

            Route::delete(
                '/chapters/{chapter}/blocks/{block}',
                [ContentBlockController::class, 'destroy']
            );

            // References
            Route::get(
                '/manuscripts/{manuscript}/references',
                [ManuscriptReferenceController::class, 'index']
            );

            Route::post(
                '/manuscripts/{manuscript}/references',
                [ManuscriptReferenceController::class, 'store']
            );

            Route::patch(
                '/manuscripts/{manuscript}/references/{reference}',
                [ManuscriptReferenceController::class, 'update']
            );

            Route::delete(
                '/manuscripts/{manuscript}/references/{reference}',
                [ManuscriptReferenceController::class, 'destroy']
            );

        });

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
