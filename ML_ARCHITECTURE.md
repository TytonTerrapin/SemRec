# Machine Learning & Search Architecture

This document provides a technical deep-dive into the backend engine that powers SemRec's semantic search and recommendation capabilities, based on the GPU-optimized training pipeline.

## 1. Embedding Model & Fine-Tuning
The core of the system is a **Sentence-Transformers** model, specifically optimized for high-speed retrieval.
- **Base Model**: `sentence-transformers/all-MiniLM-L6-v2`. This is a lightweight (22M parameter) yet powerful model that produces **384-dimensional** embeddings.
- **Loss Function**: `MultipleNegativesRankingLoss` (MNRL). This loss function is ideal for training retrieval models where only positive pairs are available, as it treats other items in the batch as "in-batch negatives."
- **Temperature Scaling**: A scale factor of `20.0` (equivalent to a Softmax temperature of $\tau = 0.05$) is applied during loss calculation to sharpen the probability distribution and improve contrastive learning.
- **Precision**: The model is trained using **Mixed Precision (FP16)** via `torch.cuda.amp`, which significantly speeds up training on NVIDIA GPUs (like the Tesla T4) while reducing memory footprint.

## 2. GPU-Optimized Infrastructure
The training pipeline is engineered for maximum throughput on modern hardware:
- **Asynchronous Data Handling**: Uses `pin_memory=True` and `non_blocking=True` to overlap CPU-to-GPU data transfers with model computation.
- **Memory Management**: Employs `optimizer.zero_grad(set_to_none=True)` and `persistent_workers=True` in the DataLoader to minimize overhead between batches and epochs.
- **Hardware Acceleration**: Enables **TF32 (TensorFloat-32)** on Ampere-architecture GPUs (A100, RTX 30xx/40xx) and utilizes `cudnn.benchmark` for auto-tuning specialized convolution/matrix-multiplication kernels.

## 3. Vector Indexing with FAISS
To handle real-time searches across the movie database, we utilize **FAISS (Facebook AI Similarity Search)**.
- **Index Type**: `IndexFlatIP` (Inner Product).
- **Metric**: Because our embeddings are **L2-normalized**, the Inner Product is mathematically equivalent to **Cosine Similarity**.
- **Search Efficiency**: The model encodes 26,000+ movies in roughly 1 minute on a T4 GPU, creating a high-fidelity vector space where semantic neighbors can be retrieved in milliseconds.

## 4. Advanced Query Logic & Negation
The search engine employs a rule-based **Query Parser** that separates user intent into positive and negative components:
- **Positive Intent**: The "residual" query after stripping hedges (e.g., *"give me a movie about"*, *"find me something like"*) and negation clauses.
- **Negative Exclusions**: Identifies exclusions using operators like `NOT` or natural language phrases like *"without gore"*, *"no jump scares"*, or *"avoid violence"*.
- **Steerable Vector Math**: The final query vector ($q_{vec}$) is calculated as:
  $$q_{vec} = \text{normalize}(\text{positive\_emb} - \lambda \cdot \text{mean}(\text{negative\_embs}))$$
  The **Negation Lambda ($\lambda$)**, typically set to `0.5`, allows the engine to mathematically "push" the results away from undesired concepts in the embedding space.

## 5. Multi-Factor Reranking
Once the initial candidates are retrieved via FAISS, a weighted reranking algorithm balances semantic relevance with metadata-driven quality:
- **The Scoring Formula**:
  $$\text{Final Score} = \alpha \cdot \text{SemanticSimilarity} + \beta \cdot \text{Popularity} + \gamma \cdot \text{VoteAverage}$$
- **Weight Distribution**:
    - **$\alpha = 0.75$ (75%)**: Heavy focus on the semantic "vibe" match.
    - **$\beta = 0.15$ (15%)**: Boosts trending/popular titles.
    - **$\gamma = 0.10$ (10%)**: Favors critically acclaimed films based on TMDB user ratings.

## 6. Evaluation Metrics
Models are evaluated using **Recall@K** (R@1, R@5, R@10, R@50). The evaluation is fully GPU-vectorized:
1. All targets and anchors are encoded into large GPU tensors.
2. A single massive Matrix Multiplication (`torch.mm`) is performed to generate the similarity matrix.
3. `torch.topk` is used to identify neighbors directly on the GPU, minimizing slow data transfers back to the CPU.
