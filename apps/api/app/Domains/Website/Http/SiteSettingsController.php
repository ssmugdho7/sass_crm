<?php

namespace App\Domains\Website\Http;

use App\Domains\Website\Actions\BuildChecklist;
use App\Domains\Website\Actions\EnsureSiteSettings;
use App\Domains\Website\Actions\ImportProjectToPortfolio;
use App\Domains\Website\Models\SitePortfolio;
use App\Models\Project;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SiteSettingsController
{
    public function show(EnsureSiteSettings $ensure)
    {
        return response()->json($ensure(CurrentTenant::get()));
    }

    public function update(Request $request, EnsureSiteSettings $ensure)
    {
        $data = $request->validate([
            'published' => 'sometimes|boolean',
            'theme_color' => ['sometimes', 'required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'logo_url' => 'nullable|url|max:2048',
            'hero_title' => 'nullable|string|max:255',
            'hero_subtitle' => 'nullable|string|max:500',
            'hero_image_url' => 'nullable|url|max:2048',
            'about_title' => 'nullable|string|max:255',
            'about_body' => 'nullable|string|max:10000',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'service_areas' => 'nullable|array|max:50',
            'service_areas.*' => 'nullable|string|max:100',
            'hours' => 'nullable|string|max:255',
            'social' => 'nullable|array',
            'social.facebook' => 'nullable|url|max:500',
            'social.instagram' => 'nullable|url|max:500',
            'social.linkedin' => 'nullable|url|max:500',
            'social.youtube' => 'nullable|url|max:500',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:500',
            'license_info' => 'nullable|string|max:255',
            'years_in_business' => 'nullable|integer|min:0|max:300',
        ]);
        if (array_key_exists('service_areas', $data)) {
            $data['service_areas'] = array_values(array_filter(array_map(fn ($a) => trim((string) $a), $data['service_areas'] ?? [])));
        }
        if (array_key_exists('social', $data)) {
            $data['social'] = collect(['facebook', 'instagram', 'linkedin', 'youtube'])
                ->mapWithKeys(fn ($k) => [$k => $data['social'][$k] ?? null])->all();
        }
        $settings = $ensure(CurrentTenant::get());
        $settings->update($data);

        return $settings->fresh();
    }

    public function checklist(EnsureSiteSettings $ensure, BuildChecklist $checklist)
    {
        return $checklist($ensure(CurrentTenant::get()));
    }

    public function upload(Request $request)
    {
        $request->validate(['file' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120']);
        $file = $request->file('file');
        $path = $file->storeAs('sites/'.CurrentTenant::id(), Str::random(24).'.'.$file->extension(), 'public');

        return response()->json(['url' => url(Storage::disk('public')->url($path)), 'path' => $path], 201);
    }

    public function importProject(int $project, ImportProjectToPortfolio $import)
    {
        // Resolved here (not via route binding) so the tenant scope is guaranteed to apply.
        return response()->json($import(Project::findOrFail($project)), 201);
    }

    /** Completed CRM projects that are not yet in the portfolio. */
    public function importableProjects()
    {
        $used = SitePortfolio::whereNotNull('project_id')->pluck('project_id');

        return Project::where('status', 'completed')->whereNotIn('id', $used)
            ->latest('updated_at')->limit(100)->get(['id', 'name', 'site_address', 'due_date', 'updated_at']);
    }
}
