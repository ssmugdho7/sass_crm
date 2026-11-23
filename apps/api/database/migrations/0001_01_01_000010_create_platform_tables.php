<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedInteger('price_monthly')->default(0); // cents
            $table->unsignedInteger('price_yearly')->default(0);
            $table->unsignedInteger('max_users')->default(5);
            $table->json('included_modules')->nullable(); // add-on keys bundled free
            $table->json('features')->nullable(); // marketing bullet list
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique(); // public website at /site/{slug}
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->foreignId('plan_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('trial'); // trial|active|past_due|suspended|cancelled
            $table->string('billing_cycle')->default('monthly');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->cascadeOnDelete(); // null = platform role
            $table->string('name');
            $table->string('slug');
            $table->json('permissions'); // ["*"] or ["leads.view", ...]
            $table->boolean('is_system')->default(false); // owner role cannot be deleted
            $table->timestamps();
            $table->unique(['tenant_id', 'slug']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->after('tenant_id')->constrained()->nullOnDelete();
            $table->boolean('is_super_admin')->default(false)->after('password');
            $table->string('phone')->nullable()->after('email');
            $table->string('status')->default('active')->after('is_super_admin'); // active|disabled
            $table->timestamp('last_login_at')->nullable();
        });

        Schema::create('modules', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('name');
            $table->string('category');
            $table->text('description')->nullable();
            $table->boolean('is_core')->default(false);
            $table->unsignedInteger('price_monthly')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tenant_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('module_key');
            $table->string('status')->default('active'); // active|disabled
            $table->text('config')->nullable(); // encrypted:array cast
            $table->timestamps();
            $table->unique(['tenant_id', 'module_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_modules');
        Schema::dropIfExists('modules');
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tenant_id');
            $table->dropConstrainedForeignId('role_id');
            $table->dropColumn(['is_super_admin', 'phone', 'status', 'last_login_at']);
        });
        Schema::dropIfExists('roles');
        Schema::dropIfExists('tenants');
        Schema::dropIfExists('plans');
    }
};
