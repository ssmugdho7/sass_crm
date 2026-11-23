<?php

use App\Domains\Platform\Http\ModuleController;
use App\Domains\Platform\Http\OverviewController;
use App\Domains\Platform\Http\PlanController;
use App\Domains\Platform\Http\RoleController;
use App\Domains\Platform\Http\TenantController;
use App\Domains\Platform\Http\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'super'])->prefix('platform')->group(function () {
    Route::get('overview', OverviewController::class);

    Route::get('tenants', [TenantController::class, 'index']);
    Route::get('tenants/{tenant}', [TenantController::class, 'show']);
    Route::put('tenants/{tenant}', [TenantController::class, 'update']);
    Route::delete('tenants/{tenant}', [TenantController::class, 'destroy']);
    Route::post('tenants/{tenant}/plan-request/approve', [TenantController::class, 'approvePlanRequest']);
    Route::post('tenants/{tenant}/plan-request/reject', [TenantController::class, 'rejectPlanRequest']);
    Route::put('tenants/{tenant}/modules/{key}', [TenantController::class, 'toggleModule']);

    Route::get('permissions', [RoleController::class, 'catalog']);
    Route::get('tenants/{tenant}/roles', [RoleController::class, 'index']);
    Route::post('tenants/{tenant}/roles', [RoleController::class, 'store']);
    Route::put('tenants/{tenant}/roles/{role}', [RoleController::class, 'update']);
    Route::delete('tenants/{tenant}/roles/{role}', [RoleController::class, 'destroy']);

    Route::get('users', [UserController::class, 'index']);
    Route::get('users/{user}', [UserController::class, 'show']);
    Route::put('users/{user}', [UserController::class, 'update']);

    Route::get('plans', [PlanController::class, 'index']);
    Route::post('plans', [PlanController::class, 'store']);
    Route::put('plans/{plan}', [PlanController::class, 'update']);
    Route::delete('plans/{plan}', [PlanController::class, 'destroy']);

    Route::get('modules', [ModuleController::class, 'index']);
    Route::put('modules/{module}', [ModuleController::class, 'update']);
});
