<?php

namespace App\Domains\Operations\Http;

use App\Domains\Operations\Models\Subcontractor;
use App\Domains\Operations\Support\TenantRules;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class SubcontractorController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'], 'trade' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'], 'expiring' => ['nullable', 'boolean'],
        ]);
        $q = Subcontractor::withCount('projects')->orderBy('company_name');
        if ($s = $data['search'] ?? null) {
            $q->where(fn ($w) => $w->where('company_name', 'like', "%{$s}%")->orWhere('contact_name', 'like', "%{$s}%"));
        }
        foreach (['trade', 'status'] as $f) {
            if ($data[$f] ?? null) {
                $q->where($f, $data[$f]);
            }
        }
        if ($request->boolean('expiring')) {
            $q->whereNotNull('insurance_expiry')->whereDate('insurance_expiry', '<=', today()->addDays(30));
        }

        return $q->paginate(25);
    }

    public function show(int $subcontractor)
    {
        return Subcontractor::with('projects:id,name,status')->findOrFail($subcontractor);
    }

    public function store(Request $request)
    {
        return response()->json(Subcontractor::create($this->validated($request)), 201);
    }

    public function update(Request $request, int $subcontractor)
    {
        $sub = Subcontractor::findOrFail($subcontractor);
        $sub->update($this->validated($request, true));

        return $sub;
    }

    public function destroy(int $subcontractor)
    {
        Subcontractor::findOrFail($subcontractor)->delete();

        return response()->noContent();
    }

    /** Assign (or update the assignment of) a subcontractor to a project. */
    public function assign(Request $request, int $subcontractor)
    {
        $sub = Subcontractor::findOrFail($subcontractor);
        $data = $request->validate([
            'project_id' => ['required', 'integer', TenantRules::exists('projects')],
            'scope' => ['nullable', 'string', 'max:255'],
            'agreed_amount' => ['nullable', 'integer', 'min:0'],
        ]);
        $sub->projects()->syncWithoutDetaching([$data['project_id'] => [
            'scope' => $data['scope'] ?? null, 'agreed_amount' => $data['agreed_amount'] ?? 0,
        ]]);

        return $sub->load('projects:id,name,status');
    }

    public function unassign(int $subcontractor, int $project)
    {
        $sub = Subcontractor::findOrFail($subcontractor);
        $sub->projects()->detach($project);

        return $sub->load('projects:id,name,status');
    }

    private function validated(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'company_name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'trade' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'license_number' => ['nullable', 'string', 'max:100'],
            'insurance_expiry' => ['nullable', 'date'],
            'rate' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);
    }
}
