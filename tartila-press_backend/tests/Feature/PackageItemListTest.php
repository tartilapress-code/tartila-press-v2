<?php

namespace Tests\Feature;

use App\Models\CustomPackageItem;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Fasilitas/layanan paket dipilih dari daftar Item Custom (bukan diketik ulang). */
class PackageItemListTest extends TestCase
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
        $this->admin->roles()->attach(Role::whereIn('name', ['user', 'admin'])->pluck('id'));

        CustomPackageItem::create(['type' => 'service', 'name' => 'Pengajuan HKI', 'price' => 220000]);
        CustomPackageItem::create(['type' => 'service', 'name' => 'Editing', 'price' => 300000]);
        CustomPackageItem::create(['type' => 'facility', 'name' => 'Cover Premium', 'price' => 0]);
    }

    private function payload(array $extra = []): array
    {
        return ['name' => 'Paket Uji', 'isbn_prices' => ['print' => 1000000]] + $extra;
    }

    public function test_package_accepts_names_from_the_custom_item_list(): void
    {
        Sanctum::actingAs($this->admin);

        $created = $this->postJson('/api/v1/admin/packages', $this->payload([
            'services' => ['Editing', 'Pengajuan HKI'],
            'facilities' => ['Cover Premium'],
        ]))->assertCreated();

        $package = Package::findOrFail($created->json('data.id'));
        $this->assertSame(['Editing', 'Pengajuan HKI'], $package->services);
        $this->assertSame(['Cover Premium'], $package->facilities);
    }

    public function test_package_rejects_free_text_that_is_not_a_custom_item(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/v1/admin/packages', $this->payload(['services' => ['Layanan ketikan sendiri']]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['services.0']);

        $this->postJson('/api/v1/admin/packages', $this->payload(['facilities' => ['Editing']]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['facilities.0']);   // jenisnya layanan, bukan fasilitas

        $this->assertSame(0, Package::count());
    }

    public function test_legacy_free_text_already_on_the_package_can_stay_until_the_admin_removes_it(): void
    {
        $package = Package::create([
            'name' => 'Paket Lama', 'price' => 500000, 'created_by' => $this->admin->id,
            'services' => ['Layanan lama bebas'], 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);

        // Disimpan ulang dengan nilai lama + satu item baru dari daftar: tidak ditolak.
        $this->patchJson("/api/v1/admin/packages/{$package->id}", ['services' => ['Layanan lama bebas', 'Editing']])->assertOk();
        $this->assertSame(['Layanan lama bebas', 'Editing'], $package->fresh()->services);

        // Teks bebas BARU tetap ditolak.
        $this->patchJson("/api/v1/admin/packages/{$package->id}", ['services' => ['Layanan lama bebas', 'Baru bebas']])
            ->assertStatus(422);

        // Admin boleh membuang nilai lama.
        $this->patchJson("/api/v1/admin/packages/{$package->id}", ['services' => ['Editing']])->assertOk();
        $this->assertSame(['Editing'], $package->fresh()->services);
    }

    public function test_renaming_a_custom_item_renames_it_in_every_package(): void
    {
        Sanctum::actingAs($this->admin);

        $hki = CustomPackageItem::where('name', 'Pengajuan HKI')->firstOrFail();
        $a = Package::create(['name' => 'A', 'price' => 1, 'services' => ['Editing', 'Pengajuan HKI'], 'created_by' => $this->admin->id]);
        $b = Package::create(['name' => 'B', 'price' => 1, 'services' => ['Editing'], 'facilities' => ['Pengajuan HKI'], 'created_by' => $this->admin->id]);

        $this->patchJson("/api/v1/admin/custom-package-items/{$hki->id}", ['name' => 'Pendaftaran HAKI'])->assertOk();

        $this->assertSame(['Editing', 'Pendaftaran HAKI'], $a->fresh()->services);
        $this->assertSame(['Editing'], $b->fresh()->services);
        // Nama yang sama di jenis lain (fasilitas) tidak ikut diganti.
        $this->assertSame(['Pengajuan HKI'], $b->fresh()->facilities);
    }

    public function test_hki_is_still_detected_from_the_chosen_item_names(): void
    {
        Sanctum::actingAs($this->admin);

        $id = $this->postJson('/api/v1/admin/packages', $this->payload(['services' => ['Pengajuan HKI']]))
            ->assertCreated()->json('data.id');

        $this->assertTrue((bool) preg_match('/\bha?ki\b/i', implode(' ', Package::findOrFail($id)->services)));
    }
}
