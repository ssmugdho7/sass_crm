<?php

namespace Tests\Feature\Website;

use App\Domains\Identity\Actions\RegisterTenant;
use App\Domains\Website\Database\DemoSeeder;
use App\Domains\Website\Models\SiteService;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WebsiteTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private function owner(): User
    {
        return User::where('email', 'owner@demo.test')->firstOrFail();
    }

    private function otherOwner(): User
    {
        return app(RegisterTenant::class)(['company' => 'Rival Roofing', 'name' => 'Rita', 'email' => 'rita@rival.test', 'password' => 'secret123', 'plan' => 'starter'])->fresh();
    }

    private function actAs(User $user): void
    {
        CurrentTenant::set(null);
        Sanctum::actingAs($user);
    }

    public function test_settings_are_created_with_defaults_and_can_be_updated(): void
    {
        $this->actAs($this->owner());
        $this->getJson('/api/app/website/settings')->assertOk()
            ->assertJsonPath('published', true)
            ->assertJsonPath('about_title', 'About Demo Builders');

        $this->putJson('/api/app/website/settings', [
            'hero_title' => 'Build better', 'theme_color' => '#112233', 'service_areas' => ['Austin', ' ', 'Dallas'],
            'social' => ['facebook' => 'https://facebook.com/x'],
        ])->assertOk()->assertJsonPath('hero_title', 'Build better')
            ->assertJsonPath('service_areas', ['Austin', 'Dallas'])
            ->assertJsonPath('social.instagram', null);

        $this->putJson('/api/app/website/settings', ['theme_color' => 'red'])->assertStatus(422);
    }

    public function test_public_site_is_isolated_per_tenant_and_respects_publish_toggle(): void
    {
        $this->actAs($this->owner());
        $this->postJson('/api/app/website/services', ['title' => 'Demo Kitchens'])->assertCreated();
        $this->postJson('/api/app/website/services', ['title' => 'Hidden draft', 'is_published' => false])->assertCreated();

        $this->actAs($this->otherOwner());
        $this->postJson('/api/app/website/services', ['title' => 'Rival Roofs'])->assertCreated();
        CurrentTenant::set(null);

        $res = $this->getJson('/api/public/sites/demo-builders')->assertOk()
            ->assertJsonPath('tenant.name', 'Demo Builders')
            ->assertJsonPath('features.booking', true); // growth plan includes appointments
        $titles = collect($res->json('services'))->pluck('title');
        $this->assertContains('Demo Kitchens', $titles);
        $this->assertNotContains('Rival Roofs', $titles);
        $this->assertNotContains('Hidden draft', $titles);
        $this->assertArrayNotHasKey('tenant_id', $res->json('services.0'));

        $this->getJson('/api/public/sites/rival-roofing')->assertOk()
            ->assertJsonPath('services.0.title', 'Rival Roofs')->assertJsonPath('features.booking', false);
        $this->getJson('/api/public/sites/nope')->assertNotFound();

        $this->actAs($this->owner());
        $this->putJson('/api/app/website/settings', ['published' => false])->assertOk();
        CurrentTenant::set(null);
        $this->getJson('/api/public/sites/demo-builders')->assertNotFound();

        Tenant::where('slug', 'rival-roofing')->update(['status' => 'suspended']);
        $this->getJson('/api/public/sites/rival-roofing')->assertNotFound();
    }

    public function test_lead_capture_creates_website_lead_and_honeypot_blocks_bots(): void
    {
        $this->postJson('/api/public/sites/demo-builders/leads', [
            'name' => 'Jane Client', 'email' => 'jane@example.test', 'service' => 'Kitchen remodel', 'message' => 'Need a quote',
        ])->assertCreated();

        $lead = Lead::withoutGlobalScope('tenant')->where('email', 'jane@example.test')->firstOrFail();
        $this->assertSame('website', $lead->source);
        $this->assertSame(Tenant::where('slug', 'demo-builders')->value('id'), $lead->tenant_id);

        $this->postJson('/api/public/sites/demo-builders/leads', ['name' => 'Bot', 'email' => 'bot@spam.test', 'website' => 'http://spam'])
            ->assertStatus(422);
        $this->postJson('/api/public/sites/demo-builders/leads', ['name' => 'No contact'])->assertStatus(422);
        $this->assertFalse(Lead::withoutGlobalScope('tenant')->where('email', 'bot@spam.test')->exists());
        $this->postJson('/api/public/sites/unknown/leads', ['name' => 'X', 'email' => 'x@x.test'])->assertNotFound();
    }

    public function test_checklist_grows_as_content_is_added(): void
    {
        $this->actAs($this->owner());
        $before = $this->getJson('/api/app/website/checklist')->assertOk()->json();
        $this->assertFalse(collect($before['items'])->firstWhere('key', 'services')['done']);

        foreach (['A', 'B', 'C'] as $t) {
            $this->postJson('/api/app/website/services', ['title' => "Service $t"])->assertCreated();
        }
        $this->postJson('/api/app/website/testimonials', ['author' => 'Ann', 'quote' => 'Great', 'rating' => 5])->assertCreated();

        $after = $this->getJson('/api/app/website/checklist')->json();
        $this->assertTrue(collect($after['items'])->firstWhere('key', 'services')['done']);
        $this->assertTrue(collect($after['items'])->firstWhere('key', 'testimonial')['done']);
        $this->assertGreaterThan($before['percent'], $after['percent']);
    }

    public function test_tenant_cannot_edit_another_tenants_content(): void
    {
        $this->actAs($this->owner());
        $id = $this->postJson('/api/app/website/services', ['title' => 'Mine'])->json('id');

        $this->actAs($this->otherOwner());
        $this->putJson("/api/app/website/services/{$id}", ['title' => 'Hacked'])->assertNotFound();
        $this->deleteJson("/api/app/website/services/{$id}")->assertNotFound();
        $this->getJson('/api/app/website/services')->assertOk()->assertJsonCount(0);
        $this->postJson('/api/app/website/services/reorder', ['ids' => [$id]])->assertOk();

        $this->assertSame('Mine', SiteService::withoutGlobalScope('tenant')->find($id)->title);
    }

    public function test_crud_reorder_upload_and_import_from_project(): void
    {
        Storage::fake('public');
        $this->actAs($this->owner());
        $a = $this->postJson('/api/app/website/faqs', ['question' => 'Q1?', 'answer' => 'A1'])->json('id');
        $b = $this->postJson('/api/app/website/faqs', ['question' => 'Q2?', 'answer' => 'A2'])->json('id');
        $this->postJson('/api/app/website/faqs/reorder', ['ids' => [$b, $a]])->assertOk()->assertJsonPath('0.id', $b);
        $this->deleteJson("/api/app/website/faqs/{$a}")->assertNoContent();

        $url = $this->post('/api/app/website/upload', ['file' => UploadedFile::fake()->image('logo.png')], ['Accept' => 'application/json'])
            ->assertCreated()->json('url');
        $this->assertStringContainsString('/storage/sites/', $url);
        $this->post('/api/app/website/upload', ['file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $tenantId = $this->owner()->tenant_id;
        $open = Project::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $tenantId, 'name' => 'Open job', 'status' => 'in_progress']);
        $done = Project::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $tenantId, 'name' => 'Deck build', 'status' => 'completed', 'site_address' => '1 Main St, Austin, TX']);

        $this->postJson("/api/app/website/portfolio/from-project/{$open->id}")->assertStatus(422);
        $this->postJson("/api/app/website/portfolio/from-project/{$done->id}")->assertCreated()
            ->assertJsonPath('title', 'Deck build')->assertJsonPath('location', 'Austin, TX')
            ->assertJsonPath('project_id', $done->id)->assertJsonPath('is_published', false);
        $this->postJson("/api/app/website/portfolio/from-project/{$done->id}")->assertStatus(422);

        $other = $this->otherOwner();
        $foreign = Project::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $other->tenant_id, 'name' => 'Theirs', 'status' => 'completed']);
        $this->postJson("/api/app/website/portfolio/from-project/{$foreign->id}")->assertNotFound();
    }

    public function test_demo_seeder_is_idempotent(): void
    {
        $this->seed(DemoSeeder::class);
        $this->seed(DemoSeeder::class);
        CurrentTenant::set(null);
        $res = $this->getJson('/api/public/sites/demo-builders')->assertOk();
        $this->assertCount(6, $res->json('services'));
        $this->assertCount(5, $res->json('portfolio'));
    }
}
