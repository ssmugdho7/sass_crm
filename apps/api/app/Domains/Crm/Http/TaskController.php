<?php

namespace App\Domains\Crm\Http;

use App\Models\Task;
use App\Support\Tenancy\TenantRules;
use Illuminate\Http\Request;

class TaskController
{
    use PaginatesRequests;

    public const STATUSES = ['todo', 'in_progress', 'done'];

    public function index(Request $request)
    {
        return Task::with('project:id,name', 'assignee:id,name')
            ->when($request->integer('project_id'), fn ($q, $id) => $q->where('project_id', $id))
            ->when($request->string('status')->toString(), fn ($q, $s) => $s === 'open' ? $q->where('status', '!=', 'done') : $q->where('status', $s))
            ->when($request->integer('assigned_to'), fn ($q, $id) => $q->where('assigned_to', $id))
            ->when($request->boolean('mine'), fn ($q) => $q->where('assigned_to', $request->user()->id))
            ->when($request->string('search')->toString(), fn ($q, $s) => $q->where('title', 'like', "%{$s}%"))
            ->orderByRaw("status = 'done'")->orderByRaw('due_date is null')->orderBy('due_date')->latest('id')
            ->paginate($this->perPage($request));
    }

    public function show(int $taskId)
    {
        $task = Task::findOrFail($taskId);

        return $task->load('project:id,name', 'assignee:id,name');
    }

    public function store(Request $request)
    {
        return response()->json(Task::create($this->validated($request))->refresh()->load('project:id,name', 'assignee:id,name'), 201);
    }

    public function update(Request $request, int $taskId)
    {
        $task = Task::findOrFail($taskId);
        $task->update($this->validated($request));

        return $task->load('project:id,name', 'assignee:id,name');
    }

    public function status(Request $request, int $taskId)
    {
        $task = Task::findOrFail($taskId);
        $task->update($request->validate(['status' => 'required|in:'.implode(',', self::STATUSES)]));

        return $task->load('project:id,name', 'assignee:id,name');
    }

    public function destroy(int $taskId)
    {
        $task = Task::findOrFail($taskId);
        $task->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => 'required|string|max:190',
            'description' => 'nullable|string|max:5000',
            'project_id' => ['nullable', 'integer', TenantRules::exists('projects')],
            'status' => 'sometimes|in:'.implode(',', self::STATUSES),
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'due_date' => 'nullable|date',
            'assigned_to' => ['nullable', 'integer', TenantRules::exists('users')],
        ]);
    }
}
