import { fetchTMDBData, getPosterUrl, getSimilarMovies } from './api.js';
import { Store } from './store.js';

let historyStack = [];
let isNavigatingBack = false;

export function renderNegationTerms(terms) {
  const container = document.getElementById('query-debug-container');
  container.innerHTML = '';
  if (!terms || terms.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  const label = document.createElement('span');
  label.textContent = 'Model Excluded: ';
  label.style.color = 'var(--text-muted)';
  container.appendChild(label);
  
  terms.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = '✕ ' + t;
    container.appendChild(chip);
  });
}

function getRerankColorClass(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'med';
  return '';
}

export function createMovieCard(movie, onClick) {
  const div = document.createElement('div');
  div.className = 'movie-card';
  div.innerHTML = `
    <div class="card-poster" id="poster-${movie.movie_id}"></div>
    <div class="card-overlay">
      <h3 class="card-title">${movie.title}</h3>
      <div class="card-meta">
        <span>${movie.year || movie.release_date?.substring(0,4) || ''}</span>
      </div>
    </div>
  `;
  
  div.addEventListener('click', () => onClick(movie, div));

  fetchTMDBData(movie.movie_id).then(tData => {
    const pContainer = div.querySelector(`#poster-${movie.movie_id}`);
    if (tData && tData.poster_path) {
      const img = new Image();
      img.src = getPosterUrl(tData.poster_path, 'w500');
      img.alt = movie.title;
      img.className = 'card-poster';
      img.onload = () => pContainer.replaceWith(img);
    } else {
      pContainer.innerHTML = `<div style="display:flex; height:100%; width:100%; align-items:center; justify-content:center; padding:1rem; text-align:center; color:rgba(255,255,255,0.2); font-weight:bold">${movie.title}</div>`;
    }
  });
  return div;
}

export function renderResults(results, count, query, containerElement, onClickHandler, prepend = false) {
  if (!prepend) containerElement.innerHTML = '';

  if (!results || results.length === 0) {
    if(!prepend) containerElement.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No movies found.</p>';
    return;
  }

  results.forEach(movie => {
    if (prepend) {
      containerElement.prepend(createMovieCard(movie, onClickHandler));
    } else {
      containerElement.appendChild(createMovieCard(movie, onClickHandler));
    }
  });
}

