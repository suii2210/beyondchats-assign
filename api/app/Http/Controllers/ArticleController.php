<?php

namespace App\Http\Controllers;

use App\Models\Article;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ArticleController extends Controller
{
    public function index(Request $request)
    {
        $query = Article::query();

        if ($request->filled('is_generated')) {
            $query->where('is_generated', filter_var($request->input('is_generated'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('parent_id')) {
            $query->where('parent_id', $request->integer('parent_id'));
        }

        if ($request->filled('q')) {
            $query->where('title', 'like', '%' . $request->input('q') . '%');
        }

        $articles = $query
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();

        return response()->json($articles);
    }

    public function show(Article $article)
    {
        return response()->json($article);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'content' => 'required|string',
            'source_url' => 'nullable|url|max:2048',
            'published_at' => 'nullable|date',
            'is_generated' => 'sometimes|boolean',
            'parent_id' => 'nullable|exists:articles,id',
            'citations' => 'nullable|array',
            'citations.*' => 'url|max:2048',
        ]);

        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['title']);
        }

        $article = Article::create($data);

        return response()->json($article, 201);
    }

    public function update(Request $request, Article $article)
    {
        $data = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'content' => 'sometimes|required|string',
            'source_url' => 'nullable|url|max:2048',
            'published_at' => 'nullable|date',
            'is_generated' => 'sometimes|boolean',
            'parent_id' => 'nullable|exists:articles,id',
            'citations' => 'nullable|array',
            'citations.*' => 'url|max:2048',
        ]);

        if (array_key_exists('title', $data) && empty($data['slug'])) {
            $data['slug'] = Str::slug($data['title']);
        }

        $article->fill($data);
        $article->save();

        return response()->json($article);
    }

    public function destroy(Article $article)
    {
        $article->delete();

        return response()->json(null, 204);
    }

    public function latest()
    {
        $article = Article::orderByDesc('published_at')
            ->orderByDesc('id')
            ->firstOrFail();

        return response()->json($article);
    }
}
