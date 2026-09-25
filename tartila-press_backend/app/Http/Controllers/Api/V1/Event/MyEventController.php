<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyEventController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Event yang diikuti user (semua status pendaftaran)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $registrations = $request->user()
            ->eventRegistrations()
            ->where('status', 'confirmed')
            ->with(['event.category', 'order'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Event saya berhasil diambil.',
            'data' => $registrations,
        ]);
    }
}
