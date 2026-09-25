<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\FieldCategory;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ArticleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create([
                'name' => $name,
                'display_name' => ucfirst($name),
            ]);
        }
    }

    private function makeUser(array $roleNames = ['user']): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $roleIds = Role::whereIn('name', $roleNames)->pluck('id');
        $user->roles()->attach($roleIds);

        return $user;
    }

    private function makeArticle(User $author, string $status = 'approved', array $overrides = []): Article
    {
        $field = FieldCategory::create(['name' => 'Bidang '.uniqid()]);

        return Article::create([
            'user_id' => $author->id,
            'title' => $overrides['title'] ?? 'Artikel Uji '.uniqid(),
            'field_category_id' => $field->id,
            'body' => 'Isi essay uji coba yang cukup panjang untuk dites.',
            'status' => $status,
            'published_at' => $status === 'approved' ? now() : null,
            ...$overrides,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Submit & Approval Workflow
    |--------------------------------------------------------------------------
    */

    public function test_any_authenticated_user_can_submit_an_article(): void
    {
        $user = $this->makeUser(['user']);
        $field = FieldCategory::create(['name' => 'Teknologi']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/articles', [
            'title' => 'Judul Artikel Pertama',
            'field_category_id' => $field->id,
            'body' => 'Ini adalah isi essay yang panjang untuk artikel pertama saya.',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'pending');
        $this->assertDatabaseHas('articles', [
            'title' => 'Judul Artikel Pertama',
            'user_id' => $user->id,
            'status' => 'pending',
        ]);
    }

    public function test_pending_article_does_not_appear_in_public_index(): void
    {
        $author = $this->makeUser();
        $this->makeArticle($author, 'pending');

        $response = $this->getJson('/api/v1/articles');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data'));
    }

    public function test_admin_approve_makes_article_public_and_sets_published_at(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'pending');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson("/api/v1/admin/articles/{$article->id}/approve");
        $response->assertStatus(200);

        $article->refresh();
        $this->assertSame('approved', $article->status);
        $this->assertNotNull($article->published_at);

        $index = $this->getJson('/api/v1/articles');
        $titles = collect($index->json('data'))->pluck('title');
        $this->assertTrue($titles->contains($article->title));
    }

    public function test_admin_reject_keeps_article_hidden(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'pending');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/articles/{$article->id}/reject")
            ->assertStatus(200);

        $article->refresh();
        $this->assertSame('rejected', $article->status);
        $this->assertNull($article->published_at);

        $index = $this->getJson('/api/v1/articles');
        $titles = collect($index->json('data'))->pluck('title');
        $this->assertFalse($titles->contains($article->title));
    }

    public function test_cannot_approve_or_reject_an_already_processed_article(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'approved');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/articles/{$article->id}/approve")
            ->assertStatus(422);
        $this->postJson("/api/v1/admin/articles/{$article->id}/reject")
            ->assertStatus(422);
    }

    public function test_non_admin_cannot_approve_articles(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'pending');

        $stranger = $this->makeUser();
        Sanctum::actingAs($stranger);

        $this->postJson("/api/v1/admin/articles/{$article->id}/approve")
            ->assertStatus(403);
    }

    public function test_mine_lists_own_articles_regardless_of_status(): void
    {
        $author = $this->makeUser();
        $this->makeArticle($author, 'pending', ['title' => 'Punya Saya Pending']);
        $this->makeArticle($author, 'approved', ['title' => 'Punya Saya Approved']);
        $other = $this->makeUser();
        $this->makeArticle($other, 'approved', ['title' => 'Punya Orang Lain']);

        Sanctum::actingAs($author);
        $response = $this->getJson('/api/v1/articles/mine');

        $titles = collect($response->json('data'))->pluck('title');
        $this->assertTrue($titles->contains('Punya Saya Pending'));
        $this->assertTrue($titles->contains('Punya Saya Approved'));
        $this->assertFalse($titles->contains('Punya Orang Lain'));
    }

    /*
    |--------------------------------------------------------------------------
    | Likes
    |--------------------------------------------------------------------------
    */

    public function test_user_can_like_and_unlike_an_article(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'approved');

        $liker = $this->makeUser();
        Sanctum::actingAs($liker);

        $like = $this->postJson("/api/v1/articles/{$article->slug}/like");
        $like->assertStatus(201);
        $like->assertJsonPath('data.likes_count', 1);
        $like->assertJsonPath('data.liked_by_me', true);

        $show = $this->getJson("/api/v1/articles/{$article->slug}");
        $show->assertJsonPath('data.likes_count', 1);

        $unlike = $this->deleteJson("/api/v1/articles/{$article->slug}/like");
        $unlike->assertStatus(200);
        $unlike->assertJsonPath('data.likes_count', 0);
        $unlike->assertJsonPath('data.liked_by_me', false);
    }

    public function test_liking_twice_does_not_duplicate(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'approved');

        $liker = $this->makeUser();
        Sanctum::actingAs($liker);

        $this->postJson("/api/v1/articles/{$article->slug}/like");
        $this->postJson("/api/v1/articles/{$article->slug}/like");

        $this->assertSame(1, $article->likes()->count());
    }

    public function test_guest_sees_liked_by_me_false(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'approved');

        $response = $this->getJson("/api/v1/articles/{$article->slug}");

        $response->assertJsonPath('data.liked_by_me', false);
    }

    /*
    |--------------------------------------------------------------------------
    | Comments
    |--------------------------------------------------------------------------
    */

    public function test_authenticated_user_can_comment_and_delete_own_comment(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'approved');

        $commenter = $this->makeUser();
        Sanctum::actingAs($commenter);

        $store = $this->postJson("/api/v1/articles/{$article->slug}/comments", [
            'body' => 'Artikel yang bagus!',
        ]);
        $store->assertStatus(201);
        $commentId = $store->json('data.id');

        $index = $this->getJson("/api/v1/articles/{$article->slug}/comments");
        $this->assertCount(1, $index->json('data'));

        $this->deleteJson("/api/v1/articles/{$article->slug}/comments/{$commentId}")
            ->assertStatus(200);

        $index = $this->getJson("/api/v1/articles/{$article->slug}/comments");
        $this->assertCount(0, $index->json('data'));
    }

    public function test_user_cannot_delete_someone_elses_comment(): void
    {
        $author = $this->makeUser();
        $article = $this->makeArticle($author, 'approved');

        $commenter = $this->makeUser();
        Sanctum::actingAs($commenter);
        $comment = $this->postJson("/api/v1/articles/{$article->slug}/comments", [
            'body' => 'Komentar asli',
        ])->json('data');

        $stranger = $this->makeUser();
        Sanctum::actingAs($stranger);

        $this->deleteJson("/api/v1/articles/{$article->slug}/comments/{$comment['id']}")
            ->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | City dari PublicProfile
    |--------------------------------------------------------------------------
    */

    public function test_author_city_from_public_profile_is_exposed_on_article(): void
    {
        $author = $this->makeUser(['penulis']);
        PublicProfile::create([
            'user_id' => $author->id,
            'slug' => 'penulis-kota-uji',
            'pen_name' => $author->name,
            'city' => 'Bandung',
            'is_published' => true,
        ]);
        $article = $this->makeArticle($author, 'approved');

        $response = $this->getJson("/api/v1/articles/{$article->slug}");

        $response->assertJsonPath('data.user.public_profile.city', 'Bandung');
    }
}
