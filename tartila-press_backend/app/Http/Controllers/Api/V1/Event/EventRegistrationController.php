<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EventRegistrationController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Store - User mendaftar event. Event gratis langsung confirmed, event
    | berbayar membuat Order (pending) yang baru confirmed setelah admin
    | ACC bukti pembayaran lewat alur Order yang sudah ada.
    |--------------------------------------------------------------------------
    */

    public function store(Request $request, Event $event): JsonResponse
    {
        abort_unless($event->is_active, 404, 'Event tidak ditemukan.');

        $validated = $request->validate([
            'document_url' => [
                $event->requires_document ? 'required' : 'nullable',
                'string',
                'max:500',
            ],
        ]);

        abort_if(
            $event->registration_deadline && $event->registration_deadline->isPast(),
            422,
            'Pendaftaran untuk event ini sudah ditutup.'
        );

        $user = $request->user();

        abort_if(
            EventRegistration::where('event_id', $event->id)
                ->where('user_id', $user->id)
                ->exists(),
            422,
            'Anda sudah terdaftar di event ini.'
        );

        $documentUrl = $validated['document_url'] ?? null;

        if ((float) $event->fee <= 0) {
            $registration = EventRegistration::create([
                'event_id' => $event->id,
                'user_id' => $user->id,
                'document_url' => $documentUrl,
                'status' => 'confirmed',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pendaftaran berhasil.',
                'data' => $registration,
            ], 201);
        }

        $registration = DB::transaction(function () use ($event, $user, $documentUrl) {
            $order = Order::create([
                'order_number' => Order::generateOrderNumber(),
                'user_id' => $user->id,
                'status' => 'pending',
                'subtotal' => $event->fee,
                'discount_total' => 0,
                'editor_fee' => 0,
                'total' => $event->fee,
            ]);

            $order->logStatusHistory('order_placed');

            $order->items()->create([
                'itemable_type' => Event::class,
                'itemable_id' => $event->id,
                'name' => $event->title,
                'quantity' => 1,
                'unit_price' => $event->fee,
                'subtotal' => $event->fee,
            ]);

            return EventRegistration::create([
                'event_id' => $event->id,
                'user_id' => $user->id,
                'order_id' => $order->id,
                'document_url' => $documentUrl,
                'status' => 'pending',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Pendaftaran dibuat. Silakan selesaikan pembayaran di halaman Pesanan.',
            'data' => $registration->load('order'),
        ], 201);
    }
}
