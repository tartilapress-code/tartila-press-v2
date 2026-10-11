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

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?search= (nama/email), ?role=<nama peran>.
        $query = User::with('roles')->orderBy('name')->orderBy('id');

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower((string) $request->query('search')).'%';

            $query->where(fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(email) LIKE ?', [$term]));
        }

        if ($request->filled('role')) {
            $query->whereHas('roles', fn ($role) => $role->where('name', $request->query('role')));
        }

        return $this->pageResponse($query->paginate($this->perPage($request, 20)), 'Daftar user berhasil diambil.');
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
