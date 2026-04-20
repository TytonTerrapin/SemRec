const WATCHLIST_KEY = 'semantic_rec_watchlist';

export const Store = {
  getWatchlist() {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  isInWatchlist(movieId) {
    return this.getWatchlist().some(m => m.movie_id === movieId);
  },

  toggleWatchlist(movie) {
    let list = this.getWatchlist();
    if (this.isInWatchlist(movie.movie_id)) {
      list = list.filter(m => m.movie_id !== movie.movie_id);
    } else {
      list.push(movie);
    }
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    return this.isInWatchlist(movie.movie_id);
  },

  getWatchlistCount() {
    return this.getWatchlist().length;
  }
};
