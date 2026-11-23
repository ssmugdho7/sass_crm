<?php

namespace App\Domains\Operations\Http;

use App\Domains\Operations\Models\Expense;
use App\Domains\Operations\Models\Subcontractor;
use App\Domains\Operations\Models\Timesheet;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Support\Tenancy\TenantRules;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $q = $this->filtered($request);
        $total = (int) (clone $q)->sum('amount');
        $byCategory = (clone $q)->select('category', DB::raw('SUM(amount) as total'))->groupBy('category')->pluck('total', 'category')
            ->map(fn ($v) => (int) $v);
        $page = $q->with('project:id,name')->orderByDesc('expense_date')->orderByDesc('id')->paginate(25);

        return array_merge($page->toArray(), ['total_amount' => $total, 'by_category' => $byCategory]);
    }

    public function show(int $expense)
    {
        return Expense::with('project:id,name')->findOrFail($expense);
    }

    public function store(Request $request)
    {
        return response()->json(Expense::create($this->validated($request))->load('project:id,name'), 201);
    }

    public function update(Request $request, int $expense)
    {
        $row = Expense::findOrFail($expense);
        $row->update($this->validated($request, true));

        return $row->load('project:id,name');
    }

    public function destroy(int $expense)
    {
        Expense::findOrFail($expense)->delete();

        return response()->noContent();
    }

    /** Job costing: budget vs expenses vs subcontractor commitments vs timesheet labour. */
    public function costing(int $project)
    {
        $p = Project::findOrFail($project);
        $expenses = Expense::where('project_id', $p->id);
        $expensesTotal = (int) (clone $expenses)->sum('amount');
        $byCategory = $expenses->select('category', DB::raw('SUM(amount) as total'))->groupBy('category')->pluck('total', 'category')
            ->map(fn ($v) => (int) $v);
        $subTotal = (int) DB::table('subcontractor_project')
            ->join('subcontractors', 'subcontractors.id', '=', 'subcontractor_project.subcontractor_id')
            ->where('subcontractors.tenant_id', $p->tenant_id)
            ->where('subcontractor_project.project_id', $p->id)
            ->sum('subcontractor_project.agreed_amount');
        $sheets = Timesheet::where('project_id', $p->id)->get();
        $labour = (int) $sheets->sum(fn ($t) => TimesheetController::cost($t));
        $totalCost = $expensesTotal + $subTotal + $labour;
        $budget = (int) $p->budget;

        return [
            'project' => ['id' => $p->id, 'name' => $p->name, 'status' => $p->status],
            'budget' => $budget,
            'expenses_total' => $expensesTotal,
            'expenses_by_category' => $byCategory,
            'subcontractor_total' => $subTotal,
            'subcontractors' => Subcontractor::whereHas('projects', fn ($q) => $q->where('projects.id', $p->id))->count(),
            'labour_hours' => round($sheets->sum('hours'), 2),
            'labour_cost' => $labour,
            'total_cost' => $totalCost,
            'profit_estimate' => $budget - $totalCost,
            'margin_percent' => $budget > 0 ? round(($budget - $totalCost) / $budget * 100, 1) : null,
            'budget_used_percent' => $budget > 0 ? round($totalCost / $budget * 100, 1) : null,
        ];
    }

    private function filtered(Request $request): Builder
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'integer'], 'category' => ['nullable', Rule::in(Expense::CATEGORIES)],
            'from' => ['nullable', 'date'], 'to' => ['nullable', 'date'], 'search' => ['nullable', 'string', 'max:100'],
        ]);
        $q = Expense::query();
        if ($data['project_id'] ?? null) {
            $q->where('project_id', $data['project_id']);
        }
        if ($data['category'] ?? null) {
            $q->where('category', $data['category']);
        }
        if ($data['from'] ?? null) {
            $q->whereDate('expense_date', '>=', $data['from']);
        }
        if ($data['to'] ?? null) {
            $q->whereDate('expense_date', '<=', $data['to']);
        }
        if ($s = $data['search'] ?? null) {
            $q->where(fn ($w) => $w->where('vendor', 'like', "%{$s}%")->orWhere('description', 'like', "%{$s}%"));
        }

        return $q;
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'project_id' => ['nullable', 'integer', TenantRules::exists('projects')],
            'category' => [$req, Rule::in(Expense::CATEGORIES)],
            'vendor' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => [$req, 'integer', 'min:1'],
            'expense_date' => [$req, 'date'],
            'receipt_url' => ['nullable', 'url', 'max:2048'],
        ]);
    }
}
