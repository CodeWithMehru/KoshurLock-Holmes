# Demo script (about three minutes)

This walkthrough shows a case being reconstructed across sources, then a planted clue being forgotten so the conclusion re-derives to the truth.

## Setup (before the demo)

Seed the case once and snapshot it so the demo starts warm and does not spend Groq tokens live.

```
cp .env.example .env      # then set LLM_API_KEY to your Groq key
docker compose up --build -d
make seed                 # one-time ingest (spends tokens once)
make snapshot             # persist the built graph
```

For the demo itself, run `make demo`, which brings the stack up and restores the snapshot so the graph is already built.

## 1. Enter the case (20 seconds)

Open the dashboard at http://localhost:8080. It opens on the case picker with two clear choices: Load demo case, which opens the seeded Northgate Financial case warm from the snapshot, and New investigation, which lets you upload your own evidence. Click Load demo case. Point out the compact top bar with the case name and id and a single small health dot, and the slim left nav rail: Investigation, Knowledge graph, Timeline, The Turn, and Evidence.

## 2. Investigate (40 seconds)

Open the Investigation tab. Ask the pre-filled question about who is responsible for the after-hours download and exfiltration. The answer traverses the graph across the VPN, file access, badge, and CCTV logs and returns a multi-hop conclusion with cited sources. Click a citation to expand the exact raw log line, and open the connected-entities table to show the chain the answer used.

## 3. See the graph (30 seconds)

Open the Knowledge graph tab. This is a real interactive node-link graph of the case: people, accounts, devices, IPs, files, locations, and events, colored and shaped by type. Filter by clicking an entity type in the legend, click the attacker IP node to open its inspector, and trace its links to the VPN session and the downloads.

## 4. Reconstruct the timeline (20 seconds)

Open the Timeline tab. Show the chronological reconstruction with a source tag on each row. Filter to the attacker IP to isolate the 01:58 to 02:41 account-takeover window, then filter to Rahul Sharma to show the badge and CCTV events that place him in the office during that same window.

## 5. The Turn (50 seconds)

Open The Turn tab and run it. It executes four steps: ask (before), teach the confirmed phishing and attacker finding, forget the planted anonymous tip, and ask again (after). The two answers appear side by side. Before, the naive reading implicates Rahul Sharma. After, the conclusion re-derives to exonerate Rahul Sharma and name the external attacker at 41.220.13.7, because the account-takeover explanation plus the physical alibi make his guilt impossible.

## 6. Bring your own evidence (optional, 20 seconds)

Go back to the case picker and choose New investigation. Name a case and upload a few CSV, TXT, PDF, or DOCX files. Watch the per-file status move from queued to processing to in graph, then open the Investigation, Knowledge graph, and Timeline tabs to show that the same pipeline works on real uploaded evidence, not just the demo.

## 7. Close (10 seconds)

Restate the point: the entire memory stack is one self-hosted Postgres with pgvector, a free Groq LLM, and local embeddings. No proprietary services and no OpenAI. The system can remember and recall across sources, and it can also improve on a correction and forget a false clue so a wrong conclusion collapses.

## Submission checklist

- The demo starts warm with `make demo` and spends no tokens during the walkthrough.
- All four operations work through the dashboard: remember, recall, improve, forget.
- The knowledge graph renders real data with the entity legend.
- Citations open the exact raw evidence lines.
- The Turn flips the verdict from the framed employee to the external attacker.
- An uploaded multi-file case ingests without errors and populates every view.
- The status indicator confirms no OpenAI key is present.
- The README and docs are complete, with no emoji and no em or en dashes.
