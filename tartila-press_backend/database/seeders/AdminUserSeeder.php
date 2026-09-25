<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            [
                'email' => 'admin@tartilapress.test',
            ],
            [
                'name' => 'Admin Tartila Press',
                'password' => 'Tartila@2026',
                'email_verified_at' => now(),
            ]
        );

        $role = Role::where('name', 'admin')->first();

        if ($role) {
            $user->roles()->syncWithoutDetaching([
                $role->id,
            ]);
        }
    }
}
