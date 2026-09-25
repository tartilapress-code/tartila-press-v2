<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserManagementController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar seluruh user beserta roles-nya
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $users = User::with('roles')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar user berhasil diambil.',
            'data' => $users,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Update Roles - Admin mengatur ulang role seorang user
    |--------------------------------------------------------------------------
    */

    public function updateRoles(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'roles' => [
                'required',
                'array',
                'min:1',
            ],
            'roles.*' => [
                'string',
                'distinct',
                'exists:roles,name',
            ],
        ]);

        $roleIds = Role::whereIn('name', $validated['roles'])
            ->pluck('id');

        $user->roles()->sync($roleIds);

        return response()->json([
            'success' => true,
            'message' => 'Role user berhasil diperbarui.',
            'data' => $user->load('roles'),
        ]);
    }
}
