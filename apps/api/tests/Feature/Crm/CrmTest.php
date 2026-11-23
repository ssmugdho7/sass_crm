<?php

namespace Tests\Feature\Crm;

use App\Domains\Crm\Database\DemoSeeder;
use App\Domains\Identity\Actions\RegisterTenant;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CrmTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private function owner(): User
    {
        return User::where('email', 'owner@demo.test')->firstOrFail();
    }

    private function otherOwner(): User
    {
        return app(RegisterTenant::class)(['company' => 'Other Co', 'name' => 'Bob', 'email' => 'bob@other.test', 'password' => 'password'])->fresh();
    }

    private function crew(User $owner): User
    {
        $role = Role::where('tenant_id', $owner->tenant_id)->where('slug', 'field-crew')->firstOrFail();

        return User::create(['tenant_id' => $owner->tenant_id, 'role_id' => $role->id, 'name' => 'Crew', 'email' => 'crew@demo.test', 'password' => 'password'])->fresh();
    }

    public function test_lead_crud_with_search_and_filters(): void
    {
        Sanctum::actingAs($this->owner(), ['crm']);
        $id = $this->postJson('/api/app/leads', ['name' => 'Tom Becker', 'service' => 'Bathroom', 'value' => 150000, 'assigned_to' => $this->owner()->id])
            ->assertCreated()->assertJsonPath('status', 'new')->json('id');
        $this->postJson('/api/app/leads', ['name' => 'Zed', 'status' => 'lost'])->assertCreated();

        $this->getJson('/api/app/leads?search=becker')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.assignee.name', 'Demo Owner');
        $this->getJson('/api/app/leads?status=lost&per_page=100')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('per_page', 100);
        $this->getJson('/api/app/leads?per_page=500')->assertJsonPath('per_page', 100);

        $this->putJson("/api/app/leads/{$id}", ['name' => 'Tom B', 'status' => 'contacted'])->assertOk()->assertJsonPath('status', 'contacted');
        $this->deleteJson("/api/app/leads/{$id}")->assertNoContent();
    }

    public function test_tenant_isolation(): void
    {
        $lead = Lead::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $this->owner()->tenant_id, 'name' => 'Secret lead']);
        $other = $this->otherOwner();
        Sanctum::actingAs($other, ['crm']);

        $this->getJson("/api/app/leads/{$lead->id}")->assertNotFound();
        $this->putJson("/api/app/leads/{$lead->id}", ['name' => 'Hacked'])->assertNotFound();
        $this->getJson('/api/app/leads')->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame('Secret lead', $lead->fresh()->name);

        // Cannot reference another tenant's user/customer.
        $this->postJson('/api/app/leads', ['name' => 'X', 'assigned_to' => $this->owner()->id])->assertJsonValidationErrors('assigned_to');
        $customer = Customer::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $this->owner()->tenant_id, 'name' => 'A cust']);
        $this->postJson('/api/app/projects', ['name' => 'P', 'customer_id' => $customer->id])->assertJsonValidationErrors('customer_id');
        $this->getJson("/api/app/customers/{$customer->id}")->assertNotFound();
        $this->assertNotContains($this->owner()->id, collect($this->getJson('/api/app/lookups/users')->json())->pluck('id'));
    }

    public function test_field_crew_cannot_manage_leads_but_can_update_tasks(): void
    {
        $crew = $this->crew($this->owner());
        Sanctum::actingAs($crew, ['crm']);

        $this->postJson('/api/app/leads', ['name' => 'Nope'])->assertForbidden();
        $this->getJson('/api/app/leads')->assertForbidden();
        $this->postJson('/api/app/projects', ['name' => 'Nope'])->assertForbidden();
        $this->getJson('/api/app/projects')->assertOk();

        $task = Task::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $crew->tenant_id, 'title' => 'Frame wall', 'assigned_to' => $crew->id]);
        $this->getJson('/api/app/tasks?mine=1')->assertOk()->assertJsonCount(1, 'data');
        $this->patchJson("/api/app/tasks/{$task->id}/status", ['status' => 'done'])->assertOk()->assertJsonPath('status', 'done');
    }

    public function test_lead_conversion_creates_customer_and_project(): void
    {
        Sanctum::actingAs($this->owner(), ['crm']);
        $lead = $this->postJson('/api/app/leads', [
            'name' => 'Sarah', 'email' => 's@example.com', 'phone' => '555', 'address' => '12 Oak St', 'service' => 'Kitchen remodel', 'value' => 480000,
        ])->json();

        $res = $this->postJson("/api/app/leads/{$lead['id']}/convert", ['create_project' => true])->assertCreated()
            ->assertJsonPath('customer.email', 's@example.com')->assertJsonPath('customer.address', '12 Oak St')
            ->assertJsonPath('project.name', 'Kitchen remodel – 12 Oak St')->assertJsonPath('project.budget', 480000)
            ->assertJsonPath('lead.status', 'won');
        $this->assertSame($res->json('customer.id'), Lead::find($lead['id'])->customer_id);
        $this->assertSame($res->json('customer.id'), Project::find($res->json('project.id'))->customer_id);

        $this->postJson("/api/app/leads/{$lead['id']}/convert")->assertStatus(422);

        $plain = $this->postJson('/api/app/leads', ['name' => 'No project'])->json('id');
        $this->postJson("/api/app/leads/{$plain}/convert")->assertCreated()->assertJsonPath('project', null);
    }

    public function test_customers_projects_tasks_flow(): void
    {
        Sanctum::actingAs($this->owner(), ['crm']);
        $cid = $this->postJson('/api/app/customers', ['name' => 'Acme', 'type' => 'company'])->assertCreated()->json('id');
        $pid = $this->postJson('/api/app/projects', ['name' => 'Roof', 'customer_id' => $cid, 'budget' => 900000, 'status' => 'in_progress', 'manager_id' => $this->owner()->id])
            ->assertCreated()->json('id');
        $this->postJson('/api/app/tasks', ['title' => 'Tear off', 'project_id' => $pid, 'due_date' => now()->subDay()->toDateString()])->assertCreated();

        $this->getJson("/api/app/customers/{$cid}")->assertOk()->assertJsonCount(1, 'projects')->assertJsonPath('invoice_summary.count', 0);
        $this->getJson("/api/app/projects/{$pid}")->assertOk()->assertJsonCount(1, 'tasks')->assertJsonPath('customer.name', 'Acme');
        $this->getJson('/api/app/projects?status=in_progress&per_page=100')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/app/tasks?project_id={$pid}&status=open")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_dashboard_shape(): void
    {
        $this->seed(DemoSeeder::class);
        $this->seed(DemoSeeder::class); // idempotent
        Sanctum::actingAs($this->owner(), ['crm']);

        $res = $this->getJson('/api/app/dashboard')->assertOk()->assertJsonStructure([
            'stats' => ['open_leads', 'pipeline_value', 'active_projects', 'open_tasks', 'overdue_tasks', 'unpaid_invoices', 'revenue_this_month'],
            'recent_leads', 'upcoming_tasks', 'projects_by_status',
        ]);
        $this->assertSame(6, $res->json('stats.open_leads'));
        $this->assertSame(1, $res->json('stats.overdue_tasks'));
        $this->assertSame(4, Project::withoutGlobalScope('tenant')->count());
    }
}
