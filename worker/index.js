import 'dotenv/config';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';


  
const BLOCKED_HOSTS = new Set([
  'webcache.googleusercontent.com',
  'accounts.google.com',
  'support.google.com',
  'policies.google.com',
  'maps.google.com',
  'translate.google.com',
  'news.google.com',
]);

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function fetchHtml(url) {
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch HTML (${res.status}): ${url}`);
  }

  return res.text();
}

function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function normalizeUrl(url) {
  try {
    return new URL(url).toString();
  } catch (error) {
    return null;
  }
}

function isExternalUrl(candidate, originalUrl) {
  try {
    const candidateHost = new URL(candidate).hostname.replace(/^www\./, '');

    if (BLOCKED_HOSTS.has(candidateHost)) return false;
    if (!originalUrl) return true;

    const originalHost = new URL(originalUrl).hostname.replace(/^www\./, '');
    return candidateHost !== originalHost;
  } catch (error) {
    return false;
  }
}

function isProbablyArticleUrl(url) {
  if (/\.(pdf|jpg|jpeg|png|gif|webp|zip)$/i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length >= 2;
  } catch (error) {
    return false;
  }
}

async function searchGoogle(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`;
  const html = await fetchHtml(searchUrl);
  const $ = cheerio.load(html);
  const links = [];

  $('a').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    const match = href.match(/^\/url\?q=([^&]+)/);
    if (!match) return;

    const decoded = decodeURIComponent(match[1]);
    const normalized = normalizeUrl(decoded);
    if (normalized) links.push(normalized);
  });

  return dedupeUrls(links);
}

function extractHeadings(html, limit = 10) {
  const $ = cheerio.load(html || '');
  const headings = [];

  $('h1, h2, h3').each((_, element) => {
    const text = $(element).text().trim();
    if (text) headings.push(text);
  });

  return headings.slice(0, limit);
}

async function extractReadableArticle(url) {
  const html = await fetchHtml(url);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent) return null;
  if (article.textContent.trim().length < 800) return null;

  return {
    url,
    title: article.title || 'Untitled',
    contentHtml: article.content || '',
    textContent: article.textContent || '',
  };
}

function truncateText(text, maxChars) {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

async function rewriteArticle(original, references) {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment.');
  }

  const referenceSummaries = references
    .map((ref, index) => {
      const headings = extractHeadings(ref.contentHtml).join('; ');
      return `Reference ${index + 1}:
Title: ${ref.title}
URL: ${ref.url}
Headings: ${headings || 'n/a'}
Content: ${truncateText(ref.textContent, 4000)}`;
    })
    .join('\n\n');

  const prompt = `Original article title: ${original.title}
Original article HTML:
${truncateText(original.content, 6000)}

${referenceSummaries}

Rewrite the original article so the tone, structure, and formatting feel closer to the reference articles while preserving the original topic and facts. Use semantic HTML with headings, paragraphs, and lists. Do not add citations or a references section; that will be appended later.

Return a JSON object with keys "title" and "content_html".`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL,
    )}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are a careful editor who rewrites articles to match the style of high-ranking posts without inventing facts.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const messageContent =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join('') || '';

  const parsed = safeJsonParse(messageContent);
  if (parsed && parsed.content_html) {
    return {
      title: parsed.title || original.title,
      contentHtml: parsed.content_html,
    };
  }

  return {
    title: original.title,
    contentHtml: messageContent,
  };
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function appendCitations(html, urls) {
  const unique = dedupeUrls(urls);
  const list = unique
    .map((url) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></li>`)
    .join('');

  return `${html}\n<hr />\n<h3>References</h3>\n<ul>${list}</ul>`;
}

async function publishArticle(original, rewritten, citations) {
  const payload = {
    title: rewritten.title || `${original.title} (Updated)`,
    content: appendCitations(rewritten.contentHtml, citations),
    source_url: original.source_url || null,
    published_at: new Date().toISOString(),
    is_generated: true,
    parent_id: original.id,
    citations,
  };

  return fetchJson(`${API_BASE_URL}/articles`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function main() {
  const latest = await fetchJson(`${API_BASE_URL}/articles/latest`);
  const query = latest.title;

  const searchResults = await searchGoogle(query);
  const candidates = searchResults.filter((link) => {
    if (!isExternalUrl(link, latest.source_url || '')) return false;
    return isProbablyArticleUrl(link);
  });

  const references = [];
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const article = await extractReadableArticle(candidate);
      if (article) references.push(article);
      if (references.length === 2) break;
    } catch (error) {
      // Skip unreadable pages.
    }
  }

  if (references.length < 2) {
    throw new Error('Could not find two readable reference articles.');
  }

  const rewritten = await rewriteArticle(latest, references);
  const published = await publishArticle(
    latest,
    rewritten,
    references.map((ref) => ref.url),
  );

  console.log('Published updated article:', published.id);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
