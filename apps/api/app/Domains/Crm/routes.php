<?php

use App\Domains\Crm\Http\CustomerController;
use App\Domains\Crm\Http\DashboardController;
use App\Domains\Crm\Http\LeadController;
use App\Domains\Crm\Http\LookupController;
use App\Domains\Crm\Http\ProjectController;
use App\Domains\Crm\Http\TaskController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant'])->prefix('app')->whereNumber(['leadId', 'customerId', 'projectId', 'taskId'])->group(function () {
    Route::middleware(['module:dashboard', 'perm:dashboard.view'])->group(function () {
        Route::get('dashboard', DashboardController::class);
        Route::get('lookups/users', [LookupController::class, 'users']);
    });

    Route::middleware('module:leads')->group(function () {
        Route::middleware('perm:leads.view')->group(function () {
            Route::get('leads', [LeadController::class, 'index']);
            Route::get('leads/{leadId}', [LeadController::class, 'show']);
        });
        Route::middleware('perm:leads.manage')->group(function () {
            Route::post('leads', [LeadController::class, 'store']);
            Route::put('leads/{leadId}', [LeadController::class, 'update']);
            Route::delete('leads/{leadId}', [LeadController::class, 'destroy']);
            Route::post('leads/{leadId}/convert', [LeadController::class, 'convert']);
        });
    });

    Route::middleware('module:customers')->group(function () {
        Route::middleware('perm:customers.view')->group(function () {
            Route::get('customers', [CustomerController::class, 'index']);
            Route::get('customers/{customerId}', [CustomerController::class, 'show']);
        });
        Route::middleware('perm:customers.manage')->group(function () {
            Route::post('customers', [CustomerController::class, 'store']);
            Route::put('customers/{customerId}', [CustomerController::class, 'update']);
            Route::delete('customers/{customerId}', [CustomerController::class, 'destroy']);
        });
    });

    Route::middleware('module:projects')->group(function () {
        Route::middleware('perm:projects.view')->group(function () {
            Route::get('projects', [ProjectController::class, 'index']);
            Route::get('projects/{projectId}', [ProjectController::class, 'show']);
        });
        Route::middleware('perm:projects.manage')->group(function () {
            Route::post('projects', [ProjectController::class, 'store']);
            Route::put('projects/{projectId}', [ProjectController::class, 'update']);
            Route::delete('projects/{projectId}', [ProjectController::class, 'destroy']);
        });
    });

    Route::middleware('module:tasks')->group(function () {
        Route::middleware('perm:tasks.view')->group(function () {
            Route::get('tasks', [TaskController::class, 'index']);
            Route::get('tasks/{taskId}', [TaskController::class, 'show']);
        });
        Route::middleware('perm:tasks.manage')->group(function () {
            Route::post('tasks', [TaskController::class, 'store']);
            Route::put('tasks/{taskId}', [TaskController::class, 'update']);
            Route::patch('tasks/{taskId}/status', [TaskController::class, 'status']);
            Route::delete('tasks/{taskId}', [TaskController::class, 'destroy']);
        });
    });
});
