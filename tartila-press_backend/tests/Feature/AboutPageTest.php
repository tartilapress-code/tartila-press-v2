<?php

namespace Tests\Feature;

use App\Models\AboutLegality;
use App\Models\AboutProfile;
use App\Models\AboutTeamMember;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Halaman "Tentang Kami": isi profil, legalitas, Tim Kami (urutan & tampil/sembunyi). */
class AboutPageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'Tartila@2026']);
        $this->admin->roles()->attach(Role::where('name', 'admin')->value('id'));
    }

    public function test_public_page_starts_with_the_footer_contacts(): void
    {
        $this->getJson('/api/v1/about')
            ->assertOk()
            ->assertJsonPath('data.profile.contact_email', 'tartilapress@gmail.com')
            ->assertJsonPath('data.profile.whatsapp', '6283180773955')
            ->assertJsonPath('data.profile.social_links.instagram', 'https://instagram.com')
            ->assertJsonPath('data.legalities', [])
            ->assertJsonPath('data.team', []);
    }

    public function test_admin_edits_profile_and_social_links(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = [
            'vision' => 'Menjadi penerbit ilmiah terpercaya.',
            'mission' => "Menerbitkan karya bermutu\nMendampingi penulis",
            'profile' => 'Tartila Press berdiri sejak 2020.',
            'contact_email' => 'halo@tartila.test',
            'phone' => '+62 812-0000-0000',
            'whatsapp' => '6281200000000',
            'address' => 'Jl. Contoh No. 1, Padang',
            'map_query' => '',
            'social_links' => ['instagram' => 'https://instagram.com/tartila', 'facebook' => '', 'x' => 'https://x.com/tartila', 'mastodon' => 'https://evil.test'],
            'show_team' => true,
        ];

        $this->putJson('/api/v1/admin/about', $payload)
            ->assertOk()
            ->assertJsonPath('data.profile.vision', 'Menjadi penerbit ilmiah terpercaya.');

        $this->assertSame(['instagram' => 'https://instagram.com/tartila', 'x' => 'https://x.com/tartila'], AboutProfile::current()->social_links);

        $this->getJson('/api/v1/about')
            ->assertJsonPath('data.profile.social_links', ['instagram' => 'https://instagram.com/tartila', 'x' => 'https://x.com/tartila'])
            ->assertJsonPath('data.profile.contact_email', 'halo@tartila.test')
            ->assertJsonMissingPath('data.profile.updated_by');

        $this->putJson('/api/v1/admin/about', [...$payload, 'social_links' => ['instagram' => 'javascript:alert(1)']])
            ->assertJsonValidationErrors('social_links.instagram');
        $this->putJson('/api/v1/admin/about', [...$payload, 'whatsapp' => '+62 812'])
            ->assertJsonValidationErrors('whatsapp');
    }

    public function test_legalities_and_team_are_ordered_and_hidden_members_stay_private(): void
    {
        Sanctum::actingAs($this->admin);

        foreach (['NIB', 'Akta Pendirian', 'SK Kemenkumham', 'NPWP'] as $name) {
            $this->postJson('/api/v1/admin/about/legalities', ['name' => $name, 'description' => "Dokumen $name", 'image_url' => 'https://example.com/'.urlencode($name).'.jpg'])
                ->assertCreated();
        }
        $this->postJson('/api/v1/admin/about/legalities', ['name' => 'X', 'image_url' => 'data:image/png;base64,AAAA'])
            ->assertJsonValidationErrors('image_url');

        $ids = AboutLegality::ordered()->pluck('id')->all();
        $this->putJson('/api/v1/admin/about/legalities/order', ['ids' => array_reverse($ids)])->assertOk();
        $this->putJson('/api/v1/admin/about/legalities/order', ['ids' => [$ids[0]]])->assertUnprocessable();

        $ani = $this->postJson('/api/v1/admin/about/team', ['name' => 'Ani', 'position' => 'Direktur', 'expertise' => 'Penerbitan', 'is_visible' => true])->assertCreated();
        $this->postJson('/api/v1/admin/about/team', ['name' => 'Budi', 'position' => 'Editor', 'is_visible' => false])->assertCreated();
        $this->postJson('/api/v1/admin/about/team', ['name' => 'Citra', 'position' => 'Layouter', 'is_visible' => true])->assertCreated();

        $members = AboutTeamMember::ordered()->pluck('id', 'name');
        $this->putJson('/api/v1/admin/about/team/order', ['ids' => [$members['Citra'], $members['Budi'], $members['Ani']]])->assertOk();

        $public = $this->getJson('/api/v1/about')->assertOk();
        $this->assertSame(['NPWP', 'SK Kemenkumham', 'Akta Pendirian', 'NIB'], array_column($public->json('data.legalities'), 'name'));
        $this->assertSame(['Citra', 'Ani'], array_column($public->json('data.team'), 'name'));
        $this->assertArrayNotHasKey('is_visible', $public->json('data.team.0'));

        // Admin melihat semua, termasuk yang disembunyikan.
        $this->assertSame(['Citra', 'Budi', 'Ani'], array_column($this->getJson('/api/v1/admin/about')->json('data.team'), 'name'));

        // Bagian tim bisa dimatikan seluruhnya.
        AboutProfile::current()->update(['show_team' => false]);
        $this->getJson('/api/v1/about')->assertJsonPath('data.team', []);

        $this->deleteJson('/api/v1/admin/about/team/'.$members['Budi'])->assertOk();
        $this->deleteJson('/api/v1/admin/about/legalities/'.$ids[0])->assertOk();
        $this->assertSame(2, AboutTeamMember::count());
        $this->assertSame(3, AboutLegality::count());
    }

    public function test_only_admin_can_manage(): void
    {
        $user = User::create(['name' => 'Biasa', 'email' => 'biasa@example.com', 'password' => 'Tartila@2026']);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/about')->assertForbidden();
        $this->putJson('/api/v1/admin/about', ['show_team' => true])->assertForbidden();
        $this->postJson('/api/v1/admin/about/team', ['name' => 'X', 'is_visible' => true])->assertForbidden();
    }
}
