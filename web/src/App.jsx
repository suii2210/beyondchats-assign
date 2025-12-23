import { useEffect, useMemo, useState } from 'react';
import { fetchArticles } from './api';

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function truncate(text, max = 260) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatDate(value) {
  if (!value) return 'Unscheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unscheduled' : date.toLocaleDateString();
}

function ArticleCard({ article, variant, parentTitle, delay }) {
  const preview = truncate(stripHtml(article.content || ''));

  return (
    <article className={`card card--${variant}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="card__header">
        <span className="tag">{variant === 'original' ? 'Original' : 'Updated'}</span>
        {parentTitle ? <span className="tag tag--ghost">From {parentTitle}</span> : null}
      </div>
      <h3>{article.title}</h3>
      <p className="card__meta">
        {formatDate(article.published_at)}
        {article.source_url ? (
          <span>
            <span className="dot" />
            <a href={article.source_url} target="_blank" rel="noreferrer">
              Source
            </a>
          </span>
        ) : null}
      </p>
      <p className="card__preview">{preview || 'No content available.'}</p>
      {article.citations?.length ? (
        <div className="card__references">
          <span>References</span>
          <ul>
            {article.citations.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default function App() {
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchArticles()
      .then((data) => {
        if (!mounted) return;
        setArticles(Array.isArray(data) ? data : []);
        setStatus('ready');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Failed to load articles.');
        setStatus('error');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const originals = useMemo(
    () => articles.filter((item) => !item.is_generated),
    [articles],
  );
  const updates = useMemo(
    () => articles.filter((item) => item.is_generated),
    [articles],
  );

  const originalById = useMemo(() => {
    return new Map(originals.map((item) => [item.id, item]));
  }, [originals]);

  const latest = useMemo(() => {
    return articles
      .slice()
      .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))[0];
  }, [articles]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__content">
          <p className="eyebrow">BeyondChats Knowledge Studio</p>
          <h1>Original insights, refreshed for the rankings.</h1>
          <p className="subtitle">
            Browse the earliest BeyondChats articles alongside AI-refined updates
            shaped by what currently ranks on Google.
          </p>
          <div className="meta">
            <div>
              <span className="meta__label">Originals</span>
              <strong>{originals.length}</strong>
            </div>
            <div>
              <span className="meta__label">Updates</span>
              <strong>{updates.length}</strong>
            </div>
          </div>
        </div>
        <div className="hero__panel">
          <div className="hero__panel-inner">
            <p className="panel__label">Latest article</p>
            <h2>{latest ? latest.title : 'Loading articles...'}</h2>
            <p className="panel__preview">
              {latest ? truncate(stripHtml(latest.content || ''), 180) : 'Fetching content.'}
            </p>
            {latest?.source_url ? (
              <a className="panel__link" href={latest.source_url} target="_blank" rel="noreferrer">
                View original source
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <main className="main">
        {status === 'error' ? <p className="error">{error}</p> : null}
        {status === 'loading' ? <p className="loading">Loading articles...</p> : null}

        <section className="section">
          <div className="section__header">
            <h2>Original Articles</h2>
            <p>Directly scraped from the oldest BeyondChats blog posts.</p>
          </div>
          <div className="grid">
            {originals.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="original"
                delay={index * 80}
              />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section__header">
            <h2>Updated Versions</h2>
            <p>Recrafted with structure and style signals from top-ranking posts.</p>
          </div>
          <div className="grid">
            {updates.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                parentTitle={originalById.get(article.parent_id)?.title}
                variant="update"
                delay={index * 80}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
