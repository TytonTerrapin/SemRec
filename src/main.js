import { searchMovies, searchTMDBByTitle, fetchPopularPosters, getPosterUrl } from './api.js';
import { Store } from './store.js';
import { renderResults, renderNegationTerms, renderAutocomplete, renderInlineRecommendations } from './ui.js';

let debounceTimeout;

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initLandingMosaic();

  const landingIntro = document.getElementById('landing-intro');
  const appCore = document.getElementById('app-core');

  // Handle Landing Page Entrance
  document.querySelectorAll('.launch-app-btn').forEach(btn => {
    btn.addEventListener('click', () => {
       landingIntro.style.opacity = '0';
       setTimeout(() => {
         landingIntro.classList.add('hidden');
         appCore.classList.remove('hidden');
         
         const targetView = btn.dataset.target;
         document.querySelector(`.nav-tab[data-view="${targetView}"]`).click();
         
         // Only init catalog once they actually enter
         if(targetView === 'view-home' && !document.querySelector('.movie-card')) {
             initCatalog();
         }
       }, 500); // Wait for CSS fade out
    });
  });

  const semanticInput = document.getElementById('semantic-input');
  const semanticBtn = document.getElementById('semantic-btn');
  const movieInput = document.getElementById('movie-input');
  const autocompleteList = document.getElementById('autocomplete-list');
  const filterToggle = document.getElementById('filter-toggle');
  const filterDrawer = document.getElementById('filter-drawer');

  document.getElementById('watchlist-count').textContent = Store.getWatchlistCount();

  // Mode B: Movie Search Autocomplete
  movieInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length < 2) { autocompleteList.classList.add('hidden'); return; }
    
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      try {
        const results = await searchTMDBByTitle(val);
        renderAutocomplete(results, autocompleteList, (movie) => {
          movieInput.value = '';
          autocompleteList.classList.add('hidden');
          triggerMovieSelection(movie);
        });
      } catch (err) { console.error(err); }
    }, 400);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#movie-search-box')) autocompleteList.classList.add('hidden');
  });

  // Target a movie manually from the hero
  function triggerMovieSelection(movie) {
    const grid = document.getElementById('catalog-grid');
    // Prepend this movie to the grid
    renderResults([movie], null, null, grid, handleCardClick, true);
    // Programmatically click it
    setTimeout(() => {
      const firstCard = grid.querySelector('.movie-card');
      if(firstCard) handleCardClick(movie, firstCard);
    }, 100);
  }

  // Handle clicking ANY card in our system
  function handleCardClick(movie, cardElement) {
    renderInlineRecommendations(movie, cardElement, handleCardClick);
  }

  // --- SEMANTIC SEARCH TAB ---
  filterToggle.addEventListener('click', () => {
    filterDrawer.classList.toggle('hidden');
    filterToggle.textContent = filterDrawer.classList.contains('hidden') ? 'Advanced Filters ▼' : 'Hide Filters ▲';
  });

  function getFilters() {
    return {
      genre: document.getElementById('flt-genre').value.trim(),
      lang: document.getElementById('flt-lang').value.trim(),
      min_year: document.getElementById('flt-min-year').value.trim(),
      max_year: document.getElementById('flt-max-year').value.trim(),
      min_votes: document.getElementById('flt-min-votes').value.trim(),
      neg_lambda: document.getElementById('flt-neg').value.trim()
    };
  }

  async function triggerSemanticSearch() {
    const query = semanticInput.value.trim();
    if (!query) return;

    document.getElementById('query-debug-container').classList.add('hidden');
    document.getElementById('semantic-results-area').classList.add('hidden');
    document.getElementById('semantic-loading').classList.remove('hidden');

    try {
      const res = await searchMovies(query, false, getFilters());
      document.getElementById('semantic-loading').classList.add('hidden');
      renderNegationTerms(res.query_debug?.negative_terms || []);
      
      const grid = document.getElementById('semantic-grid');
      document.getElementById('semantic-results-title').textContent = `Results for "${query}"`;
      document.getElementById('semantic-results-meta').textContent = `${res.count} matches`;
      document.getElementById('semantic-results-area').classList.remove('hidden');
      
      renderResults(res.results, res.count, query, grid, handleCardClick);
    } catch(e) {
      document.getElementById('semantic-loading').classList.add('hidden');
      document.getElementById('semantic-grid').innerHTML = `<p style="text-align:center">Error: ${e.message}</p>`;
    }
  }

  semanticBtn.addEventListener('click', triggerSemanticSearch);
  semanticInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') triggerSemanticSearch();
  });
});

// App routing / tabs
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const views = document.querySelectorAll('.dynamic-view');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.dataset.view;
      
      views.forEach(v => {
        if(v.id === targetId) {
          v.classList.remove('hidden-view');
          v.classList.add('active-view');
        } else {
          v.classList.add('hidden-view');
          v.classList.remove('active-view');
        }
      });
    });
  });
}

// Ensure the trending catalog actually exists in our embedding DB
async function initCatalog() {
  document.getElementById('catalog-loading').classList.remove('hidden');
  try {
    // Removed strict filters that were prematurely capping the results
    const res = await searchMovies('epic award winning blockbuster masterpiece', false, {});
    document.getElementById('catalog-loading').classList.add('hidden');
    
    // Shuffle the results slightly for freshness
    const shuffled = res.results.sort(() => 0.5 - Math.random()).slice(0, 16);
    const grid = document.getElementById('catalog-grid');
    
    renderResults(shuffled, null, null, grid, (movie, el) => {
        // use UI.js inline render
        import('./ui.js').then(ui => ui.renderInlineRecommendations(movie, el, ui.renderInlineRecommendations));
    });
  } catch (e) {
    document.getElementById('catalog-loading').innerHTML = `<p style="color:var(--accent)">Failed to wake backend. Please try reloading.</p>`;
  }
}

async function initLandingMosaic() {
  const bg = document.getElementById('landing-mosaic');
  if(!bg) return;
  
  const paths = await fetchPopularPosters();
  if(!paths || paths.length === 0) return;

  // We want a large grid filler, duplicate if necessary to fill the whole screen gracefully
  let combined = [...paths, ...paths, ...paths].sort(() => 0.5 - Math.random()).slice(0, 72);
  
  combined.forEach((path) => {
    const img = document.createElement('img');
    img.className = 'mosaic-img';
    img.src = getPosterUrl(path, 'w154');
    bg.appendChild(img);
    img.onload = () => {
      setTimeout(() => img.classList.add('loaded'), Math.random() * 2000 + 300);
    };
  });
}
