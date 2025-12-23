# BeyondChats API (Laravel)

This folder contains the Laravel API implementation for BeyondChats articles.
If you do not already have the standard Laravel boilerplate files here (artisan,
bootstrap/, config/), scaffold them with `composer create-project laravel/laravel api`
and keep the custom files in this repo.

## Setup

1. Install PHP 8.1+ and Composer.
2. Install dependencies:

```bash
composer install
```

3. Create an `.env` file from `.env.example` and configure the database.
4. Run migrations:

```bash
php artisan migrate
```

5. Scrape the 5 oldest BeyondChats blog posts:

```bash
php artisan scrape:beyondchats
```

## Endpoints

- `GET /api/articles`
- `GET /api/articles/latest`
- `GET /api/articles/{id}`
- `POST /api/articles`
- `PUT /api/articles/{id}`
- `DELETE /api/articles/{id}`

Query filters for `GET /api/articles`:
- `is_generated=true|false`
- `parent_id=<id>`
- `q=<search>`
