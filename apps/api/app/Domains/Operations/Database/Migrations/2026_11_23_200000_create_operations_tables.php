<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Operations add-ons: appointments, subcontractors, timesheets, expenses. Money is integer cents.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('requested'); // requested|confirmed|completed|cancelled
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('source')->default('manual'); // manual|website
            $table->timestamps();
            $table->index(['tenant_id', 'starts_at']);
        });

        Schema::create('subcontractors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('company_name');
            $table->string('contact_name')->nullable();
            $table->string('trade')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('license_number')->nullable();
            $table->date('insurance_expiry')->nullable();
            $table->unsignedBigInteger('rate')->default(0);
            $table->text('notes')->nullable();
            $table->string('status')->default('active'); // active|inactive
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('subcontractor_project', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subcontractor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('scope')->nullable();
            $table->unsignedBigInteger('agreed_amount')->default(0);
            $table->timestamps();
            $table->unique(['subcontractor_id', 'project_id']);
        });

        Schema::create('timesheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained()->nullOnDelete();
            $table->date('work_date');
            $table->decimal('hours', 5, 2);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('hourly_rate')->nullable();
            $table->boolean('approved')->default(false);
            $table->timestamps();
            $table->index(['tenant_id', 'work_date']);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category')->default('other'); // materials|labour|equipment|permits|subcontractor|other
            $table->string('vendor')->nullable();
            $table->string('description')->nullable();
            $table->unsignedBigInteger('amount');
            $table->date('expense_date');
            $table->string('receipt_url')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        foreach (['expenses', 'timesheets', 'subcontractor_project', 'subcontractors', 'appointments'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
