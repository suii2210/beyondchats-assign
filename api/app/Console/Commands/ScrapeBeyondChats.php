<?php

namespace App\Console\Commands;

use App\Models\Article;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ScrapeBeyondChats extends Command
{
    protected $signature = 'scrape:beyondchats {--force : Re-scrape and overwrite existing articles}';

    protected $description = 'Fetch the 5 oldest BeyondChats blog posts and store them.';

    public function handle(): int
    {
        $baseUrl = 'https://beyondchats.com/wp-json/wp/v2/posts';
        $perPage = 5;

        $initial = Http::timeout(20)->get($baseUrl, [
            'per_page' => $perPage,
            'page' => 1,
        ]);

        if (! $initial->successful()) {
            $this->error('Failed to fetch posts list.');
            return self::FAILURE;
        }

        $totalPages = (int) ($initial->header('X-WP-TotalPages') ?? 1);
        $pageResponse = $totalPages > 1
            ? Http::timeout(20)->get($baseUrl, ['per_page' => $perPage, 'page' => $totalPages])
            : $initial;

        if (! $pageResponse->successful()) {
            $this->error('Failed to fetch last page of posts.');
            return self::FAILURE;
        }

        $posts = $pageResponse->json();
        if (! is_array($posts)) {
            $this->error('Unexpected response when fetching posts.');
            return self::FAILURE;
        }

        $created = 0;
        $skipped = 0;

        foreach ($posts as $post) {
            $title = html_entity_decode($post['title']['rendered'] ?? 'Untitled');
            $content = $post['content']['rendered'] ?? '';
            $slug = $post['slug'] ?? Str::slug($title);
            $sourceUrl = $post['link'] ?? null;
            $publishedAt = $post['date'] ?? null;

            if (! $sourceUrl || $content === '') {
                $skipped++;
                continue;
            }

            $existing = Article::where('source_url', $sourceUrl)->exists();
            if ($existing && ! $this->option('force')) {
                $skipped++;
                continue;
            }

            Article::updateOrCreate(
                ['source_url' => $sourceUrl],
                [
                    'title' => $title,
                    'slug' => $slug,
                    'content' => $content,
                    'published_at' => $publishedAt ? Carbon::parse($publishedAt) : null,
                    'is_generated' => false,
                    'parent_id' => null,
                    'citations' => null,
                ]
            );

            $created++;
        }

        $this->info("Stored {$created} articles, skipped {$skipped}.");
        return self::SUCCESS;
    }
}
