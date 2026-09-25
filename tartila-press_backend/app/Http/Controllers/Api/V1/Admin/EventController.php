<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    private const EVENT_FIELD_RULES = [
        'title' => ['required', 'string', 'max:255'],
        'description' => ['nullable', 'string'],
        'event_category_id' => ['nullable', 'integer', 'exists:event_categories,id'],
        'banner' => ['nullable', 'string', 'max:500'],
        'starts_at' => ['required', 'date'],
        'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        'registration_deadline' => ['nullable', 'date'],
        'requires_document' => ['sometimes', 'boolean'],
        'requires_meet_link' => ['sometimes', 'boolean'],
        'meet_link' => ['nullable', 'string', 'max:500'],
        'youtube_url' => ['nullable', 'string', 'max:500'],
        'certificate_url' => ['nullable', 'string', 'max:500'],
        'fee' => ['sometimes', 'numeric', 'min:0', 'max:99999999.99'],
        'is_active' => ['sometimes', 'boolean'],
    ];

    /*
    |--------------------------------------------------------------------------
    | Index - Admin melihat semua event (semua status aktif/nonaktif)
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $events = Event::with(['category', 'creator'])
            ->withCount([
                'registrations as confirmed_registrations_count' => fn ($query) => $query->where('status', 'confirmed'),
            ])
            ->latest('starts_at')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar event berhasil diambil.',
            'data' => $events,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin membuat event baru
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate(self::EVENT_FIELD_RULES);

        $event = Event::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Event berhasil dibuat.',
            'data' => $event,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Admin mengubah event
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Event $event): JsonResponse
    {
        $rules = self::EVENT_FIELD_RULES;
        $rules['title'] = ['sometimes', 'required', 'string', 'max:255'];
        $rules['starts_at'] = ['sometimes', 'required', 'date'];

        $validated = $request->validate($rules);

        $event->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Event berhasil diperbarui.',
            'data' => $event,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Admin menghapus event
    |--------------------------------------------------------------------------
    */

    public function destroy(Event $event): JsonResponse
    {
        $event->delete();

        return response()->json([
            'success' => true,
            'message' => 'Event berhasil dihapus.',
        ]);
    }
}
