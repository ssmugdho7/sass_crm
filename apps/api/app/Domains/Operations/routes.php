<?php

use App\Domains\Operations\Http\AppointmentController;
use App\Domains\Operations\Http\ExpenseController;
use App\Domains\Operations\Http\PublicBookingController;
use App\Domains\Operations\Http\SubcontractorController;
use App\Domains\Operations\Http\TimesheetController;
use Illuminate\Support\Facades\Route;

// Operations add-ons. Route params are plain ids resolved inside controllers (tenant scope applies there).
Route::middleware(['auth:sanctum', 'tenant'])->prefix('app')->group(function () {
    Route::middleware('module:appointments')->group(function () {
        Route::middleware('perm:appointments.view')->group(function () {
            Route::get('appointments', [AppointmentController::class, 'index']);
            Route::get('appointments/{appointment}', [AppointmentController::class, 'show'])->whereNumber('appointment');
        });
        Route::middleware('perm:appointments.manage')->group(function () {
            Route::post('appointments', [AppointmentController::class, 'store']);
            Route::match(['put', 'patch'], 'appointments/{appointment}', [AppointmentController::class, 'update'])->whereNumber('appointment');
            Route::delete('appointments/{appointment}', [AppointmentController::class, 'destroy'])->whereNumber('appointment');
        });
    });

    Route::middleware('module:subcontractors')->group(function () {
        Route::middleware('perm:subcontractors.view')->group(function () {
            Route::get('subcontractors', [SubcontractorController::class, 'index']);
            Route::get('subcontractors/{subcontractor}', [SubcontractorController::class, 'show'])->whereNumber('subcontractor');
        });
        Route::middleware('perm:subcontractors.manage')->group(function () {
            Route::post('subcontractors', [SubcontractorController::class, 'store']);
            Route::match(['put', 'patch'], 'subcontractors/{subcontractor}', [SubcontractorController::class, 'update'])->whereNumber('subcontractor');
            Route::delete('subcontractors/{subcontractor}', [SubcontractorController::class, 'destroy'])->whereNumber('subcontractor');
            Route::post('subcontractors/{subcontractor}/assignments', [SubcontractorController::class, 'assign'])->whereNumber('subcontractor');
            Route::delete('subcontractors/{subcontractor}/assignments/{project}', [SubcontractorController::class, 'unassign'])->whereNumber(['subcontractor', 'project']);
        });
    });

    Route::middleware('module:timesheets')->group(function () {
        Route::middleware('perm:timesheets.view')->group(function () {
            Route::get('timesheets', [TimesheetController::class, 'index']);
            Route::get('timesheets/summary', [TimesheetController::class, 'summary']);
        });
        Route::middleware('perm:timesheets.manage')->group(function () {
            Route::post('timesheets', [TimesheetController::class, 'store']);
            Route::match(['put', 'patch'], 'timesheets/{timesheet}', [TimesheetController::class, 'update'])->whereNumber('timesheet');
            Route::delete('timesheets/{timesheet}', [TimesheetController::class, 'destroy'])->whereNumber('timesheet');
        });
        Route::post('timesheets/{timesheet}/approve', [TimesheetController::class, 'approve'])->whereNumber('timesheet')->middleware('perm:team.manage');
    });

    Route::middleware('module:expenses')->group(function () {
        Route::middleware('perm:expenses.view')->group(function () {
            Route::get('expenses', [ExpenseController::class, 'index']);
            Route::get('expenses/{expense}', [ExpenseController::class, 'show'])->whereNumber('expense');
            Route::get('projects/{project}/costing', [ExpenseController::class, 'costing'])->whereNumber('project');
        });
        Route::middleware('perm:expenses.manage')->group(function () {
            Route::post('expenses', [ExpenseController::class, 'store']);
            Route::match(['put', 'patch'], 'expenses/{expense}', [ExpenseController::class, 'update'])->whereNumber('expense');
            Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy'])->whereNumber('expense');
        });
    });
});

Route::prefix('public')->group(function () {
    Route::post('sites/{slug}/bookings', [PublicBookingController::class, 'store'])->middleware('throttle:5,1');
});