export function renderAutocomplete(results, listElement, onSelectCallback) {
    listElement.innerHTML = '';
    if (!results || results.length === 0) { listElement.classList.add('hidden'); return; }
    results.forEach(movie => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="ac-title">${movie.title}</span><span class="ac-meta">${movie.year || ''}</span>`;
        li.addEventListener('click', () => onSelectCallback(movie));
        listElement.appendChild(li);
    });
    listElement.classList.remove('hidden');
}

export async function renderInlineRecommendations(movie, clickedCardElement, onCardClick) {
  // Navigation Tracking
  if (!isNavigatingBack) {
    // Only push if it's not the same movie as the top of stack
    if (historyStack.length === 0 || historyStack[historyStack.length - 1].movie_id !== movie.movie_id) {
       historyStack.push(movie);
    }
  }
  isNavigatingBack = false;

  const callback = onCardClick || renderInlineRecommendations;
  const existing = document.querySelector('.inline-recs');
  
  // DETECT ANCHOR
  let anchor = clickedCardElement;
  if (existing && existing.contains(clickedCardElement)) {
    anchor = existing.previousElementSibling;
  }

  if (existing) existing.remove();

  const inlineContainer = document.createElement('div');
  inlineContainer.className = 'inline-recs';
  inlineContainer.innerHTML = `<div style="text-align:center;"><div class="spinner"></div><p style="color:var(--accent)">Analyzing vectors...</p></div>`;
  
  anchor.insertAdjacentElement('afterend', inlineContainer);
  
  // Scroll to top of the new detail view
  inlineContainer.scrollTop = 0;
  
  // Fetch parallel to UI transition
  const [tData, similarRes] = await Promise.all([
    fetchTMDBData(movie.movie_id),
    getSimilarMovies(movie.movie_id)
  ]);

  const isOpenBook = similarRes && similarRes.input_document;

  // Score Explainer Component
  const explainerHtml = `
    <div class="score-explainer">
       <div class="explainer-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          Recommendation Math ${isOpenBook ? '<span class="badge-enhanced">Vector Insight</span>' : ''}
       </div>
       <div class="explainer-bar-bg">
         <div class="bar-chunk c-sem" style="width: 75%" title="75% Semantic Context"></div>
         <div class="bar-chunk c-pop" style="width: 15%" title="15% Popularity"></div>
         <div class="bar-chunk c-vot" style="width: 10%" title="10% Vote Average"></div>
       </div>
       <div class="explainer-legend">
         <div class="legend-item"><div class="legend-dot c-sem"></div> Semantic Match (75%)</div>
         <div class="legend-item"><div class="legend-dot c-pop"></div> TMDB Popularity (15%)</div>
         <div class="legend-item"><div class="legend-dot c-vot"></div> Rating Average (10%)</div>
       </div>
    </div>
  `;

  const overview = movie.overview || (tData ? tData.overview : '');
  const pUrl = tData && tData.poster_path ? getPosterUrl(tData.poster_path, 'w780') : null;
  const backUrl = tData && tData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tData.backdrop_path}` : pUrl;
  const posterTag = pUrl ? `<img src="${pUrl}" class="inline-source-poster" />` : `<div class="inline-source-poster" style="background:#111"></div>`;

  let taglineHtml = '';
  let genresHtml = '';
  let metaGridHtml = '';
  let trailerButtonHtml = '';
  let trailerKey = null;

  if (tData) {
    if (tData.tagline) taglineHtml = `<div class="movie-tagline">“${tData.tagline}”</div>`;
    if (tData.genres && tData.genres.length > 0) {
      genresHtml = tData.genres.slice(0, 4).map(g => `<span class="genre-pill">${g.name}</span>`).join('');
    }

    let director = 'Unknown';
    let cast = 'Unknown';
    if (tData.credits) {
      const d = tData.credits.crew.find(c => c.job === 'Director');
      if (d) director = d.name;
      if (tData.credits.cast && tData.credits.cast.length > 0) {
        cast = tData.credits.cast.slice(0, 4).map(c => c.name).join(', ');
      }
    }

    const formatCurrency = (val) => val ? `$${(val/1000000).toFixed(1)}M` : 'N/A';
    metaGridHtml = `
      <div class="meta-grid">
        <div class="meta-grid-item">
          <span class="meta-grid-label">Director</span>
          <span class="meta-grid-value">${director}</span>
        </div>
        <div class="meta-grid-item">
          <span class="meta-grid-label">Starring</span>
          <span class="meta-grid-value">${cast}</span>
        </div>
        <div class="meta-grid-item">
          <span class="meta-grid-label">Box Office</span>
          <span class="meta-grid-value">Budget: ${formatCurrency(tData.budget)} / Rev: ${formatCurrency(tData.revenue)}</span>
        </div>
        <div class="meta-grid-item">
          <span class="meta-grid-label">Global Rating</span>
          <span class="meta-grid-value">★ ${tData.vote_average ? tData.vote_average.toFixed(1) : 'N/A'} / 10</span>
        </div>
      </div>
    `;

    if (tData.videos && tData.videos.results) {
      const tr = tData.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (tr) {
         trailerKey = tr.key;
         trailerButtonHtml = `<button id="play-trailer-btn" class="nav-btn" style="border-color: #6c5ce7; color: #fff;">▶ Watch Trailer</button>`;
      }
    }
  }

  let shelfHtml = '';
  if (similarRes && similarRes.results && similarRes.results.length > 0) {
      shelfHtml = `<div class="inline-shelf" id="inline-shelf-container"></div>`;
  } else {
      shelfHtml = `<p style="color:var(--text-muted)">No similar recommendations found in database.</p>`;
  }

  inlineContainer.innerHTML = `
    <div class="inline-bg" style="background-image: url('${backUrl || ''}')"></div>
    <div class="inline-recs-content">
      <div class="inline-recs-header">
        <div id="poster-replace-target" style="transition: width 0.4s ease;">
          ${posterTag}
        </div>
        <div class="inline-source-info">
          <h3>${movie.title}</h3>
          ${taglineHtml}
          <div class="inline-meta">
            <span>${movie.year || movie.release_date?.substring(0,4) || ''}</span>
            ${tData?.runtime ? `<span>• ${tData.runtime}m</span>` : ''}
            ${genresHtml}
          </div>
          <p>${overview}</p>
          
          ${metaGridHtml}

          <!-- Injecting the requested explainer -->
          ${explainerHtml}

          <div style="display:flex; gap:1rem; margin-top:1.5rem">
            <button id="inline-watchlist-btn" class="nav-btn" style="border-color:var(--accent)">
              ${Store.isInWatchlist(movie.movie_id) ? '✓ Added to Watchlist' : '+ Add to Watchlist'}
            </button>
            ${trailerButtonHtml}
          </div>
        </div>
      </div>
      ${shelfHtml}
    </div>
    
    <div class="nav-cluster">
      ${historyStack.length > 1 ? `<button id="back-inline-btn" class="nav-btn back-floating-btn">← Back</button>` : ''}
      <button id="close-inline-btn" class="nav-btn close-floating-btn">Exit to Home ✕</button>
    </div>
  `;

  document.body.style.overflow = 'hidden';

  if (trailerKey) {
    const playBtn = inlineContainer.querySelector('#play-trailer-btn');
    playBtn.addEventListener('click', () => {
       const target = inlineContainer.querySelector('#poster-replace-target');
       target.style.width = '520px';
       target.style.minWidth = '520px';
       target.innerHTML = `<iframe class="trailer-embed" src="https://www.youtube.com/embed/${trailerKey}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
       playBtn.style.display = 'none';
    });
  }

  // Watchlist Toggle
  inlineContainer.querySelector('#inline-watchlist-btn').addEventListener('click', (e) => {
      const added = Store.toggleWatchlist(movie);
      e.target.textContent = added ? '✓ Added to Watchlist' : '+ Add to Watchlist';
      document.getElementById('watchlist-count').textContent = Store.getWatchlistCount();
  });

  // Search for back button
  const backBtn = inlineContainer.querySelector('#back-inline-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
       historyStack.pop(); // Remove current
       const prevMovie = historyStack.pop(); // Get previous
       isNavigatingBack = true;
       // Re-trigger with same anchor
       renderInlineRecommendations(prevMovie, anchor, onCardClick);
    });
  }

  inlineContainer.querySelector('#close-inline-btn').addEventListener('click', () => {
      historyStack = []; // Reset history
      inlineContainer.remove();
      if (!document.querySelector('.inline-recs')) {
          document.body.style.overflow = '';
      }
  });

  // Populate shelf
  if(similarRes && similarRes.results) {
      const shelf = inlineContainer.querySelector('#inline-shelf-container');
      if(!shelf) return;
      
      similarRes.results.forEach(sim => {
          if (sim.movie_id === movie.movie_id) return;
          const card = document.createElement('div');
          card.className = 'shelf-card';
          
          card.innerHTML = `<div class="shelf-poster" id="shelf-poster-${sim.movie_id}"></div><div class="shelf-title">${sim.title}</div>`;
          card.addEventListener('click', () => callback(sim, card, callback));
          shelf.appendChild(card);

          fetchTMDBData(sim.movie_id).then(td => {
             const pDiv = card.querySelector(`#shelf-poster-${sim.movie_id}`);
             if(td && td.poster_path) {
                 const im = new Image();
                 im.className = 'shelf-poster';
                 im.src = getPosterUrl(td.poster_path, 'w342');
                 im.onload = () => pDiv.replaceWith(im);
             } else {
                 pDiv.innerHTML = `<div style="padding:10px;text-align:center;font-size:0.7rem;">${sim.title}</div>`;
             }
          });
      });
  }
}

export function renderWatchlist(movies, containerElement, onCardClick) {
  containerElement.innerHTML = '';
  
  if (!movies || movies.length === 0) {
    containerElement.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 4rem 2rem; background: var(--panel-bg); border-radius: 16px; border: 1px dashed var(--panel-border);">
        <p style="color: var(--text-muted); font-size: 1.1rem;">Your watchlist is empty.</p>
        <p style="color: var(--accent); margin-top: 0.5rem; cursor: pointer;" onclick="document.querySelector('.logo').click()">Go discover some movies!</p>
      </div>
    `;
    return;
  }

  movies.forEach(movie => {
    containerElement.appendChild(createMovieCard(movie, onCardClick));
  });
}
