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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController
{
    public function __invoke()
    {
        $openLeads = Lead::whereNotIn('status', ['won', 'lost']);
        // Outstanding balance summed in SQL; clamp per row so overpaid invoices never reduce it.
        $unpaid = Invoice::whereNotIn('status', ['draft', 'paid', 'void'])
            ->sum(DB::raw('CASE WHEN total > amount_paid THEN total - amount_paid ELSE 0 END'));

        return [
            'stats' => [
                'open_leads' => (clone $openLeads)->count(),
                'pipeline_value' => (int) (clone $openLeads)->sum('value'),
                'active_projects' => Project::whereIn('status', ['planning', 'in_progress'])->count(),
                'open_tasks' => Task::where('status', '!=', 'done')->count(),
                'overdue_tasks' => Task::where('status', '!=', 'done')->whereNotNull('due_date')->whereDate('due_date', '<', today())->count(),
                'unpaid_invoices' => (int) $unpaid,
                'revenue_this_month' => (int) Payment::where('paid_at', '>=', now()->startOfMonth())->sum('amount'),
            ],
            'recent_leads' => Lead::latest('id')->limit(5)->get(['id', 'name', 'service', 'status', 'value', 'source', 'created_at']),
            'upcoming_tasks' => Task::with('project:id,name')->where('status', '!=', 'done')->whereNotNull('due_date')
                ->orderBy('due_date')->limit(8)->get(['id', 'title', 'status', 'priority', 'due_date', 'project_id']),
            'projects_by_status' => Project::selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status'),
            'onboarding' => $this->onboarding(),
        ];
    }

    /** First-run checklist state; website tables belong to an add-on domain, so probe them defensively. */
    private function onboarding(): array
    {
        $tenantId = CurrentTenant::id();

        return [
            'has_leads' => Lead::exists(),
            'has_customers' => Customer::exists(),
            'has_projects' => Project::exists(),
            'has_estimates' => Estimate::exists(),
            'website_services' => Schema::hasTable('site_services')
                ? DB::table('site_services')->where('tenant_id', $tenantId)->count() : 0,
            'website_published' => Schema::hasTable('site_settings')
                && DB::table('site_settings')->where('tenant_id', $tenantId)->where('published', true)->exists(),
        ];
    }
}
