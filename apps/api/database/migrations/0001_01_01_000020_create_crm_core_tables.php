<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Shared CRM core schema. Money columns are integer cents.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type')->default('individual'); // individual|company
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'name']);
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('company')->nullable();
            $table->string('service')->nullable(); // e.g. "Kitchen remodel"
            $table->string('source')->default('manual'); // manual|website|referral|phone|social
            $table->string('status')->default('new'); // new|contacted|qualified|won|lost
            $table->unsignedBigInteger('value')->default(0);
            $table->string('address')->nullable();
            $table->text('message')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete(); // set on conversion
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('site_address')->nullable();
            $table->string('status')->default('planning'); // planning|in_progress|on_hold|completed|cancelled
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('budget')->default(0);
            $table->text('description')->nullable();
            $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status')->default('todo'); // todo|in_progress|done
            $table->string('priority')->default('normal'); // low|normal|high|urgent
            $table->date('due_date')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        foreach (['estimates', 'invoices'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
                if ($name === 'invoices') {
                    $table->foreignId('estimate_id')->nullable()->constrained()->nullOnDelete();
                }
                $table->string('number');
                // estimates: draft|sent|accepted|declined   invoices: draft|sent|partial|paid|overdue|void
                $table->string('status')->default('draft');
                $table->date('issue_date');
                $table->date($name === 'invoices' ? 'due_date' : 'expiry_date')->nullable();
                $table->json('items'); // [{description, quantity, unit_price}] unit_price in cents
                $table->decimal('tax_rate', 5, 2)->default(0); // percent
                $table->unsignedBigInteger('subtotal')->default(0);
                $table->unsignedBigInteger('tax')->default(0);
                $table->unsignedBigInteger('total')->default(0);
                if ($name === 'invoices') {
                    $table->unsignedBigInteger('amount_paid')->default(0);
                }
                $table->text('notes')->nullable();
                $table->string('public_token', 64)->unique(); // client-facing view/pay link
                $table->timestamps();
                $table->unique(['tenant_id', 'number']);
            });
        }

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount');
            $table->string('method')->default('cash'); // cash|bank_transfer|check|card|stripe
            $table->string('reference')->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['payments', 'invoices', 'estimates', 'tasks', 'projects', 'leads', 'customers'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
