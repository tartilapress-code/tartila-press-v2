<?php

namespace App\Http\Controllers\Api\V1\Profile;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Get authenticated user's private profile.
     */
    public function show(Request $request)
    {
        $user = $request->user()->load([
            'roles',
            'personalProfile',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Profile berhasil diambil.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'roles' => $user->roles->map(function ($role) {
                        return [
                            'name' => $role->name,
                            'display_name' => $role->display_name,
                        ];
                    })->values(),
                ],

                'profile' => $user->personalProfile,
            ],
        ]);
    }

    /**
     * Update authenticated user's private profile.
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'education_level' => [
                'sometimes',
                'nullable',
                Rule::in([
                    'SMA',
                    'S1',
                    'S2',
                    'S3',
                ]),
            ],

            'institution' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'age' => [
                'sometimes',
                'nullable',
                'integer',
                'min:13',
                'max:100',
            ],

            'gender' => [
                'sometimes',
                'nullable',
                Rule::in([
                    'male',
                    'female',
                ]),
            ],

            'occupation' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'nik' => [
                'sometimes',
                'nullable',
                'digits:16',
            ],

            'ktp_address' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'domicile_address' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'birth_place' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'birth_date' => [
                'sometimes',
                'nullable',
                'date',
            ],

            'phone' => [
                'sometimes',
                'nullable',
                'string',
                'max:20',
            ],
        ]);

        /*
        |--------------------------------------------------------------------------
        | Update User
        |--------------------------------------------------------------------------
        */

        if (array_key_exists('name', $validated)) {
            $user->update([
                'name' => $validated['name'],
            ]);
        }

        /*
        |--------------------------------------------------------------------------
        | Update Personal Profile
        |--------------------------------------------------------------------------
        */

        $profileData = collect($validated)
            ->except('name')
            ->toArray();

        if (! empty($profileData)) {
            $user->personalProfile()->updateOrCreate(
                [
                    'user_id' => $user->id,
                ],
                $profileData
            );
        }

        $user->load([
            'roles',
            'personalProfile',
        ]);

        AuditLog::record(
            $user->id,
            'profile_update',
            'success',
            $request,
            ['fields' => array_keys($validated)]
        );

        return response()->json([
            'success' => true,
            'message' => 'Profile berhasil diperbarui.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'roles' => $user->roles->map(function ($role) {
                        return [
                            'name' => $role->name,
                            'display_name' => $role->display_name,
                        ];
                    })->values(),
                ],

                'profile' => $user->personalProfile,
            ],
        ]);
    }
}
