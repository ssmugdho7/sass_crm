<?php

namespace App\Domains\Platform\Http;

use App\Models\Module;
use App\Models\TenantModule;
use Illuminate\Http\Request;

class ModuleController
{
    public function index()
    {
        $installed = TenantModule::withoutGlobalScope('tenant')->where('status', 'active')
            ->selectRaw('module_key, count(*) as total')->groupBy('module_key')->pluck('total', 'module_key');

        return Module::query()->orderBy('is_core', 'desc')->orderBy('category')->orderBy('name')->get()
            ->map(fn (Module $m) => [...$m->toArray(), 'installed_count' => (int) ($installed[$m->key] ?? 0)]);
    }

    public function update(Request $request, Module $module)
    {
        $data = $request->validate(['is_active' => 'sometimes|boolean', 'price_monthly' => 'sometimes|integer|min:0']);
        abort_if($module->is_core && ($data['is_active'] ?? true) === false, 422, 'Core modules cannot be deactivated.');
        $module->update($data);

        return $module;
    }
}
