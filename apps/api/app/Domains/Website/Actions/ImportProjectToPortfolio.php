<?php

namespace App\Domains\Website\Actions;

use App\Domains\Website\Models\SitePortfolio;
use App\Models\Project;
use Illuminate\Validation\ValidationException;

/** Creates a draft portfolio entry prefilled from a completed CRM project (current tenant). */
class ImportProjectToPortfolio
{
    public function __invoke(Project $project): SitePortfolio
    {
        if ($project->status !== 'completed') {
            throw ValidationException::withMessages(['project' => 'Only completed projects can be added to the portfolio.']);
        }
        if (SitePortfolio::where('project_id', $project->id)->exists()) {
            throw ValidationException::withMessages(['project' => 'This project is already in your portfolio.']);
        }

        return SitePortfolio::create([
            'title' => $project->name,
            'location' => $this->area($project->site_address),
            'category' => null,
            'description' => $project->description,
            'completed_on' => $project->due_date ?? $project->updated_at,
            'project_id' => $project->id,
            'images' => [],
            'sort' => (int) SitePortfolio::max('sort') + 1,
            'is_published' => false, // draft until photos are added
        ]);
    }

    /** Public pages should show the area, not a client's street address. */
    private function area(?string $address): ?string
    {
        if (! $address) {
            return null;
        }
        $parts = array_map('trim', explode(',', $address));

        return count($parts) > 1 ? implode(', ', array_slice($parts, 1)) : null;
    }
}
