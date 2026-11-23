<?php

namespace Tests\Feature\Crm;

use App\Domains\Crm\Database\DemoSeeder;
use App\Domains\Identity\Actions\RegisterTenant;
use App\Models\Customer;
use App\Models\Estimate;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

    private function billingDoc(string $class, int $customerId, ?int $projectId): void
    {
        $class::withoutGlobalScope('tenant')->forceCreate([
            'tenant_id' => $this->owner()->tenant_id, 'customer_id' => $customerId, 'project_id' => $projectId, 'number' => uniqid('D-'),
            'issue_date' => now()->toDateString(), 'items' => [], 'public_token' => bin2hex(random_bytes(16)),
        ]);
    }

    public function test_customer_with_billing_history_cannot_be_deleted(): void
    {
        Sanctum::actingAs($this->owner(), ['crm']);
        $withInvoice = $this->postJson('/api/app/customers', ['name' => 'Has Invoice'])->json('id');
        $withEstimate = $this->postJson('/api/app/customers', ['name' => 'Has Estimate'])->json('id');
        $clean = $this->postJson('/api/app/customers', ['name' => 'Clean'])->json('id');
        $this->billingDoc(Invoice::class, $withInvoice, null);
        $this->billingDoc(Estimate::class, $withEstimate, null);

        $this->deleteJson("/api/app/customers/{$withInvoice}")->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'estimates or invoices'));
        $this->deleteJson("/api/app/customers/{$withEstimate}")->assertStatus(422);
        $this->assertSame(1, Invoice::where('customer_id', $withInvoice)->count());
        $this->assertNotNull(Customer::find($withEstimate));
        $this->deleteJson("/api/app/customers/{$clean}")->assertNoContent();
    }

    public function test_project_with_linked_records_cannot_be_deleted(): void
    {
        Sanctum::actingAs($this->owner(), ['crm']);
        $cid = $this->postJson('/api/app/customers', ['name' => 'Acme'])->json('id');
        $invoiced = $this->postJson('/api/app/projects', ['name' => 'Invoiced', 'customer_id' => $cid])->json('id');
        $estimated = $this->postJson('/api/app/projects', ['name' => 'Estimated', 'customer_id' => $cid])->json('id');
        $clean = $this->postJson('/api/app/projects', ['name' => 'Clean', 'customer_id' => $cid])->json('id');
        $this->billingDoc(Invoice::class, $cid, $invoiced);
        $this->billingDoc(Estimate::class, $cid, $estimated);

        $this->deleteJson("/api/app/projects/{$invoiced}")->assertStatus(422);
        $this->deleteJson("/api/app/projects/{$estimated}")->assertStatus(422);

        if (Schema::hasTable('expenses')) {
            $withExpense = $this->postJson('/api/app/projects', ['name' => 'Expensed'])->json('id');
            DB::table('expenses')->insert([
                'tenant_id' => $this->owner()->tenant_id, 'project_id' => $withExpense, 'amount' => 1000,
                'expense_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->deleteJson("/api/app/projects/{$withExpense}")->assertStatus(422);
        }

        $this->assertNotNull(Project::find($invoiced));
        $this->deleteJson("/api/app/projects/{$clean}")->assertNoContent();
    }

    public function test_dashboard_shape(): void
    {
        $this->seed(DemoSeeder::class);
        $this->seed(DemoSeeder::class); // idempotent
        Sanctum::actingAs($this->owner(), ['crm']);

        $res = $this->getJson('/api/app/dashboard')->assertOk()->assertJsonStructure([
            'stats' => ['open_leads', 'pipeline_value', 'active_projects', 'open_tasks', 'overdue_tasks', 'unpaid_invoices', 'revenue_this_month'],
            'recent_leads', 'upcoming_tasks', 'projects_by_status',
            'onboarding' => ['has_leads', 'has_customers', 'has_projects', 'has_estimates', 'website_services', 'website_published'],
        ]);
        $this->assertTrue($res->json('onboarding.has_leads'));
        $this->assertTrue($res->json('onboarding.has_projects'));
        $this->assertSame(6, $res->json('stats.open_leads'));
        $this->assertSame(1, $res->json('stats.overdue_tasks'));
        $this->assertSame(4, Project::withoutGlobalScope('tenant')->count());
    }

    public function test_dashboard_onboarding_and_unpaid_sum_for_new_account(): void
    {
        $owner = $this->otherOwner();
        Sanctum::actingAs($owner, ['crm']);

        $res = $this->getJson('/api/app/dashboard')->assertOk();
        $this->assertSame([
            'has_leads' => false, 'has_customers' => false, 'has_projects' => false,
            'has_estimates' => false, 'website_services' => 0,
        ], collect($res->json('onboarding'))->except('website_published')->all());
        $this->assertSame(0, $res->json('stats.unpaid_invoices'));

        $customer = Customer::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $owner->tenant_id, 'name' => 'Acme']);
        $base = ['tenant_id' => $owner->tenant_id, 'customer_id' => $customer->id, 'issue_date' => today(), 'items' => '[]'];
        // Outstanding = 7500 (sent) + 0 (overpaid partial is clamped); paid and draft are excluded.
        foreach ([['INV-1', 'sent', 10000, 2500], ['INV-2', 'partial', 5000, 6000], ['INV-3', 'paid', 9000, 9000], ['INV-4', 'draft', 7000, 0]] as [$num, $status, $total, $paid]) {
            DB::table('invoices')->insert($base + ['number' => $num, 'status' => $status, 'total' => $total, 'amount_paid' => $paid, 'public_token' => $num.'-tok']);
        }

        $res = $this->getJson('/api/app/dashboard')->assertOk();
        $this->assertSame(7500, $res->json('stats.unpaid_invoices'));
        $this->assertTrue($res->json('onboarding.has_customers'));
    }
}
