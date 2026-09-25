<?php

namespace App\Http\Controllers\Api\V1\RoleRequest;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\RoleRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleRequestController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Store - User mengajukan jadi Penulis/Editor
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'requested_role' => [
                'required',
                Rule::in([
                    'penulis',
                    'editor',
                ]),
            ],
        ]);

        $requestedRole = $validated['requested_role'];

        $alreadyHasRole = $user->roles()
            ->where('name', $requestedRole)
            ->exists();

        abort_if(
            $alreadyHasRole,
            422,
            'Anda sudah memiliki role tersebut.'
        );

        $hasPendingRequest = $user->roleRequests()
            ->where('requested_role', $requestedRole)
            ->where('status', 'pending')
            ->exists();

        abort_if(
            $hasPendingRequest,
            422,
            'Anda sudah memiliki permintaan yang sedang menunggu persetujuan untuk role ini.'
        );

        $roleRequest = $user->roleRequests()->create([
            'requested_role' => $requestedRole,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permintaan berhasil diajukan.',
            'data' => $roleRequest,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Mine - Riwayat permintaan milik user sendiri
    |--------------------------------------------------------------------------
    */

    public function mine(Request $request): JsonResponse
    {
        $roleRequests = $request->user()
            ->roleRequests()
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Riwayat permintaan berhasil diambil.',
            'data' => $roleRequests,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Index - Admin melihat semua permintaan
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $query = RoleRequest::with(['user', 'reviewer'])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar permintaan berhasil diambil.',
            'data' => $query->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Approve - Admin menyetujui permintaan
    |--------------------------------------------------------------------------
    */

    public function approve(Request $request, RoleRequest $roleRequest): JsonResponse
    {
        abort_if(
            $roleRequest->status !== 'pending',
            422,
            'Permintaan ini sudah diproses sebelumnya.'
        );

        $role = Role::where(
            'name',
            $roleRequest->requested_role
        )->firstOrFail();

        $roleRequest->user->roles()->syncWithoutDetaching([$role->id]);

        $roleRequest->update([
            'status' => 'approved',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permintaan berhasil disetujui.',
            'data' => $roleRequest->fresh(['user', 'reviewer']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Reject - Admin menolak permintaan
    |--------------------------------------------------------------------------
    */

    public function reject(Request $request, RoleRequest $roleRequest): JsonResponse
    {
        abort_if(
            $roleRequest->status !== 'pending',
            422,
            'Permintaan ini sudah diproses sebelumnya.'
        );

        $validated = $request->validate([
            'note' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $roleRequest->update([
            'status' => 'rejected',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'note' => $validated['note'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permintaan berhasil ditolak.',
            'data' => $roleRequest->fresh(['user', 'reviewer']),
        ]);
    }
}
