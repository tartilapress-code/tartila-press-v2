<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\FieldCategory;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Data poster promosi Book Chapter (Konten Sosmed admin & "Promosikan Projek" editor). */
class BookChapterPromoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roles, string $name = 'Penguji'): User
    {
        $user = User::create(['name' => $name, 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function makeProject(User $creator, bool $byEditor): Book
    {
        $field = FieldCategory::create(['name' => 'Komputer']);
        $project = Book::create([
            'title' => 'Kecerdasan Buatan untuk Pendidikan',
            'price' => 150000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_offering' => true,
            'is_editor_created' => $byEditor,
            'field_category_id' => $field->id,
            'created_by' => $creator->id,
        ]);

        foreach (['Pengantar AI', 'AI di Kelas', 'Etika AI'] as $index => $title) {
            BookChapter::create(['book_id' => $project->id, 'chapter_number' => $index + 1, 'title' => $title]);
        }

        return $project;
    }

    public function test_admin_promo_returns_the_latest_slot_data(): void
    {
        $admin = $this->makeUser(['admin']);
        $project = $this->makeProject($admin, false);
        Sanctum::actingAs($admin);

        $this->getJson("/api/v1/admin/book-chapter-projects/{$project->id}/promo")->assertOk()
            ->assertJsonPath('data.title', 'Kecerdasan Buatan untuk Pendidikan')
            ->assertJsonPath('data.field', 'Komputer')
            ->assertJsonPath('data.chapters.1.title', 'AI di Kelas')
            ->assertJsonPath('data.open_slots', 3)
            ->assertJsonPath('data.total_slots', 3);

        // Slot dipesan -> unduhan berikutnya memakai jumlah terbaru.
        $order = Order::create(['order_number' => 'ORD-1', 'user_id' => $admin->id, 'status' => 'pending', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        $project->chapters()->where('chapter_number', 2)->update(['order_id' => $order->id]);

        $this->getJson("/api/v1/admin/book-chapter-projects/{$project->id}/promo")
            ->assertJsonPath('data.open_slots', 2)
            ->assertJsonPath('data.chapters.1.open', false);

        Sanctum::actingAs($this->makeUser(['user']));
        $this->getJson("/api/v1/admin/book-chapter-projects/{$project->id}/promo")->assertForbidden();
    }

    public function test_editor_can_promote_only_own_project_with_their_name(): void
    {
        $editor = $this->makeUser(['editor'], 'Dr. Rahma');
        $project = $this->makeProject($editor, true);

        Sanctum::actingAs($editor);
        $this->getJson("/api/v1/editor/book-chapter-projects/{$project->id}/promo")->assertOk()
            ->assertJsonPath('data.editor_name', 'Dr. Rahma')
            ->assertJsonPath('data.open_slots', 3);

        Sanctum::actingAs($this->makeUser(['editor'], 'Editor Lain'));
        $this->getJson("/api/v1/editor/book-chapter-projects/{$project->id}/promo")->assertForbidden();
    }
}
