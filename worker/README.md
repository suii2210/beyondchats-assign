# BeyondChats Worker

Node script that fetches the latest article from the Laravel API, finds two external reference articles on Google, rewrites the content using an LLM, and publishes the updated article back to the API.

## Setup

```bash
npm install
```

Create `.env` from `.env.example` and configure:
- `API_BASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Run

```bash
npm start
```
