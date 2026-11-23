<?php

namespace Tests\Feature\Integrations;

use App\Domains\Integrations\Listeners\SyncAppointmentToGoogle;
use App\Domains\Integrations\Models\CalendarEventLink;
use App\Domains\Integrations\Models\GoogleCalendarToken;
use App\Events\AppointmentSaved;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
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
        $this->tenant = Tenant::where('slug', 'demo-builders')->firstOrFail();
        TenantModule::withoutGlobalScope('tenant')->updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'module_key' => 'google_calendar'],
            ['status' => 'active', 'config' => ['client_id' => 'gcid-123.apps.googleusercontent.com', 'client_secret' => 'gsecret', 'calendar_id' => 'team@example.com']],
        );
    }

    /** Starts the OAuth flow as the owner and returns the opaque state nonce. */
    private function state(): string
    {
        Sanctum::actingAs(User::where('email', 'owner@demo.test')->first());
        parse_str(parse_url($this->getJson('/api/app/integrations/google/connect')->json('url'), PHP_URL_QUERY), $q);

        return $q['state'];
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
        $this->assertSame(48, strlen($q['state']));
        $this->assertSame($this->tenant->id, Cache::get('gcal_oauth:'.$q['state'])['tenant_id']);

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

    public function test_callback_rejects_unknown_reused_and_expired_state(): void
    {
        $error = 'http://127.0.0.1:3000/app/addons/google_calendar?error=1';
        $idToken = 'h.'.rtrim(strtr(base64_encode(json_encode(['email' => 'boss@gmail.com'])), '+/', '-_'), '=').'.s';
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.abc', 'expires_in' => 3599, 'id_token' => $idToken])]);

        $this->get('/api/public/google/callback?code=x&state=unknown')->assertRedirect($error);
        $this->get('/api/public/google/callback?code=x')->assertRedirect($error);
        Http::assertNothingSent();

        $state = $this->state();
        $this->get('/api/public/google/callback?code=x&state='.urlencode($state))
            ->assertRedirect('http://127.0.0.1:3000/app/addons/google_calendar?connected=1');
        // Single use: replaying the same state fails without another token exchange.
        $this->get('/api/public/google/callback?code=x&state='.urlencode($state))->assertRedirect($error);
        Http::assertSentCount(1);

        $expired = $this->state();
        $this->travel(11)->minutes();
        $this->get('/api/public/google/callback?code=x&state='.urlencode($expired))->assertRedirect($error);
        Http::assertSentCount(1);
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

    public function test_listener_is_queued_with_retries(): void
    {
        $listener = new SyncAppointmentToGoogle;
        $this->assertInstanceOf(ShouldQueueAfterCommit::class, $listener);
        $this->assertSame(3, $listener->tries);
        $this->assertSame([10, 60, 300], $listener->backoff);
    }

    public function test_listener_throws_on_google_failure_and_skips_when_not_connected(): void
    {
        Http::fake(['*' => Http::response(['error' => 'boom'], 500)]);
        AppointmentSaved::dispatch($this->tenant->id, 999); // not connected → no-op
        Http::assertNothingSent();

        $this->connectToken();
        $this->ensureAppointmentsTable();
        $id = DB::table('appointments')->insertGetId(['tenant_id' => $this->tenant->id, 'title' => 'X', 'starts_at' => '2026-12-01 09:00:00', 'ends_at' => '2026-12-01 10:00:00', 'status' => 'scheduled']);
        try {
            AppointmentSaved::dispatch($this->tenant->id, $id); // 500 from Google throws so the queue retries
            $this->fail('Expected the sync job to throw.');
        } catch (RequestException $e) {
            $this->assertSame(500, $e->response->status());
        }
        $this->assertSame(0, CalendarEventLink::withoutGlobalScope('tenant')->count());
    }

    public function test_no_job_queued_without_module_or_connection(): void
    {
        Queue::fake();
        $pushed = fn () => Queue::pushed(CallQueuedListener::class, fn ($job) => $job->class === SyncAppointmentToGoogle::class)->count();

        // Module active but not connected to Google.
        AppointmentSaved::dispatch($this->tenant->id, 1);
        $this->assertSame(0, $pushed());

        // Connected, but the add-on is not installed/active.
        $this->connectToken();
        TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant->id)->where('module_key', 'google_calendar')->delete();
        AppointmentSaved::dispatch(Tenant::find($this->tenant->id)->id, 1);
        $this->assertSame(0, $pushed());
        Queue::assertNotPushed(CallQueuedListener::class, fn ($job) => $job->class === SyncAppointmentToGoogle::class);
    }

    public function test_job_queued_when_connected_and_deletes_need_a_link(): void
    {
        Queue::fake();
        $this->connectToken();
        $pushed = fn () => Queue::pushed(CallQueuedListener::class, fn ($job) => $job->class === SyncAppointmentToGoogle::class)->count();

        AppointmentSaved::dispatch($this->tenant->id, 1);
        $this->assertSame(1, $pushed());

        AppointmentSaved::dispatch($this->tenant->id, 1, true); // no linked event → nothing to delete
        $this->assertSame(1, $pushed());

        $link = new CalendarEventLink;
        $link->forceFill(['tenant_id' => $this->tenant->id, 'appointment_id' => 1, 'google_event_id' => 'gev_x'])->save();
        AppointmentSaved::dispatch($this->tenant->id, 1, true);
        $this->assertSame(2, $pushed());
    }
}
