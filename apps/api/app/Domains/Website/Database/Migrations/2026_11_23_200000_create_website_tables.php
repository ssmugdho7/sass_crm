<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('published')->default(true);
            $table->string('theme_color', 7)->default('#ea580c');
            $table->string('logo_url', 2048)->nullable();
            $table->string('hero_title')->nullable();
            $table->string('hero_subtitle', 500)->nullable();
            $table->string('hero_image_url', 2048)->nullable();
            $table->string('about_title')->nullable();
            $table->text('about_body')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->json('service_areas')->nullable();
            $table->string('hours')->nullable();
            $table->json('social')->nullable(); // {facebook,instagram,linkedin,youtube}
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->string('license_info')->nullable();
            $table->unsignedSmallInteger('years_in_business')->nullable();
            $table->timestamps();
        });

        Schema::create('site_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('summary', 500)->nullable();
            $table->text('body')->nullable();
            $table->string('icon', 50)->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->unsignedBigInteger('price_from')->nullable(); // cents
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['tenant_id', 'sort']);
        });

        Schema::create('site_portfolio', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('location')->nullable();
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            $table->string('cover_url', 2048)->nullable();
            $table->json('images')->nullable();
            $table->date('completed_on')->nullable();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['tenant_id', 'sort']);
        });

        Schema::create('site_testimonials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('author');
            $table->string('role')->nullable(); // role or location, e.g. "Homeowner, Springfield"
            $table->text('quote');
            $table->unsignedTinyInteger('rating')->default(5);
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['tenant_id', 'sort']);
        });

        Schema::create('site_team', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('role')->nullable();
            $table->string('photo_url', 2048)->nullable();
            $table->text('bio')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->index(['tenant_id', 'sort']);
        });

        Schema::create('site_faqs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('question');
            $table->text('answer');
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->index(['tenant_id', 'sort']);
        });
    }

    public function down(): void
    {
        foreach (['site_faqs', 'site_team', 'site_testimonials', 'site_portfolio', 'site_services', 'site_settings'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
