<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ArticleController;

Route::get('/articles/latest', [ArticleController::class, 'latest']);
Route::apiResource('articles', ArticleController::class);
