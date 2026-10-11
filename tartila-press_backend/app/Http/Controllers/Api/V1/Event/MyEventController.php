<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyEventController extends Controller
{
    public function __construct(private readonly CertificateService $certificates) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Event yang diikuti user (hanya pendaftaran yang sudah confirmed),
    | beserta status absensi dan sertifikatnya
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        // Absensi yang sudah terisi sebelum event diberi templat ikut
        // mendapat sertifikat begitu templatnya dipasang.
        $this->certificates->syncEventCertificates($request->user());

        $registrations = $request->user()
            ->eventRegistrations()
            ->where('status', 'confirmed')
            ->with(['event.category', 'order', 'attendance.certificate'])
            ->latest()
            ->get();

        $registrations->each(function ($registration) {
            $event = $registration->event;
            $attendance = $registration->attendance;

            $registration->setAttribute('attendance_info', [
                'enabled' => $event->attendance_enabled,
                'state' => $event->attendanceState(),
                'opens_at' => $event->attendance_opens_at,
                'closes_at' => $event->attendance_closes_at,
                'submitted' => $attendance !== null,
                'submitted_at' => $attendance?->submitted_at,
                'has_certificate_template' => $event->certificate_template_id !== null,
                'certificate_id' => $attendance?->certificate?->id,
            ]);

            // Internal: frontend cukup memakai attendance_info.
            $event->makeHidden(['certificate_template_id']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Event saya berhasil diambil.',
            'data' => $registrations,
        ]);
    }
}
