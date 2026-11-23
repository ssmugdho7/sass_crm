<?php

namespace App\Domains\Operations\Http;

use App\Domains\Operations\Models\Timesheet;
use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantRules;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Staff see and edit only their own entries; users with team.manage (owners) see and edit everyone's
 * and can approve. Approved entries are locked for non-managers.
 */
class TimesheetController extends Controller
{
    private const WITH = ['user:id,name', 'project:id,name', 'task:id,title'];

    public function index(Request $request)
    {
        return $this->filtered($request)->with(self::WITH)->orderByDesc('work_date')->orderByDesc('id')->paginate(100);
    }

    /** Hours and labour cost per project and per user for the filtered range. */
    public function summary(Request $request)
    {
        $rows = $this->filtered($request)->with(['user:id,name', 'project:id,name'])->get();
        $group = fn (string $key, callable $label) => $rows->groupBy($key)->map(fn ($g) => [
            'id' => $g->first()->{$key}, 'name' => $label($g->first()),
            'hours' => round($g->sum('hours'), 2), 'cost' => (int) $g->sum(fn ($t) => self::cost($t)),
        ])->values();

        return [
            'total_hours' => round($rows->sum('hours'), 2),
            'total_cost' => (int) $rows->sum(fn ($t) => self::cost($t)),
            'by_project' => $group('project_id', fn ($t) => $t->project?->name ?? 'No project'),
            'by_user' => $group('user_id', fn ($t) => $t->user?->name ?? 'Unknown'),
        ];
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        if (! $this->isManager($request) || empty($data['user_id'])) {
            $data['user_id'] = $request->user()->id;
        }
        if (! $this->isManager($request)) {
            unset($data['hourly_rate']); // pay rates are set by managers only
        }
        unset($data['approved']);

        return response()->json(Timesheet::create($data)->load(self::WITH), 201);
    }

    public function update(Request $request, int $timesheet)
    {
        $entry = $this->find($request, $timesheet);
        $manager = $this->isManager($request);
        abort_if($entry->approved && ! $manager, 403, 'Approved entries can only be changed by a manager.');
        $data = $this->validated($request, true);
        if (! $manager) {
            unset($data['user_id'], $data['hourly_rate']); // pay rates are set by managers only
        }
        unset($data['approved']);
        $entry->update($data);

        return $entry->load(self::WITH);
    }

    public function destroy(Request $request, int $timesheet)
    {
        $entry = $this->find($request, $timesheet);
        abort_if($entry->approved && ! $this->isManager($request), 403, 'Approved entries can only be changed by a manager.');
        $entry->delete();

        return response()->noContent();
    }

    public function approve(Request $request, int $timesheet)
    {
        $entry = Timesheet::findOrFail($timesheet);
        $entry->update(['approved' => $request->boolean('approved', true)]);

        return $entry->load(self::WITH);
    }

    public static function cost(Timesheet $t): int
    {
        return (int) round($t->hours * ($t->hourly_rate ?? 0));
    }

    private function isManager(Request $request): bool
    {
        return $request->user()->hasPermission('team.manage');
    }

    private function find(Request $request, int $id): Timesheet
    {
        $q = Timesheet::query();
        if (! $this->isManager($request)) {
            $q->where('user_id', $request->user()->id);
        }

        return $q->findOrFail($id);
    }

    private function filtered(Request $request): Builder
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer'], 'project_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'], 'to' => ['nullable', 'date'], 'approved' => ['nullable', 'boolean'],
        ]);
        $q = Timesheet::query();
        if (! $this->isManager($request)) {
            $q->where('user_id', $request->user()->id);
        } elseif ($data['user_id'] ?? null) {
            $q->where('user_id', $data['user_id']);
        }
        if ($data['project_id'] ?? null) {
            $q->where('project_id', $data['project_id']);
        }
        if ($data['from'] ?? null) {
            $q->whereDate('work_date', '>=', $data['from']);
        }
        if ($data['to'] ?? null) {
            $q->whereDate('work_date', '<=', $data['to']);
        }
        if ($request->has('approved')) {
            $q->where('approved', $request->boolean('approved'));
        }

        return $q;
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'user_id' => ['nullable', 'integer', TenantRules::exists('users')],
            'project_id' => ['nullable', 'integer', TenantRules::exists('projects')],
            'task_id' => ['nullable', 'integer', TenantRules::exists('tasks')],
            'work_date' => [$req, 'date'],
            'hours' => [$req, 'numeric', 'min:0.25', 'max:24'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'hourly_rate' => ['nullable', 'integer', 'min:0'],
            'approved' => ['prohibited'],
        ]);
    }
}
