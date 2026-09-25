<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;

class EventController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar event publik yang aktif
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $events = Event::active()
            ->with('category')
            ->withCount([
                'registrations as confirmed_registrations_count' => fn ($query) => $query->where('status', 'confirmed'),
            ])
            ->latest('starts_at')
            ->get()
            ->makeHidden(['meet_link', 'certificate_url']);

        return response()->json([
            'success' => true,
            'message' => 'Daftar event berhasil diambil.',
            'data' => $events,
        ]);
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
        $event->makeHidden(['meet_link', 'certificate_url']);

        return response()->json([
            'success' => true,
            'message' => 'Detail event berhasil diambil.',
            'data' => $event,
        ]);
    }
}
