<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    /**
     * Kolom yang hanya untuk peserta terdaftar / admin: tidak ikut ke
     * respons publik.
     */
    private const PRIVATE_COLUMNS = [
        'meet_link',
        'certificate_url',
        'attendance_enabled',
        'attendance_opens_at',
        'attendance_closes_at',
        'certificate_template_id',
    ];

    /*
    |--------------------------------------------------------------------------
    | Index - Daftar event publik yang aktif
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $events = Event::active()
            ->with('category')
            ->withCount([
                'registrations as confirmed_registrations_count' => fn ($query) => $query->where('status', 'confirmed'),
            ])
            ->latest('starts_at')
            ->orderByDesc('id');

        // Rekomendasi (maksimal 3, dipin admin) paling atas.
        $recommendations = app(RecommendationService::class);
        $recommendations->pinFirst($events, 'event', 'events.id');
        $events = $events->paginate($this->perPage($request, 10));

        $events->getCollection()->makeHidden(self::PRIVATE_COLUMNS);
        $recommendations->markRecommended($events->getCollection(), 'event');

        return $this->pageResponse($events, 'Daftar event berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail event publik
    |--------------------------------------------------------------------------
    */

    public function show(Event $event): JsonResponse
    {
        abort_unless($event->is_active, 404, 'Event tidak ditemukan.');

        $event->load('category');
        $event->loadCount([
            'registrations as confirmed_registrations_count' => fn ($query) => $query->where('status', 'confirmed'),
        ]);
        $event->makeHidden(self::PRIVATE_COLUMNS);

        return response()->json([
            'success' => true,
            'message' => 'Detail event berhasil diambil.',
            'data' => $event,
        ]);
    }
}
