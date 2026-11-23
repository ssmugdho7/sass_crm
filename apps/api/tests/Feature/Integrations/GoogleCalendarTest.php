<?php

namespace Tests\Feature\Integrations;

use App\Domains\Integrations\IntegrationsServiceProvider;
use App\Domains\Integrations\Models\CalendarEventLink;
use App\Domains\Integrations\Models\GoogleCalendarToken;
use App\Events\AppointmentSaved;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GoogleCalendarTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->register(IntegrationsServiceProvider::class);
        $this->tenant = Tenant::where('slug', 'demo-builders')->firstOrFail();
        TenantModule::withoutGlobalScope('tenant')->updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'module_key' => 'google_calendar'],
            ['status' => 'active', 'config' => ['client_id' => 'gcid-123.apps.googleusercontent.com', 'client_secret' => 'gsecret', 'calendar_id' => 'team@example.com']],
        );
    }

    private function state(array $override = []): string
    {
        $owner = User::where('email', 'owner@demo.test')->first();

        return Crypt::encryptString(json_encode(array_merge(['tenant_id' => $this->tenant->id, 'user_id' => $owner->id, 'exp' => now()->addMinutes(10)->timestamp], $override)));
    }

    private function connectToken(): void
    {
        $token = new GoogleCalendarToken;
        $token->forceFill(['tenant_id' => $this->tenant->id, 'access_token' => 'ya29.live', 'refresh_token' => 'r1', 'expires_at' => now()->addHour(), 'email' => 'me@gmail.com'])->save();
    }

    private function ensureAppointmentsTable(): void
    {
        if (! Schema::hasTable('appointments')) {
            Schema::create('appointments', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id');
                $t->string('title');
                $t->dateTime('starts_at');
                $t->dateTime('ends_at')->nullable();
                $t->string('location')->nullable();
                $t->text('notes')->nullable();
                $t->string('status')->default('scheduled');
                $t->timestamps();
            });
        }
    }

    public function test_connect_returns_oauth_url_with_client_id_and_state(): void
    {
        Sanctum::actingAs(User::where('email', 'owner@demo.test')->first());

        $url = $this->getJson('/api/app/integrations/google/connect')->assertOk()->json('url');
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', $url);
        parse_str(parse_url($url, PHP_URL_QUERY), $q);
        $this->assertSame('gcid-123.apps.googleusercontent.com', $q['client_id']);
        $this->assertSame('offline', $q['access_type']);
        $this->assertStringContainsString('calendar.events', $q['scope']);
        $this->assertSame($this->tenant->id, json_decode(Crypt::decryptString($q['state']), true)['tenant_id']);

        $this->getJson('/api/app/integrations/google/status')->assertOk()->assertJson(['connected' => false]);
    }

    public function test_connect_requires_credentials(): void
    {
        TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant->id)->where('module_key', 'google_calendar')->update(['config' => null]);
        Sanctum::actingAs(User::where('email', 'owner@demo.test')->first());
        $this->getJson('/api/app/integrations/google/connect')->assertStatus(422);
    }

    public function test_callback_stores_tokens_and_disconnect_removes_them(): void
    {
        $idToken = 'h.'.rtrim(strtr(base64_encode(json_encode(['email' => 'boss@gmail.com'])), '+/', '-_'), '=').'.s';
        Http::fake(['oauth2.googleapis.com/token' => Http::response([
            'access_token' => 'ya29.abc', 'refresh_token' => '1//refresh', 'expires_in' => 3599, 'id_token' => $idToken,
        ])]);

        $this->get('/api/public/google/callback?code=authcode&state='.urlencode($this->state()))
            ->assertRedirect('http://127.0.0.1:3000/app/addons/google_calendar?connected=1');

        $token = GoogleCalendarToken::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant->id)->first();
        $this->assertSame('ya29.abc', $token->access_token);
        $this->assertSame('1//refresh', $token->refresh_token);
        $this->assertSame('boss@gmail.com', $token->email);
        $this->assertNotSame('ya29.abc', DB::table('google_calendar_tokens')->value('access_token'));
        Http::assertSent(fn (Request $r) => $r['code'] === 'authcode' && $r['client_secret'] === 'gsecret'
            && $r['redirect_uri'] === url('/api/public/google/callback'));

        Sanctum::actingAs(User::where('email', 'owner@demo.test')->first());
        $this->getJson('/api/app/integrations/google/status')->assertJson(['connected' => true, 'email' => 'boss@gmail.com']);
        $this->deleteJson('/api/app/integrations/google/disconnect')->assertOk();
        $this->assertSame(0, GoogleCalendarToken::withoutGlobalScope('tenant')->count());
    }

    public function test_callback_rejects_expired_or_tampered_state(): void
    {
        Http::fake();
        $this->get('/api/public/google/callback?code=x&state='.urlencode($this->state(['exp' => time() - 5])))
            ->assertRedirect('http://127.0.0.1:3000/app/addons/google_calendar?error=1');
        $this->get('/api/public/google/callback?code=x&state=tampered')
            ->assertRedirect('http://127.0.0.1:3000/app/addons/google_calendar?error=1');
        Http::assertNothingSent();
    }

    public function test_listener_creates_updates_and_deletes_google_event(): void
    {
        $this->ensureAppointmentsTable();
        $this->connectToken();
        $id = DB::table('appointments')->insertGetId([
            'tenant_id' => $this->tenant->id, 'title' => 'Site visit', 'starts_at' => '2026-12-01 09:00:00',
            'ends_at' => '2026-12-01 10:00:00', 'location' => '12 Oak St', 'status' => 'scheduled',
        ]);
        $base = 'https://www.googleapis.com/calendar/v3/calendars/team%40example.com/events';
        Http::fake([
            $base => Http::response(['id' => 'gev_1']),
            $base.'/gev_1' => Http::response(['id' => 'gev_1']),
        ]);

        AppointmentSaved::dispatch($this->tenant->id, $id);
        $this->assertSame('gev_1', CalendarEventLink::withoutGlobalScope('tenant')->where('appointment_id', $id)->value('google_event_id'));
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && $r->url() === $base
            && $r['summary'] === 'Site visit' && $r->hasHeader('Authorization', 'Bearer ya29.live'));

        DB::table('appointments')->where('id', $id)->update(['title' => 'Site visit (moved)']);
        AppointmentSaved::dispatch($this->tenant->id, $id);
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && $r['summary'] === 'Site visit (moved)');
        $this->assertSame(1, CalendarEventLink::withoutGlobalScope('tenant')->count());

        DB::table('appointments')->where('id', $id)->update(['status' => 'cancelled']);
        AppointmentSaved::dispatch($this->tenant->id, $id);
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && $r->url() === $base.'/gev_1');
        $this->assertSame(0, CalendarEventLink::withoutGlobalScope('tenant')->count());
    }

    public function test_listener_swallows_failures_and_skips_when_not_connected(): void
    {
        Http::fake(['*' => Http::response(['error' => 'boom'], 500)]);
        AppointmentSaved::dispatch($this->tenant->id, 999); // not connected → no-op
        Http::assertNothingSent();

        $this->connectToken();
        $this->ensureAppointmentsTable();
        $id = DB::table('appointments')->insertGetId(['tenant_id' => $this->tenant->id, 'title' => 'X', 'starts_at' => '2026-12-01 09:00:00', 'ends_at' => '2026-12-01 10:00:00', 'status' => 'scheduled']);
        AppointmentSaved::dispatch($this->tenant->id, $id); // 500 from Google must not throw
        $this->assertSame(0, CalendarEventLink::withoutGlobalScope('tenant')->count());
    }
}
