# Delivery plan

This document records how the project was built, in what order, and the real risks that were hit and mitigated. The guiding principle was to prove the hardest, highest-risk piece first, then build outward only once each gate passed. The gates themselves are in [test-plan.md](test-plan.md).

## Build stages and milestones

1. Postgres and pgvector. Stand up the single database and confirm the vector extension is available. Milestone: a healthy Postgres with `vector` enabled.
2. The Cognee plus Postgres smoke test, done first because it was the highest risk. Prove that add, cognify, and search work on self-hosted Postgres with pgvector, using Groq in json_mode and local FastEmbed, with the graph in the same Postgres through `pghybrid`. Milestone: a non-empty graph and a non-empty answer, with no OpenAI contacted. Nothing else was built until this passed.
3. Scenario, seed, snapshot, restore. Load the demo case, seed it once, snapshot the built memory, wipe the volumes, and restore. Milestone: after a wipe and restore the graph is populated again and a warm ingest short-circuits with no LLM calls.
4. API. Wire the four operations and the read endpoints. Milestone: recall returns a cited multi-hop answer, and the graph, timeline, sources, and evidence endpoints return correct data.
5. The Turn, headless. Milestone: a scripted ask, teach, forget, ask sequence that flips the conclusion, verified without the UI.
6. The dashboard. Milestone: the security-operations console renders the interactive graph, opens citations to raw evidence, and runs The Turn in the browser.
7. Evidence upload and the two-mode case model. Milestone: a real uploaded case (CSV, TXT, PDF, DOCX) ingests through the same remember and cognify path and populates every view, alongside the warm demo.
8. Documentation and clean-state end to end. Milestone: a fresh checkout comes up with one command, the demo starts warm, all four operations work, and the documentation is complete.

## Risks hit and how they were mitigated

- Groq free-tier token limits. A full ingest of the case spends tokens, and repeated ingests during development would exhaust the free tier. Mitigation: seed once, then capture the entire built memory with a single `pg_dump` snapshot. A warm-start short-circuit returns the existing graph with no LLM calls, so the app boots warm from the snapshot and the live demo spends nothing.
- Postgres deadlocks on multi-file upload. Cognifying several uploaded documents in one pass issued concurrent writes to the graph tables, and Postgres raised a deadlock so every file failed. Mitigation: serialize the upload path so it adds and cognifies one file at a time, keeping a single writer to the graph at any moment, and add a retry that rolls back and re-runs a file on a deadlock or serialization error with a short backoff. Multi-file uploads now ingest reliably.
- Silent OpenAI fallback. If the embedding dimensions are left unset, Cognee defaults to a value that routes embeddings to OpenAI. Mitigation: pin the local FastEmbed model to 384 dimensions explicitly, and add a startup guard that hard-fails if any provider, model, endpoint, or key could reach OpenAI. The status endpoint reports that no OpenAI key is present.
- Base image rollover breaking the database client. The plain Python base image rolled to a newer Debian release, which broke a pinned apt repository line used to install the Postgres client needed for the in-app warm restore. Mitigation: pin the base image to the tested Debian release and derive the apt repository codename dynamically so the line cannot hardcode the wrong release again.
- Single-worker concurrency correctness. All in-process locks and semaphores are only authoritative with one worker. Mitigation: run uvicorn with a single worker, serialize mutations behind one lock, throttle searches behind a small semaphore, and back off on rate-limit responses.

## Operational workflow

- `make seed` performs the one-time ingest. `make snapshot` writes the warm snapshot.
- `make demo` brings the stack up and restores the snapshot so the demo is warm.
- `make smoke` runs the Cognee plus Postgres smoke test in the container.
- `make reveal` runs The Turn headless.
- `make nuke` tears everything down including volumes for a clean-state test.
