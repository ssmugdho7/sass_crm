<?php

namespace App\Domains\Crm\Http;

use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController
{
    use TenantRules;

    public const STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];

    public function index(Request $request)
    {
        return Project::with('customer:id,name', 'manager:id,name')
            ->withCount(['tasks', 'tasks as open_tasks_count' => fn ($q) => $q->where('status', '!=', 'done')])
            ->when($request->string('search')->toString(), fn ($q, $s) => $q->where(fn ($q) => $q
                ->where('name', 'like', "%{$s}%")->orWhere('site_address', 'like', "%{$s}%")))
            ->when($request->string('status')->toString(), fn ($q, $s) => $q->where('status', $s))
            ->when($request->integer('customer_id'), fn ($q, $id) => $q->where('customer_id', $id))
            ->latest('id')->paginate($this->perPage($request));
    }

    public function show(int $projectId)
    {
        $project = Project::findOrFail($projectId);

        return $project->load([
            'customer:id,name,email,phone', 'manager:id,name',
            'tasks' => fn ($q) => $q->with('assignee:id,name')->orderByRaw("status = 'done'")->orderBy('due_date'),
        ]);
    }

    public function store(Request $request)
    {
        return response()->json(Project::create($this->validated($request))->refresh()->load('customer:id,name', 'manager:id,name'), 201);
    }

    public function update(Request $request, int $projectId)
    {
        $project = Project::findOrFail($projectId);
        $project->update($this->validated($request));

        return $project->load('customer:id,name', 'manager:id,name');
    }

    public function destroy(int $projectId)
    {
        $project = Project::findOrFail($projectId);
        $project->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:160',
            'customer_id' => ['nullable', 'integer', $this->inTenant('customers')],
            'site_address' => 'nullable|string|max:255',
            'status' => 'sometimes|in:'.implode(',', self::STATUSES),
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
            'budget' => 'nullable|integer|min:0',
            'description' => 'nullable|string|max:5000',
            'manager_id' => ['nullable', 'integer', $this->inTenant('users')],
        ]);
        $data['budget'] = (int) ($data['budget'] ?? 0);

        return $data;
    }
}
