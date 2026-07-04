# Test plan and verification gates

The project was built in a strict order. Each stage had to pass its gate before the
next began. The hardest and highest-risk piece, the Cognee plus Postgres integration,
was verified first.

## Stage 1 - Postgres and pgvector

Bring up only the Postgres service and confirm the vector extension is enabled.

- Command: docker compose up -d postgres
- Gate: pg_isready reports healthy, and
  `CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname='vector';`
  returns a version.

## Stage 2 - the Cognee plus Postgres smoke test (highest risk, done first)

Prove add, cognify, and search work on self-hosted Postgres with pgvector, using Groq
in json_mode and local FastEmbed, with the graph in the same Postgres via pghybrid.

- Command: backend/scripts/smoke_stage2.py (or make smoke in-container)
- Gate: the no-OpenAI guard passes, OPENAI_API_KEY is absent, cognify completes with
  no "Missing required pgvector credentials" or "Missing required Postgres graph
  credentials", get_graph_data() returns more than zero nodes and more than zero
  edges, and search returns a non-empty answer.
- Decision point: if Config A does not produce a clean graph, switch to Config B
  (Kuzu graph on a mounted volume) and record it in architecture.md.

Nothing else is built until this passes.

## Stage 3 - scenario, seed, snapshot, restore

Port the scenario with the Rahul Sharma rename, seed once, snapshot, wipe, and
restore.

- Commands: make seed, make snapshot, docker compose down -v, make demo (restore)
- Gate: seed reports more than zero nodes and edges; after a wipe and restore, the
  graph is populated again and POST /ingest reports status "exists" with no LLM calls.

## Stage 4 - API endpoints

- Gate: POST /ask with the multi-hop question returns an answer whose cited sources
  list has at least two entries; GET /graph returns typed nodes and edges; GET
  /timeline returns ordered events; GET /status reports the correct providers and
  openai_present false; GET /evidence/anonymous_tip.txt returns the raw lines.

## Stage 5 - The Turn, headless

- Command: make reveal (backend/scripts/reveal.py)
- Gate: the before answer implicates Rahul Sharma; after teach and forget, the after
  answer exonerates Rahul Sharma and names the external attacker at 41.220.13.7; the
  two answers visibly differ.

## Stage 6 - the dashboard

- Command: docker compose up --build
- Gate: the dashboard loads at :8080, the knowledge graph renders with the color
  legend, citation chips open the raw evidence, and The Turn flips the before and
  after in the UI.

## Stage 7 - evidence upload and case management

- Commands: create a new case, upload all eight demo files at once, and ingest.
- Gate: every file reaches "in graph" with no Postgres deadlock, with per-file status
  advancing one at a time; a multi-hop ask over the uploaded case returns an answer
  that cites more than one source; deleting an uploaded case removes it and its files;
  the demo case cannot be deleted and still opens warm with zero re-ingestion.

## Stage 8 - documentation

- Gate: the README links every document and every link resolves; there are no emoji
  and no em or en dashes in the documentation.

## Stage 9 - clean-state end to end

- Commands: from fresh volumes, with only LLM_API_KEY in .env, docker compose up
  --build then make restore.
- Gate: the app starts warm, all four operations work through the API, /status shows
  openai_present false and the storage providers, and no re-ingest fires.

## Final confirmations

- No OpenAI is used (the guard plus /status.openai_present false).
- The whole memory stack runs on self-hosted Postgres (Config A), or the documented
  Kuzu graph fallback (Config B).
- All four Cognee operations work through the API.
- The interactive Cytoscape graph renders real data from /graph.
- The before-and-after forget flip works.
- Seed-once plus snapshot avoids re-ingestion on boot.
- The documentation and README are complete with no emoji or em or en dashes.
