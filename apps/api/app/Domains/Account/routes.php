<?php

use App\Domains\Account\Http\AccountController;
use App\Domains\Account\Http\AddonController;
use App\Domains\Account\Http\BillingController;
use App\Domains\Account\Http\RoleController;
use App\Domains\Account\Http\TeamController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant'])->prefix('app')->group(function () {
    Route::middleware('module:team')->group(function () {
        Route::middleware('perm:team.view')->group(function () {
            Route::get('team/users', [TeamController::class, 'index']);
            Route::get('team/roles', [RoleController::class, 'index']);
            Route::get('team/permissions', [RoleController::class, 'catalog']);
        });
        Route::middleware('perm:team.manage')->group(function () {
            Route::post('team/users', [TeamController::class, 'store']);
            Route::put('team/users/{user}', [TeamController::class, 'update']);
            Route::post('team/users/{user}/disable', [TeamController::class, 'disable']);
            Route::post('team/users/{user}/enable', [TeamController::class, 'enable']);
            Route::delete('team/users/{user}', [TeamController::class, 'destroy']);
            Route::post('team/roles', [RoleController::class, 'store']);
            Route::put('team/roles/{role}', [RoleController::class, 'update']);
            Route::delete('team/roles/{role}', [RoleController::class, 'destroy']);
        });
    });

    Route::middleware('perm:team.manage')->group(function () {
        Route::get('addons', [AddonController::class, 'index']);
        Route::get('addons/{key}', [AddonController::class, 'show']);
        Route::post('addons/{key}/install', [AddonController::class, 'install']);
        Route::delete('addons/{key}', [AddonController::class, 'uninstall']);
        Route::put('addons/{key}/config', [AddonController::class, 'updateConfig']);

        Route::put('account/company', [AccountController::class, 'updateCompany']);

        Route::get('billing', [BillingController::class, 'show']);
        Route::post('billing/change-plan', [BillingController::class, 'changePlan']);
    });

    Route::get('account/company', [AccountController::class, 'company']);
    Route::put('account/profile', [AccountController::class, 'updateProfile']);
});
