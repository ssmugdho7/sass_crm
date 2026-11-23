<?php

namespace App\Domains\Identity\Actions;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RegisterTenant
{
    public function __construct(private CreateTenantRoles $roles) {}

    /** @param array{company:string,name:string,email:string,password:string,phone?:string,plan?:string} $data */
    public function __invoke(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $plan = Plan::where('slug', $data['plan'] ?? '')->first() ?? Plan::orderBy('sort')->first();
            $slug = Str::slug($data['company']) ?: 'company';
            $base = $slug;
            for ($i = 2; Tenant::where('slug', $slug)->exists(); $i++) {
                $slug = "{$base}-{$i}";
            }
            $tenant = Tenant::create([
                'name' => $data['company'], 'slug' => $slug, 'email' => $data['email'], 'phone' => $data['phone'] ?? null,
                'plan_id' => $plan?->id, 'status' => 'trial', 'trial_ends_at' => now()->addDays(14),
            ]);
            foreach ($plan?->included_modules ?? [] as $key) {
                TenantModule::withoutGlobalScope('tenant')->create(['tenant_id' => $tenant->id, 'module_key' => $key, 'source' => 'plan']);
            }
            $owner = ($this->roles)($tenant);

            return User::create([
                'tenant_id' => $tenant->id, 'role_id' => $owner->id, 'name' => $data['name'],
                'email' => $data['email'], 'phone' => $data['phone'] ?? null, 'password' => $data['password'],
            ]);
        });
    }
}
