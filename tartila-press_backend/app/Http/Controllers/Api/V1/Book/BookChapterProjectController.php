<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\Book;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class BookChapterProjectController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Proyek Book Chapter yang masih punya slot terbuka
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $projects = Book::with(['category', 'fieldCategory', 'ownerEditor', 'chapters', 'packageItems'])
            ->where('is_chapter_offering', true)
            ->whereHas('chapters', function ($query) {
                $query->whereNull('manuscript_id')->whereNull('order_id');
            })
            ->where(function ($query) {
                $query->whereNull('submission_deadline')
                    ->orWhere('submission_deadline', '>=', now());
            })
            ->latest()
            ->get();

        $this->presentIncludedPackage($projects);

        if (! $request->user('sanctum')) {
            $this->hideGuestRestrictedFields($projects);
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar proyek Book Chapter berhasil diambil.',
            'data' => $projects,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail proyek + status tiap slot bab
    |--------------------------------------------------------------------------
    */

    public function show(Request $request, Book $bookChapterProject): JsonResponse
    {
        abort_unless($bookChapterProject->is_chapter_offering, 404, 'Proyek Book Chapter tidak ditemukan.');

        $bookChapterProject->load(['category', 'fieldCategory', 'ownerEditor', 'chapters', 'packageItems']);

        $this->presentIncludedPackage(collect([$bookChapterProject]));

        if (! $request->user('sanctum')) {
            $this->hideGuestRestrictedFields(collect([$bookChapterProject]));
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail proyek Book Chapter berhasil diambil.',
            'data' => $bookChapterProject,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Fasilitas & layanan yang didapatkan (nama saja, dari daftar item paket
    | custom yang dicentang admin/editor). Biaya item tidak ikut terkirim.
    |--------------------------------------------------------------------------
    */

    private function presentIncludedPackage(Collection $projects): void
    {
        foreach ($projects as $project) {
            $items = $project->packageItems;

            $project->setAttribute(
                'package_facilities',
                $items->where('type', 'facility')->pluck('name')->values()->all()
            );
            $project->setAttribute(
                'package_services',
                $items->where('type', 'service')->pluck('name')->values()->all()
            );

            $project->unsetRelation('packageItems');
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Sembunyikan deskripsi proyek & SOP tiap bab untuk pengunjung yang
    | belum login — hanya judul bab dan harga yang tetap publik.
    |--------------------------------------------------------------------------
    */

    private function hideGuestRestrictedFields(Collection $projects): void
    {
        foreach ($projects as $project) {
            $project->makeHidden('description');
            $project->chapters->each(fn ($chapter) => $chapter->makeHidden('sop_terms'));
        }
    }
}
