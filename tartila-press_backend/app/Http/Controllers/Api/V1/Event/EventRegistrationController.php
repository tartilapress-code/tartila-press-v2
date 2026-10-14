<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Api\V1\Order\OrderController;
use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\Order;
use App\Support\OrderNumber;
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
            'payment_method_id' => (float) $event->fee > 0 ? OrderController::paymentMethodRules() : ['nullable'],
        ], [
            'payment_method_id.required' => 'Pilih rekening tujuan pembayaran.',
        ]);

        abort_if(
            $event->registration_deadline && $event->registration_deadline->isPast(),
            422,
            'Pendaftaran untuk event ini sudah ditutup.'
        );

        $user = $request->user();

        // Pendaftaran yang dibatalkan (mis. tidak dibayar 1×24 jam) boleh diulang.
        $existing = EventRegistration::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->first();

        abort_if(
            $existing && $existing->status !== 'cancelled',
            422,
            'Anda sudah terdaftar di event ini.'
        );

        $documentUrl = $validated['document_url'] ?? null;

        if ((float) $event->fee <= 0) {
            $registration = EventRegistration::updateOrCreate(
                ['event_id' => $event->id, 'user_id' => $user->id],
                ['order_id' => null, 'document_url' => $documentUrl, 'status' => 'confirmed'],
            );

            return response()->json([
                'success' => true,
                'message' => 'Pendaftaran berhasil.',
                'data' => $registration,
            ], 201);
        }

        $paymentMethodId = $validated['payment_method_id'] ?? null;

        $registration = DB::transaction(function () use ($event, $user, $documentUrl, $paymentMethodId) {
            $order = Order::create([
                'order_number' => Order::generateOrderNumber(OrderNumber::EVENT),
                'user_id' => $user->id,
                'status' => 'pending',
                'subtotal' => $event->fee,
                'discount_total' => 0,
                'editor_fee' => 0,
                'total' => $event->fee,
                'payment_method_id' => $paymentMethodId,
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

            return EventRegistration::updateOrCreate(
                ['event_id' => $event->id, 'user_id' => $user->id],
                ['order_id' => $order->id, 'document_url' => $documentUrl, 'status' => 'pending'],
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Pendaftaran dibuat. Selesaikan pembayaran dalam 1×24 jam.',
            'data' => $registration->load('order'),
        ], 201);
    }
}
