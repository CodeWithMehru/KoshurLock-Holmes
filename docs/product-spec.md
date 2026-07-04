# Product specification

## What it is

KoshurLock Holmes is a self-hosted incident investigation console. It ingests the raw logs and documents from a security incident, builds one connected knowledge graph of the evidence, and lets an analyst interrogate that graph in plain English. It answers with cited, multi-hop reasoning, reconstructs a timeline, and supports two corrective actions that most retrieval tools lack: teaching a confirmed finding and forgetting a discredited source.

The product runs entirely on open-source and free components. The whole memory stack is one PostgreSQL instance with pgvector, the language model is Groq on its free tier, and embeddings are local. There is no OpenAI dependency.

## Who it is for

- SOC analysts who need to correlate evidence across many systems during triage and want a defensible, cited conclusion rather than a pile of search hits.
- Digital forensics and incident response (DFIR) responders who reconstruct what happened after a breach and must revise a hypothesis as new facts confirm or discredit a source.
- Internal auditors and investigators who receive tips and records of mixed reliability and need to separate corroborated evidence from an uncorroborated accusation.

## The core problems it solves

1. Evidence is scattered. The signal only appears when the same person, account, IP, device, file, and event are connected across every source.
2. Naive tools are easily misled. A compromised account makes the logs blame its owner, and a planted tip can reinforce the wrong story.
3. Conclusions must be revisable. When a confirmed finding arrives or a bad source is pulled, the analysis has to update rather than stay anchored to its first answer.

## User stories

- As an analyst, I can ask "who is responsible for the after-hours exfiltration and what happened" and get a multi-hop answer that cites the exact log lines it used.
- As an analyst, I can open a knowledge graph of the whole case, filter by entity type, select the attacker IP, and trace its links to a VPN session and the downloads.
- As an analyst, I can read a chronological timeline of the incident, filtered by actor or by the attacker IP, with the source of each event visible.
- As an analyst, I can teach a confirmed finding (for example, that an IP is a known external attacker and the credentials were stolen) and see the conclusion reweight.
- As an analyst, I can forget a planted or discredited source and watch any conclusion that leaned on it collapse.
- As an analyst, I can bring my own case: create it, upload CSV, TXT, PDF, and DOCX evidence, and have it genuinely ingested so the graph, timeline, and investigation populate from my files.
- As an analyst, I can load a seeded demo case instantly, warm from a snapshot, without spending tokens.

## Feature scope

In scope:

- The four Cognee operations exposed over REST: remember, recall, improve, forget.
- A knowledge graph view, an investigation console with citations, a deterministic timeline, and the before-and-after Turn.
- Two entry modes: a warm seeded demo and a real upload path for CSV, TXT, PDF, and DOCX.
- A single-case-at-a-time graph model, with delete-case and a protected, always-available demo.
- One-command deployment with Docker Compose, and a seed-once plus snapshot workflow for warm starts.

Out of scope for this version:

- Multi-tenant access control and user accounts (the app runs in single-analyst mode by design).
- Live log streaming or agent-based collection (evidence is provided as files).
- Coexisting multiple materialized cases in one graph at the same time.
- Automated report export beyond the on-screen answers and citations.

## Success criteria

- All four operations work through the API and the dashboard.
- The demo loads warm with zero re-ingestion and stays within the Groq free tier.
- An uploaded multi-file case ingests reliably and produces a correct, cited multi-hop answer.
- The Turn visibly flips a wrong conclusion to the correct one.
- No OpenAI is ever contacted, verified by a startup guard and the status endpoint.
