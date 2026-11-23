<?php

namespace App\Domains\Crm\Http;

use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Task;

class DashboardController
{
    public function __invoke()
    {
        $openLeads = Lead::whereNotIn('status', ['won', 'lost']);
        $unpaid = Invoice::whereNotIn('status', ['draft', 'paid', 'void'])->get(['total', 'amount_paid'])
            ->sum(fn ($i) => max(0, $i->total - $i->amount_paid));

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
        ];
    }
}
