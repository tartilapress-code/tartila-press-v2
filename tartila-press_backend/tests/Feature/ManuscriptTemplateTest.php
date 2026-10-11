<?php

namespace Tests\Feature;

use App\Models\ManuscriptTemplate;
use App\Models\Role;
use App\Models\User;
use App\Support\ManuscriptTemplates\TemplateSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManuscriptTemplateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roles): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    public function test_only_admins_manage_templates(): void
    {
        Sanctum::actingAs($this->makeUser(['penulis']));

        $this->getJson('/api/v1/admin/manuscript-templates')->assertForbidden();
        $this->getJson('/api/v1/admin/manuscript-templates/meta')->assertForbidden();
        $this->postJson('/api/v1/admin/manuscript-templates', ['name' => 'X'])->assertForbidden();
    }

    public function test_meta_describes_every_layout_setting_in_eight_tabs(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $data = $this->getJson('/api/v1/admin/manuscript-templates/meta')->assertOk()->json('data');

        $this->assertSame(
            ['umum', 'tipografi', 'heading', 'headerfooter', 'visual', 'awal', 'isi', 'penutup'],
            array_keys($data['tabs'])
        );

        // Setiap topik yang diminta ada di skema.
        $paths = collect($data['groups'])->pluck('fields')->flatten(1)->pluck('path');
        foreach ([
            'page.format', 'margins.top_mm', 'gutter.width_mm', 'typography.body.font', 'paragraph.line_spacing',
            'pagination.format', 'header.enabled', 'footer.enabled', 'heading.h1.size_pt', 'paragraph.first_line_indent_mm',
            'paragraph.alignment', 'figures.max_width_percent', 'tables.border_style', 'figures.caption.position', 'drop_cap.enabled',
            'front_matter.cover.enabled', 'front_matter.title_page.enabled', 'front_matter.title_verso.enabled',
            'front_matter.preface.enabled', 'front_matter.toc.enabled', 'front_matter.list_of_figures.enabled',
            'front_matter.list_of_tables.enabled', 'body.order', 'back_matter.bibliography.enabled',
            'back_matter.appendix.enabled', 'back_matter.glossary.enabled', 'back_matter.index.enabled',
            'back_matter.author_bio.enabled',
        ] as $path) {
            $this->assertTrue($paths->contains($path), "Skema tidak punya $path");
        }

        $this->assertSame('A5', $data['defaults']['page']['format']);
        $this->assertSame(array_keys(TemplateSchema::FRONT_ITEMS), $data['defaults']['front_matter']['order']);
    }

    public function test_create_with_only_a_name_uses_the_defaults(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/manuscript-templates', ['name' => 'Template Novel'])
            ->assertCreated()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.config.page.format', 'A5')
            ->assertJsonPath('data.config.page.width_mm', 148)
            ->assertJsonPath('data.config.typography.body.size_pt', 11);

        $this->assertSame($admin->id, ManuscriptTemplate::find($response->json('data.id'))->created_by);
        $this->assertSame(TemplateSchema::defaults()['heading'], $response->json('data.config.heading'));
    }

    public function test_settings_are_validated_and_unknown_keys_dropped(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/manuscript-templates', ['name' => 'X', 'config' => ['margins' => ['top_mm' => 500]]])->assertStatus(422);
        $this->postJson('/api/v1/admin/manuscript-templates', ['name' => 'X', 'config' => ['typography' => ['body' => ['font' => 'Comic Sans']]]])->assertStatus(422);
        $this->postJson('/api/v1/admin/manuscript-templates', ['name' => 'X', 'config' => ['heading' => ['h1' => ['color' => 'red']]]])->assertStatus(422);
        $this->postJson('/api/v1/admin/manuscript-templates', ['name' => 'X', 'config' => ['paragraph' => ['alignment' => 'zigzag']]])->assertStatus(422);
        $this->postJson('/api/v1/admin/manuscript-templates', ['name' => ''])->assertStatus(422);

        $created = $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'Kustom',
            'config' => [
                'page' => ['format' => 'custom', 'width_mm' => 150, 'height_mm' => 225],
                'margins' => ['top_mm' => 25, 'mirror' => false],
                'paragraph' => ['line_spacing' => 1.5, 'alignment' => 'left'],
                'drop_cap' => ['enabled' => true, 'lines' => 4],
                'sembarang' => ['x' => 1],
            ],
        ])->assertCreated();

        $config = $created->json('data.config');
        $this->assertSame(150, $config['page']['width_mm']);
        $this->assertSame(25, $config['margins']['top_mm']);
        $this->assertFalse($config['margins']['mirror']);
        $this->assertSame(1.5, $config['paragraph']['line_spacing']);
        $this->assertTrue($config['drop_cap']['enabled']);
        $this->assertArrayNotHasKey('sembarang', $config);
    }

    public function test_standard_page_format_fills_width_and_height(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'B5', 'config' => ['page' => ['format' => 'B5', 'width_mm' => 999]],
        ])->assertStatus(422);

        $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'B5', 'config' => ['page' => ['format' => 'B5', 'width_mm' => 100, 'height_mm' => 100]],
        ])->assertCreated()
            ->assertJsonPath('data.config.page.width_mm', 176)
            ->assertJsonPath('data.config.page.height_mm', 250);
    }

    public function test_section_order_is_kept_as_a_complete_permutation(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $response = $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'Urutan',
            'config' => ['front_matter' => ['order' => ['toc', 'preface']], 'back_matter' => ['order' => ['index']]],
        ])->assertCreated();

        $front = $response->json('data.config.front_matter.order');
        $this->assertSame(['toc', 'preface'], array_slice($front, 0, 2));
        $this->assertEqualsCanonicalizing(array_keys(TemplateSchema::FRONT_ITEMS), $front);
        $this->assertSame('index', $response->json('data.config.back_matter.order.0'));

        $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'Salah', 'config' => ['front_matter' => ['order' => ['toc', 'toc']]],
        ])->assertStatus(422);
        $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'Salah', 'config' => ['front_matter' => ['order' => ['toc', 'rahasia']]],
        ])->assertStatus(422);
    }

    public function test_update_merges_partial_config_and_toggles_active(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $id = $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'Awal', 'config' => ['margins' => ['top_mm' => 30]],
        ])->json('data.id');

        $this->patchJson("/api/v1/admin/manuscript-templates/{$id}", [
            'name' => 'Baru',
            'is_active' => false,
            'config' => ['margins' => ['bottom_mm' => 15], 'header' => ['enabled' => false]],
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Baru')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.config.margins.top_mm', 30)
            ->assertJsonPath('data.config.margins.bottom_mm', 15)
            ->assertJsonPath('data.config.header.enabled', false)
            ->assertJsonPath('data.config.header.size_pt', 9);

        $this->patchJson("/api/v1/admin/manuscript-templates/{$id}", ['is_active' => true])
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.name', 'Baru');
    }

    public function test_duplicate_and_delete(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $id = $this->postJson('/api/v1/admin/manuscript-templates', [
            'name' => 'Asli', 'config' => ['gutter' => ['width_mm' => 9]],
        ])->json('data.id');

        $copy = $this->postJson("/api/v1/admin/manuscript-templates/{$id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.name', 'Asli (salinan)')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.config.gutter.width_mm', 9);

        // + template bawaan Embedded System yang dipasang lewat migrasi.
        $this->getJson('/api/v1/admin/manuscript-templates')->assertJsonCount(3, 'data');

        $this->deleteJson('/api/v1/admin/manuscript-templates/'.$copy->json('data.id'))->assertOk();
        $this->getJson('/api/v1/admin/manuscript-templates')->assertJsonCount(2, 'data');
        $this->getJson("/api/v1/admin/manuscript-templates/{$id}")->assertOk()->assertJsonPath('data.name', 'Asli');
    }
}
