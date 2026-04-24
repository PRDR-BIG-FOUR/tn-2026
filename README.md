# manifesto

v2
Embed and semantically search Tamil Nadu party manifestos (AIADMK, DMK, TVK)
with `Qwen/Qwen3-Embedding-0.6B` on vLLM.

## Layout

```
data/                          # per-party JSONs + generated corpus & embeddings
src/pipeline_1/                # corpus build + vLLM embedding pass
scripts/
  run_pipeline_1_h200.sh       # end-to-end pipeline launcher (H200)
  semantic_search.py           # CLI semantic search
  semantic_search.sh           # Gradio UI launcher
  semantic_search_app.py       # Gradio UI
  verify_pipeline_1.py         # sanity checks on generated artifacts
```

## Setup

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r src/pipeline_1/requirements.txt
```

Add `gradio>=4.44,<6` if you plan to use the UI (`scripts/semantic_search.sh`
will auto-install it on first run).

## Pipeline 1 — Manifesto embedding

Merges every per-party JSON in `data/` into a single corpus with deterministic
numeric `uuid`s, then embeds each point's `text` with vLLM.

### Artifacts

- `data/single_repo_manifesto.json` — merged corpus with `points` + `lookup`
  dict `{uuid: {party, point_number}}`.
- `data/embeddings.npy` — L2-normalized `float32` matrix of shape `(N, 1024)`.
  Row `i` corresponds to `uuid == i`.
- `data/embeddings_meta.json` — model id, dim, uuid order, vLLM args used.

### Run locally

```bash
python -m src.pipeline_1.build_single_repo
python -m src.pipeline_1.embed_vllm
```

### Run on an H200

```bash
bash scripts/run_pipeline_1_h200.sh
```

Tunable env vars: `MODEL`, `DTYPE`, `MAX_MODEL_LEN`, `BATCH_SIZE`,
`GPU_MEM_UTIL`, `TP_SIZE`, `CUDA_VISIBLE_DEVICES`.

### Verify

```bash
python scripts/verify_pipeline_1.py
```

### Model choice

`Qwen/Qwen3-Embedding-0.6B` is the smallest Qwen3 embedding model, runs as a
pooling model in vLLM (>= 0.14), supports 8K context, and is at the top of the
MTEB leaderboard in its size class. This pass embeds raw document text (no
query-instruction prefix) since it is a corpus-only pass.

## Semantic search

Embeds a natural-language query with the same model and ranks manifesto points
by cosine similarity against `data/embeddings.npy`.

### CLI

```bash
python scripts/semantic_search.py \
  --query "free bus travel for women" \
  --top-n 5

python scripts/semantic_search.py -q "school education reforms" \
  --party dmk --top-n 10 --json
```

Flags: `--party {aiadmk,dmk,tvk_en}`, `--top-n`, `--snippet-len`, `--json`,
plus vLLM knobs `--dtype`, `--max-model-len`, `--gpu-memory-utilization`.

### Gradio UI

```bash
scripts/semantic_search.sh                    # default: 0.0.0.0:7860
PORT=7862 scripts/semantic_search.sh          # custom port
CUDA_VISIBLE_DEVICES=2 scripts/semantic_search.sh
scripts/semantic_search.sh --share            # public share link
```

Env overrides: `HOST`, `PORT`, `CUDA_VISIBLE_DEVICES`, `GPU_MEM_UTIL`,
`DTYPE`, `MAX_MODEL_LEN`, `VENV_DIR`. The app loads the corpus + vLLM model
once at startup, then serves a query box with top-N slider and party filter.

## Pipeline 2 — LLM enrichment (Gemini Flash + Google Search)

For every point in each per-party manifesto JSON, calls `gemini-3-flash-preview`
(via [`google-genai`](https://ai.google.dev/gemini-api/docs/google-search))
once with Google Search grounding, and produces three analyses in a single
shot:

1. **Beneficiary metadata** — geography, gender, age group, community
   category, minority (religious / linguistic), occupation, sector, income
   class, education level, disability, urban/rural, primary theme, free-form
   tags, beneficiary count estimate.
2. **Plan existence** — Google-Search-grounded check for whether the proposal
   is already implemented (Tamil Nadu / Government of India / other state),
   with cited URLs.
3. **Feasibility** — multi-axis 1–5 scoring (fiscal, legal, administrative,
   timeline, political) with critical comments + overall verdict + key risks.

Async fan-out (`client.aio.models.generate_content` + `asyncio.gather` +
semaphore) packs `--batch-k` points per request to amortize the system prompt
across multiple promises and lower per-token cost.

### Setup

```bash
uv pip install -r src/pipeline_2/requirements.txt
export GEMINI_API_KEY=...
```

### Run

```bash
PARTY=all CONCURRENCY=8 BATCH_K=4 scripts/run_pipeline_2.sh

python -m src.pipeline_2.process \
  --party aiadmk \
  --batch-k 4 --concurrency 8 \
  --model gemini-3-flash-preview \
  --out data/pipeline_2 \
  --limit 8                  # smoke run
```

Env overrides for the launcher: `PARTY`, `MODEL`, `BATCH_K`, `CONCURRENCY`,
`MAX_RETRIES`, `LIMIT`, `OUT`, `VENV_DIR`.

### Output

`data/pipeline_2/<party>.enriched.json` mirrors the input shape but each
`points[i]` gains an `analysis` block:

```json
"analysis": {
  "beneficiary":   { "geography": {...}, "gender": [...], "age_group": [...], ... },
  "plan_existence":{ "already_exists": true, "existing_scheme_names": [...],
                     "jurisdiction": [...], "evidence": [{"title","url","snippet"}],
                     "notes": "..." },
  "feasibility":   { "fiscal": {"score","comments"}, "legal": {...},
                     "administrative": {...}, "timeline": {...}, "political": {...},
                     "overall_score": 3, "overall_comments": "...", "key_risks": [...] },
  "_grounding":    { "search_queries": [...], "citation_urls": [...] },
  "_meta":         { "model": "gemini-3-flash-preview", "tokens": {...}, "attempts": 1 }
}
```

A top-level `pipeline_2_meta` block records the model, batch size, concurrency,
counts of failures / parse errors, total token estimate, and timestamps.

### Protocol notes

- Google Search grounding is mutually exclusive with structured output, so
  the model emits JSON-as-text. The three sections per point are separated by
  `<sep>` and consecutive points by `<item_sep>` — see
  [src/pipeline_2/prompts.py](src/pipeline_2/prompts.py) and
  [src/pipeline_2/parser.py](src/pipeline_2/parser.py).
- Transient errors (429, 5xx, timeouts) are retried with exponential backoff
  + jitter. Points the model fails to produce land with
  `analysis: {"error": "..."}` and are counted in `pipeline_2_meta.failures`
  / `parse_errors`.

## Out of scope (future pipelines)

- Vector DB ingestion (FAISS / Qdrant / Chroma).
- Reranker pass (Qwen3-Reranker).
- Cross-party clustering / diff views.
