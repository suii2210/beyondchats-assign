<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->index();
            $table->longText('content');
            $table->string('source_url')->nullable()->index();
            $table->timestamp('published_at')->nullable()->index();
            $table->boolean('is_generated')->default(false)->index();
            $table->foreignId('parent_id')->nullable()->constrained('articles')->nullOnDelete();
            $table->json('citations')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
