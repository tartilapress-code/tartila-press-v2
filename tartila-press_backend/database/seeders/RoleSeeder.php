<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'user',
                'display_name' => 'User',
                'description' => 'Pengguna umum Tartila Press.',
            ],
            [
                'name' => 'penulis',
                'display_name' => 'Penulis',
                'description' => 'Pengguna dengan akses penulis.',
            ],
            [
                'name' => 'editor',
                'display_name' => 'Editor',
                'description' => 'Pengguna dengan akses editor.',
            ],
            [
                'name' => 'admin',
                'display_name' => 'Administrator',
                'description' => 'Administrator sistem.',
            ],
            [
                'name' => 'owner',
                'display_name' => 'Owner',
                'description' => 'Pemilik sistem.',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}