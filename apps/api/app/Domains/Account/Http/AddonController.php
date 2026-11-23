<?php

namespace App\Domains\Account\Http;

use App\Domains\Account\Support\AddonCatalog;
use App\Models\TenantModule;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;

class AddonController
{
    public function index()
    {
        $tenant = CurrentTenant::get()->load('plan');
        $installed = TenantModule::all()->keyBy('module_key');

        return ['data' => collect(AddonCatalog::available())
            ->map(fn ($a, $key) => AddonCatalog::present($a, $tenant, $installed->get($key)))
            ->values()];
    }

    public function show(string $key)
    {
        return $this->present($key);
    }

    public function install(string $key)
    {
        AddonCatalog::find($key);
        $module = TenantModule::firstOrNew(['module_key' => $key]);
        // An add-on the plan already provides stays plan-sourced; otherwise it was installed separately.
        if (! ($module->exists && $module->status === 'active' && $module->source === 'plan')) {
            $module->source = 'addon';
        }
        $module->status = 'active';
        $module->save();

        return $this->present($key);
    }

    public function uninstall(string $key)
    {
        AddonCatalog::find($key);
        TenantModule::where('module_key', $key)->update(['status' => 'disabled']);

        return $this->present($key);
    }

    public function updateConfig(Request $request, string $key)
    {
        $addon = AddonCatalog::find($key);
        // Payment gateway secrets control where customer payments go.
        abort_if($key === 'payment_gateway' && ! $request->user()->hasPermission('payments.manage'), 403, 'You need the payments.manage permission to change payment settings.');
        $schema = $addon['schema'];
        abort_if($schema === [], 422, 'This add-on has no settings.');
        $data = $request->validate(collect($schema)->mapWithKeys(fn ($t, $f) => [$f => 'nullable|string|max:2000'])->all());

        $module = TenantModule::firstOrNew(['module_key' => $key], ['status' => 'disabled']);
        $config = $module->config ?? [];
        foreach ($schema as $field => $type) {
            if (! array_key_exists($field, $data)) {
                continue;
            }
            $value = is_string($data[$field]) ? trim($data[$field]) : null;
            if ($type === 'secret' && ($value === null || $value === '')) {
                continue; // blank secret input keeps the stored value
            }
            $config[$field] = $value === '' ? null : $value;
        }
        $module->config = $config;
        $module->save();

        return $this->present($key);
    }

    private function present(string $key): array
    {
        $addon = AddonCatalog::find($key);

        return AddonCatalog::present($addon, CurrentTenant::get()->load('plan'), TenantModule::where('module_key', $key)->first());
    }
}
