const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export async function fetchArticles() {
  const res = await fetch(`${API_BASE_URL}/articles`);
  if (!res.ok) {
    throw new Error('Failed to load articles.');
  }
  return res.json();
}
