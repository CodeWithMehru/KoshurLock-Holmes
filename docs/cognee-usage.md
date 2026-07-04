# How KoshurLock Holmes uses Cognee

The four investigator operations map directly onto Cognee's memory lifecycle. All
logic lives in backend/app/cognee_engine.py, ported from a proven prototype and
converted to native async FastAPI handlers.

## Remember (ingest) - cognee.add + cognee.cognify

`POST /ingest` calls `ingest_all()`. Each evidence file is read, its CSV rows are
turned into natural-language sentences, and it is wrapped with a provenance header
(SOURCE, SOURCE TYPE, RELIABILITY). The wrapped text is added and then cognified:

- `cognee.add(text, dataset_name=..., node_set=[filename])` for each source.
- `cognee.cognify(datasets=[...])` once to build the knowledge graph.

Dataset design:

- Most sources go into one shared dataset, case_evidence, so that the same person,
  IP, or filename that appears in different logs resolves to a single shared graph
  node. That shared resolution is what makes cross-source multi-hop reasoning
  possible.
- The planted anonymous tip is ingested into its own dataset so it can be removed
  with a single, surgical forget.
- The phishing note is held back from the initial ingest so the before and after
  of The Turn is crisp; its finding is introduced later through Teach.

`ingest_all()` short-circuits: if the graph already has data and no rebuild was
requested, it returns status "exists" with the current node and edge counts and
makes no LLM calls. This is the token saver that lets the app start warm from a
restored snapshot.

## Uploaded cases and the graph-swap model

An analyst can also bring their own evidence. An uploaded case runs the same
remember path: each file (CSV, TXT, PDF, or DOCX) is parsed, wrapped with the same
provenance header, and added into the case's own dataset, then cognified. To keep
the upload reliable, the files are ingested one at a time, so only one cognify
writes to the graph tables at any moment, and a retry re-runs a file on a Postgres
deadlock or serialization error. The app keeps exactly one case materialized in the
graph at a time (a graph-swap model), so recall never blends answers across cases.

## Recall (ask) - cognee.search

`POST /ask` calls `ask()`, which issues up to three searches:

- `SearchType.GRAPH_COMPLETION` for the natural-language answer. This traverses the
  knowledge graph and reasons over connected entities, which is what plain vector
  RAG cannot do: it can follow the chain from the Lagos IP, to the VPN session, to
  the downloads, to the badge and CCTV records that place Rahul elsewhere.
- `SearchType.GRAPH_COMPLETION` with only_context=True for the connected entities
  that support the answer (no extra generation cost).
- `SearchType.TEMPORAL` for a timeline, with a graph-completion fallback.

The response includes the answer, the connected entities, a timeline, and a list of
cited source files (derived by scanning the answer and context for filenames and
characteristic keywords such as the attacker IP or "turnstile").

## Improve (teach) - cognee.add + cognee.cognify + cognee.improve

`POST /teach` calls `teach()`. The analyst correction is framed as a CONFIRMED
source (the highest reliability), added into the analyst_correction dataset,
re-cognified so it links into the existing graph (reusing the exact entity strings
already present, so it connects rather than forming an island), and then Cognee's
own `improve` is invoked best-effort to consolidate and reweight. The correction
alone is enough to flip the conclusion; improve is a bonus that is skipped
gracefully if the free tier throttles it.

## Forget (forget) - cognee.forget

`POST /forget` calls `purge()`. Because the anonymous tip lives in its own dataset,
forgetting it is a single `cognee.forget(dataset="anonymous_tip")`. For any source
that shares the case_evidence dataset, the engine finds the exact Data record by its
node_set tag (the filename set at add time) and forgets it by id, with a hard delete
as a fallback. Removing the tip collapses any conclusion that leaned on it.

## Why the graph enables multi-hop that plain RAG cannot

A vector store retrieves passages that are similar to the question. It has no notion
that "the IP in the VPN log" and "the session in the download log" are the same
event, or that a person seen on CCTV cannot also be logging in from another country.
Cognee builds a typed knowledge graph where the same entity from different sources
becomes one node, and relationships between people, accounts, devices, IPs, files,
locations, and events are explicit edges. GRAPH_COMPLETION reasons over that
structure, which is what lets the investigator connect a login, a download, and a
badge record across five different logs into a single, defensible conclusion.

## Configuration that makes this work

- LLM: Groq via LiteLLM (LLM_PROVIDER=custom, a groq/ model), with
  LLM_INSTRUCTOR_MODE=json_mode. Groq's Llama models mangle json_schema mode into a
  broken tool-call path that aborts cognify; plain json_mode is reliable.
- Embeddings: local FastEmbed (all-MiniLM-L6-v2, 384 dimensions). EMBEDDING_DIMENSIONS
  must be set, otherwise Cognee defaults to 3072 and silently falls back to OpenAI.
- Access control off (ENABLE_BACKEND_ACCESS_CONTROL=false): with it on, Cognee
  partitions the graph per tenant, which fragments cross-source resolution and can
  report zero nodes.
- A startup guard (assert_no_openai) hard-fails if anything could route to OpenAI.
