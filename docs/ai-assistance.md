# AI assistance disclosure

This project was built with AI assistance. In the interest of honesty and in
accordance with the hackathon rules, this document states what was AI-assisted and
what was human-decided.

## Tool used

- Claude Code (Anthropic) acted as a pair-programming assistant during the build. It
  read an existing working prototype, ported the proven logic, wrote new code for the
  Postgres migration, the FastAPI service, and the React dashboard, produced the
  documentation, and ran the verification steps.

## What was AI-assisted

- Porting the four Cognee operations from the prototype to an async FastAPI backend.
- Migrating the storage layer from embedded SQLite, LanceDB, and Kuzu to self-hosted
  PostgreSQL with pgvector, including confirming the exact Cognee 1.2.2 configuration
  by reading the installed package source.
- Writing the FastAPI endpoints, the graph transform that types nodes for the
  visualization, the deterministic timeline builder, and the snapshot and restore
  tooling.
- Building the React security-operations dashboard, including the Cytoscape knowledge
  graph, the investigation console, the timeline, and the before-and-after Turn.
- A later pass that redesigned the dashboard into a polished, information-dense
  security-operations console with the aurora identity — centered hero landing,
  aurora gradient palette, glass panels, and an animated logo — and added the real
  evidence-upload feature and the two-mode case model, made multi-file ingest
  deadlock-safe with a serialized per-file cognify and a retry, and added the
  delete-case capability with the demo protected.
- Writing the Docker setup and this documentation.

## What was human-decided

- The product concept: a self-hosted AI investigator for corporate security incidents
  that can reconstruct a case, teach a correction, and forget a planted false clue.
- The scenario and its characters (the Rahul Sharma insider-plus-external framing
  case) and every evidence value.
- The technical direction: reuse the proven Cognee logic rather than rebuild it, run
  the entire memory stack on one self-hosted Postgres, use only free and open-source
  components, and never depend on OpenAI.
- The verification gates that each build stage had to pass before the next began.

## Verification

All claims in the documentation were checked against the running system. The
verification gates are listed in test-plan.md. The configuration facts (environment
variable names, the availability of a native Postgres graph adapter, the pghybrid
mode) were confirmed by reading the installed Cognee 1.2.2 source, not assumed.
