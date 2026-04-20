# SemRec: Semantic Movie Recommender

SemRec is a high-performance, single-page web application that serves as the frontend for a deep-learning powered movie recommendation engine. Rather than relying entirely on matching basic genres or actors, it leverages **FAISS vector embeddings** and **Natural Language Processing (NLP)** via a fine-tuned Hugging Face backend. This allows users to search for the *exact cinematic vibe, concept, or plot structure* they want using natural text.

## Core Features

- **Semantic Vibe Search:** Look up movies by describing them naturally (e.g., *"slow burn sci-fi thriller but no gore"*).
- **Steerable Negation:** Built-in NLP negation engine that understands what you *don't* want to see and mathematically repels those concepts out of your results.
- **Dynamic Trending Catalog**: A pre-loaded visual mosaic populated with guaranteed high-quality, popular movies that exist in our custom vector index.
- **Deep TMDB Integration:** Netflix-style lexical autocomplete, fetching of rich metadata (budgets, global ratings, exact credits), and dynamic inline-streaming official YouTube Trailers without ever leaving the semantic layout.

## Tech Stack

- **Frontend Core:** Vanilla JavaScript (ESModules)
- **Styling:** Custom CSS featuring responsive glassmorphism, contextual ambient glow lights, and CSS grids.
- **Build Tool:** [Vite](https://vitejs.dev/) for blazing-fast HMR and optimized production bundling.
- **Search Backend:** FastAPI integrating `sentence-transformers` and `faiss-cpu`, deployed as a Hugging Face Space.
  - **API Documentation**: [Interactive Swagger UI](https://tytonterrapin-fine-tuned-semantic-movie-recommen-22f16c2.hf.space/docs)

## Running Locally

Because this project uses modular architecture (`import/export`), it requires a local web server to run securely. We recommend using Vite.

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173/` or whatever port Vite provides.

## Architecture & Logic

A detailed breakdown of the machine learning pipeline, including embeddings, reranking, and query chunking, can be found in [ML_ARCHITECTURE.md](./ML_ARCHITECTURE.md).


- `index.html`: The monolithic view containing our tab-switchable Single Page UI blocks (the Landing Overlay, Home View, and Semantic View).
- `src/main.js`: Core bootstrapping layer. Handles URL fetching logic, initialization of the movie grids, and tab routing.
- `src/api.js`: The stateless network abstraction holding mappings to both TMDB (`/search/movie`, `/movie/popular`) and our Hugging Face backend (`/search`, `/similar`). Implements deduplication caches mapped against API load limits.
- `src/ui.js`: Massive DOM-builder responsible for rendering `.movie-card`s, and the interactive, full-screen `.inline-recs` expansion panels complete with metadata parsing and YouTube iframe embedding.
- `src/store.js`: Micro-store for persisting user states locally across reloads (like the persistent User Watchlist).

## Future Capabilities

Because SemRec operates on an embedded vector space, future iterations can easily hook into a User Registration system to generate *User Embeddings*. Once we calculate the mathematical mean across a user's Watchlist, personalized recommendations become instantaneous zero-shot cosine calculations relative to the entire movie database.
