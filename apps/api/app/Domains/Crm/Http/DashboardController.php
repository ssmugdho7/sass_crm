<?php

namespace App\Domains\Crm\Http;

use App\Models\Customer;
use App\Models\Estimate;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Task;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController
{
    public function __invoke(Request $request)
    {
        $tenant = CurrentTenant::get();
        $allowed = fn (string $module, string $permission) => $tenant->hasModule($module) && $request->user()->hasPermission($permission);
        $leads = $allowed('leads', 'leads.view');
        $projects = $allowed('projects', 'projects.view');
        $tasks = $allowed('tasks', 'tasks.view');
        $invoices = $allowed('invoices', 'invoices.view');

        $openLeads = Lead::whereNotIn('status', ['won', 'lost']);
        // Outstanding balance summed in SQL; clamp per row so overpaid invoices never reduce it.
        $unpaid = $invoices ? Invoice::whereNotIn('status', ['draft', 'paid', 'void'])
            ->sum(DB::raw('CASE WHEN total > amount_paid THEN total - amount_paid ELSE 0 END')) : null;

        return [
            'stats' => [
                'open_leads' => $leads ? (clone $openLeads)->count() : null,
                'pipeline_value' => $leads ? (int) (clone $openLeads)->sum('value') : null,
                'active_projects' => $projects ? Project::whereIn('status', ['planning', 'in_progress'])->count() : null,
                'open_tasks' => $tasks ? Task::where('status', '!=', 'done')->count() : null,
                'overdue_tasks' => $tasks ? Task::where('status', '!=', 'done')->whereNotNull('due_date')->whereDate('due_date', '<', today())->count() : null,
                'unpaid_invoices' => $unpaid === null ? null : (int) $unpaid,
                'revenue_this_month' => $invoices ? (int) Payment::where('paid_at', '>=', now()->startOfMonth())->sum('amount') : null,
            ],
            'recent_leads' => $leads ? Lead::latest('id')->limit(5)->get(['id', 'name', 'service', 'status', 'value', 'source', 'created_at']) : [],
            'upcoming_tasks' => $tasks ? Task::with('project:id,name')->where('status', '!=', 'done')->whereNotNull('due_date')
                ->orderBy('due_date')->limit(8)->get(['id', 'title', 'status', 'priority', 'due_date', 'project_id']) : [],
            'projects_by_status' => $projects ? Project::selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status') : (object) [],
            'onboarding' => $this->onboarding($allowed),
        ];
    }

    /** First-run checklist state; website tables belong to an add-on domain, so probe them defensively. */
    private function onboarding(callable $allowed): array
    {
        $tenantId = CurrentTenant::id();

        return [
            'has_leads' => $allowed('leads', 'leads.view') && Lead::exists(),
            'has_customers' => $allowed('customers', 'customers.view') && Customer::exists(),
            'has_projects' => $allowed('projects', 'projects.view') && Project::exists(),
            'has_estimates' => $allowed('estimates', 'estimates.view') && Estimate::exists(),
            'website_services' => $allowed('website', 'website.manage') && Schema::hasTable('site_services')
                ? DB::table('site_services')->where('tenant_id', $tenantId)->count() : 0,
            'website_published' => $allowed('website', 'website.manage') && Schema::hasTable('site_settings')
                && DB::table('site_settings')->where('tenant_id', $tenantId)->where('published', true)->exists(),
        ];
    }
}
