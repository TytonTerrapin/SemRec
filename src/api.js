const HF_BASE = 'https://tytonterrapin-fine-tuned-semantic-movie-recommen-22f16c2.hf.space';
const TMDB_KEY = 'd40c03000a8ca51da2011456878dbd25';
const TMDB_BASE = 'https://api.themoviedb.org/3/movie';

const tmdbCache = new Map();

export function safeParseList(item) {
  if (Array.isArray(item)) return item;
  if (typeof item === 'string') {
    try { return JSON.parse(item); } catch { return item.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return [];
}

export async function searchMovies(query, isAutocomplete = false, filters = {}) {
  try {
    const topK = isAutocomplete ? 5 : 20;
    const url = new URL(`${HF_BASE}/search`);
    url.searchParams.append('q', query);
    url.searchParams.append('top_k', topK);

    // Apply Filters
    if (filters.genre) url.searchParams.append('genre', filters.genre);
    if (filters.lang) url.searchParams.append('lang', filters.lang);
    if (filters.min_year) url.searchParams.append('min_year', filters.min_year);
    if (filters.max_year) url.searchParams.append('max_year', filters.max_year);
    if (filters.min_votes) url.searchParams.append('min_votes', filters.min_votes);
    if (filters.neg_lambda) url.searchParams.append('neg_lambda', filters.neg_lambda);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000); 

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Search request failed');
    return await res.json();
  } catch (err) {
    console.error('Search error:', err);
    throw err;
  }
}

export async function getSimilarMovies(movieId) {
  try {
    const url = `${HF_BASE}/similar/${movieId}?top_k=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Similar search failed');
    return await res.json();
  } catch (err) {
    console.error('Similar error:', err);
    return null;
  }
}

export async function fetchTMDBData(movieId) {
  if (tmdbCache.has(movieId)) return tmdbCache.get(movieId);
  try {
    const url = `${TMDB_BASE}/${movieId}?api_key=${TMDB_KEY}&append_to_response=credits,videos`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    tmdbCache.set(movieId, data);
    return data;
  } catch (err) {
    console.error('TMDB fetch error:', err);
    return null;
  }
}

export async function fetchPopularPosters() {
  try {
    const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&page=1`;
    const res = await fetch(url);
    if(!res.ok) return [];
    const data = await res.json();
    return data.results.map(m => m.poster_path).filter(Boolean);
  } catch(e) {
    return [];
  }
}

export function getPosterUrl(path, size = 'w342') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getBackdropUrl(path, size = 'w780') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchTMDBByTitle(query) {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results.slice(0, 8).map(m => ({
       movie_id: m.id,
       title: m.title,
       year: m.release_date ? m.release_date.substring(0,4) : '',
       overview: m.overview
    }));
  } catch (err) {
    return [];
  }
}
