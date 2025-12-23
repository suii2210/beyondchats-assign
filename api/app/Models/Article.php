<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'content',
        'source_url',
        'published_at',
        'is_generated',
        'parent_id',
        'citations',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'is_generated' => 'boolean',
        'citations' => 'array',
    ];

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function updates()
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
