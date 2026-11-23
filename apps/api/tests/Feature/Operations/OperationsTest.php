<?php

namespace Tests\Feature\Operations;

use App\Domains\Identity\Actions\RegisterTenant;
use App\Domains\Operations\Database\DemoSeeder;
use App\Domains\Operations\Models\Appointment;
use App\Events\AppointmentSaved;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Role;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationsTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private const MODULES = ['appointments', 'subcontractors', 'timesheets', 'expenses'];

    private function owner(string $company = 'Ops Co', bool $install = true): User
    {
        $user = app(RegisterTenant::class)([
            'company' => $company, 'name' => 'Owner', 'email' => strtolower(str_replace(' ', '', $company)).'@test.test',
            'password' => 'password', 'plan' => 'starter',
        ]);
        if ($install) {
            foreach (self::MODULES as $key) {
                TenantModule::withoutGlobalScope('tenant')->firstOrCreate(['tenant_id' => $user->tenant_id, 'module_key' => $key]);
            }
        }

        return $user->fresh();
    }

    private function project(User $user, array $attrs = []): Project
    {
        $p = new Project(array_merge(['name' => 'Job', 'budget' => 1_000_000], $attrs));
        $p->tenant_id = $user->tenant_id;
        $p->save();

        return $p;
    }

    private function crew(User $owner): User
    {
        $role = Role::where('tenant_id', $owner->tenant_id)->where('slug', 'field-crew')->first();

        return User::create(['tenant_id' => $owner->tenant_id, 'role_id' => $role->id, 'name' => 'Crew', 'email' => 'crew'.$owner->tenant_id.'@test.test', 'password' => 'password'])->fresh();
    }

    public function test_tenant_without_addons_gets_403(): void
    {
        Sanctum::actingAs($this->owner('Plain Co', false));
        foreach (['/api/app/appointments', '/api/app/subcontractors', '/api/app/timesheets', '/api/app/expenses'] as $url) {
            $this->getJson($url)->assertForbidden();
        }
    }

    public function test_appointment_crud_range_and_events(): void
    {
        Event::fake([AppointmentSaved::class]);
        $user = $this->owner();
        Sanctum::actingAs($user);

        $id = $this->postJson('/api/app/appointments', [
            'title' => 'Site visit', 'starts_at' => '2026-12-01 09:00', 'ends_at' => '2026-12-01 10:00', 'status' => 'confirmed',
        ])->assertCreated()->assertJsonPath('source', 'manual')->json('id');
        $this->postJson('/api/app/appointments', ['title' => 'Later', 'starts_at' => '2027-02-01 09:00', 'ends_at' => '2027-02-01 10:00'])->assertCreated();

        $this->getJson('/api/app/appointments?from=2026-11-30&to=2026-12-07')->assertOk()->assertJsonCount(1, 'data');
        $this->patchJson("/api/app/appointments/{$id}", ['status' => 'completed'])->assertOk()->assertJsonPath('status', 'completed');
        $this->deleteJson("/api/app/appointments/{$id}")->assertNoContent();

        Event::assertDispatched(AppointmentSaved::class, fn ($e) => $e->appointmentId === $id && $e->deleted);
        Event::assertDispatchedTimes(AppointmentSaved::class, 4);
    }

    public function test_public_booking_creates_lead_and_appointment(): void
    {
        Event::fake([AppointmentSaved::class]);
        $user = $this->owner();
        $slug = $user->tenant->slug;

        $this->postJson("/api/public/sites/{$slug}/bookings", [
            'name' => 'Jane Doe', 'email' => 'jane@example.test', 'phone' => '555', 'service' => 'Deck build',
            'preferred_at' => now()->addDays(3)->format('Y-m-d H:i'), 'message' => 'Backyard deck',
        ])->assertCreated();

        $lead = Lead::withoutGlobalScope('tenant')->where('email', 'jane@example.test')->firstOrFail();
        $this->assertSame($user->tenant_id, $lead->tenant_id);
        $this->assertSame('website', $lead->source);
        $appt = Appointment::withoutGlobalScope('tenant')->where('lead_id', $lead->id)->firstOrFail();
        $this->assertSame('requested', $appt->status);
        $this->assertSame('website', $appt->source);
        Event::assertDispatched(AppointmentSaved::class, fn ($e) => $e->appointmentId === $appt->id && $e->tenantId === $user->tenant_id);

        $this->postJson("/api/public/sites/{$slug}/bookings", ['name' => 'X', 'email' => 'x@x.test', 'preferred_at' => now()->subDay()->toDateTimeString()])
            ->assertStatus(422);
    }

    public function test_public_booking_404_without_module(): void
    {
        $user = $this->owner('No Appt Co', false);
        $this->postJson("/api/public/sites/{$user->tenant->slug}/bookings", [
            'name' => 'Jane', 'email' => 'jane@example.test', 'preferred_at' => now()->addDay()->toDateTimeString(),
        ])->assertNotFound();
        $this->assertSame(0, Lead::withoutGlobalScope('tenant')->where('tenant_id', $user->tenant_id)->count());
    }

    public function test_tenant_isolation_and_foreign_id_validation(): void
    {
        $a = $this->owner('Alpha Co');
        $b = $this->owner('Beta Co');
        $foreignProject = $this->project($b);

        Sanctum::actingAs($b);
        $expenseId = $this->postJson('/api/app/expenses', ['category' => 'materials', 'amount' => 500, 'expense_date' => '2026-11-01'])->assertCreated()->json('id');
        $subId = $this->postJson('/api/app/subcontractors', ['company_name' => 'B Sub'])->assertCreated()->json('id');

        Sanctum::actingAs($a);
        $this->getJson('/api/app/expenses')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/app/expenses/{$expenseId}")->assertNotFound();
        $this->patchJson("/api/app/subcontractors/{$subId}", ['company_name' => 'Hijack'])->assertNotFound();
        $this->getJson("/api/app/projects/{$foreignProject->id}/costing")->assertNotFound();
        $this->postJson('/api/app/expenses', ['category' => 'materials', 'amount' => 500, 'expense_date' => '2026-11-01', 'project_id' => $foreignProject->id])
            ->assertJsonValidationErrors('project_id');
    }

    public function test_subcontractor_assignment_and_insurance_flag(): void
    {
        $user = $this->owner();
        $project = $this->project($user);
        Sanctum::actingAs($user);

        $id = $this->postJson('/api/app/subcontractors', [
            'company_name' => 'Sparky', 'trade' => 'Electrical', 'insurance_expiry' => today()->addDays(10)->toDateString(), 'rate' => 9000,
        ])->assertCreated()->assertJsonPath('insurance_expiring', true)->json('id');

        $this->postJson("/api/app/subcontractors/{$id}/assignments", ['project_id' => $project->id, 'scope' => 'Wiring', 'agreed_amount' => 250000])
            ->assertOk()->assertJsonPath('projects.0.pivot.agreed_amount', 250000);
        $this->getJson('/api/app/subcontractors?expiring=1')->assertOk()->assertJsonCount(1, 'data');
        $this->deleteJson("/api/app/subcontractors/{$id}/assignments/{$project->id}")->assertOk()->assertJsonCount(0, 'projects');
    }

    public function test_timesheets_own_scope_and_approval(): void
    {
        $owner = $this->owner();
        $crew = $this->crew($owner);
        $project = $this->project($owner);

        Sanctum::actingAs($owner);
        $ownerEntry = $this->postJson('/api/app/timesheets', ['work_date' => '2026-11-20', 'hours' => 8, 'project_id' => $project->id])->assertCreated()->json('id');

        Sanctum::actingAs($crew);
        $crewEntry = $this->postJson('/api/app/timesheets', ['work_date' => '2026-11-20', 'hours' => 4.5, 'user_id' => $owner->id])
            ->assertCreated()->assertJsonPath('user_id', $crew->id)->json('id');
        $this->getJson('/api/app/timesheets')->assertOk()->assertJsonCount(1, 'data');
        $this->patchJson("/api/app/timesheets/{$ownerEntry}", ['hours' => 1])->assertNotFound();
        $this->postJson("/api/app/timesheets/{$crewEntry}/approve")->assertForbidden();

        Sanctum::actingAs($owner);
        $this->getJson('/api/app/timesheets')->assertOk()->assertJsonCount(2, 'data');
        $this->postJson("/api/app/timesheets/{$crewEntry}/approve")->assertOk()->assertJsonPath('approved', true);
        $this->getJson('/api/app/timesheets/summary?from=2026-11-01&to=2026-11-30')->assertOk()->assertJsonPath('total_hours', 12.5);

        Sanctum::actingAs($crew);
        $this->patchJson("/api/app/timesheets/{$crewEntry}", ['hours' => 9])->assertForbidden();
    }

    public function test_project_costing_math(): void
    {
        $user = $this->owner();
        $project = $this->project($user, ['budget' => 1_000_000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/app/expenses', ['project_id' => $project->id, 'category' => 'materials', 'amount' => 200_000, 'expense_date' => '2026-11-01'])->assertCreated();
        $this->postJson('/api/app/expenses', ['project_id' => $project->id, 'category' => 'permits', 'amount' => 50_000, 'expense_date' => '2026-11-02'])->assertCreated();
        $this->postJson('/api/app/expenses', ['category' => 'other', 'amount' => 99_999, 'expense_date' => '2026-11-02'])->assertCreated();
        $sub = $this->postJson('/api/app/subcontractors', ['company_name' => 'Pipes'])->json('id');
        $this->postJson("/api/app/subcontractors/{$sub}/assignments", ['project_id' => $project->id, 'agreed_amount' => 300_000])->assertOk();
        $this->postJson('/api/app/timesheets', ['project_id' => $project->id, 'work_date' => '2026-11-03', 'hours' => 10, 'hourly_rate' => 5000])->assertCreated();
        $this->postJson('/api/app/timesheets', ['project_id' => $project->id, 'work_date' => '2026-11-04', 'hours' => 2.5, 'hourly_rate' => 4000])->assertCreated();

        $this->getJson("/api/app/projects/{$project->id}/costing")->assertOk()->assertJson([
            'budget' => 1_000_000,
            'expenses_total' => 250_000,
            'expenses_by_category' => ['materials' => 200_000, 'permits' => 50_000],
            'subcontractor_total' => 300_000,
            'labour_hours' => 12.5,
            'labour_cost' => 60_000,
            'total_cost' => 610_000,
            'profit_estimate' => 390_000,
            'margin_percent' => 39,
        ]);
    }

    public function test_demo_seeder_is_idempotent(): void
    {
        (new DemoSeeder)->run();
        (new DemoSeeder)->run();
        $tid = User::where('email', 'owner@demo.test')->value('tenant_id');
        $this->assertSame(2, Appointment::withoutGlobalScope('tenant')->where('tenant_id', $tid)->count());
        $this->assertSame(4, TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $tid)->whereIn('module_key', self::MODULES)->count());
    }
}
