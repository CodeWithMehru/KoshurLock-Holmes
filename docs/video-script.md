# Video demo script (under 3 minutes)

Target runtime: **2:45 of narration** (total video under 3:00). The narration below is
about 345 words, which lands near 130 words per minute - a calm, natural pace with room
to breathe while the screen does the talking. Practice once with a timer; if you run
long, cut from the Learning row first.

## Prep checklist (before recording)

- Start warm: `make demo` (graph restored from the snapshot, zero tokens spent).
- Confirm the health dot is green and the graph shows 95 nodes / 279 edges.
- The Turn makes real LLM calls (two asks, one teach, one forget) - make sure your
  Groq daily quota has headroom before recording that section.
- Record at the landing page, logged-out browser chrome hidden, 1080p or better.

## Shot-by-shot script

| Time | SAY (narration) | SHOW (screen) |
| --- | --- | --- |
| 0:00-0:08 | What if one planted email could frame an innocent employee - and your tools believed it? | Landing page. Hold on the hero: logo, "Every log. One graph. The whole truth." Let the aurora drift for a beat. |
| 0:08-0:35 | After a breach, the hard part isn't one log. It's correlating dozens - VPN, file access, email, badges, CCTV. That takes analysts days. And when an account is stolen, every log blames its real owner. KoshurLock Holmes turns all that scattered evidence into one connected memory you can question in plain English - with cited answers. | Stay on the landing page. Slow scroll to the two mode cards (Load demo case / New investigation) and the cases table. |
| 0:35-1:00 | The stack is simple and fully self-hosted. A React dashboard with an interactive Cytoscape graph. A FastAPI backend wrapping Cognee, the memory engine. And one PostgreSQL instance holding everything - relational data, vector embeddings, and the knowledge graph, side by side. The LLM is Groq on its free tier. Embeddings run locally. No OpenAI anywhere. | Show the architecture diagram from README/docs (the mermaid flowchart) as a full-screen slide, or split-screen it beside the app. End on the green status dot in the TopBar. |
| 1:00-1:12 | Let's open the Northgate Financial case. Someone exfiltrated the customer database at two a.m. I'll ask the obvious question: who did this? | Click **Load demo case**. Land on the Investigation console with the pre-filled question. Click **ASK**. |
| 1:12-1:30 | The answer reasons across every source at once, and it cites its evidence. Each citation expands to the exact raw log line. Right now, the logs point at Rahul Sharma - the downloads ran under his account. | The Conclusion card renders. Click one citation chip (vpn_logs.csv) to expand the highlighted raw lines. Hover the connected-entities table briefly. |
| 1:30-1:45 | Here's the whole case as a live knowledge graph. People, accounts, IPs, files, events - connected across every log. This red-ringed node is the attacker IP, flagged as an indicator of compromise. | Switch to **Knowledge graph**. Let the layout settle. Click the **41.220.13.7** node: red IOC ring, inspector opens, neighborhood traces. |
| 1:45-2:00 | The timeline tells a stranger story. Filter to the attacker IP: logins from Lagos at two a.m. Filter to Rahul: badge and CCTV put him at his desk - at the same moment. | Switch to **Timeline**. Click the **Attacker IP** filter (red rows, 01:58-02:41 window). Then click **Rahul Sharma** (blue badge/CCTV alibi rows). |
| 2:00-2:22 | So we run The Turn. Teach the confirmed finding - his credentials were phished. Forget the planted anonymous tip. Then ask again. Watch the verdict flip: Rahul Sharma is exonerated, and the attacker at 41.220.13.7 is named. Because he can't be in the office and in Lagos at once. | Switch to **The Turn**. Click **Run the turn**. Show the 4-step pipeline lighting up (Recall, Improve, Forget, Recall), then the Before/After panels side by side, ending on the **Verdict flipped** banner. |
| 2:22-2:37 | Building this taught us a lot - like running an entire memory stack on a single Postgres, and making LLM ingest survive rate limits and deadlocks, one file at a time. | Quick cut to **Evidence** tab (per-file status pills), or a brief shot of `docker compose ps` showing the three containers. |
| 2:37-2:45 | KoshurLock Holmes: evidence in, truth out - even when someone planted a lie. Thanks for watching. | Cut back to the landing hero. Hold on the logo and headline. Fade out. |

## Production notes

- **Word budget per row is deliberate** - if a row's narration finishes early, let the
  screen action complete in silence rather than padding with filler.
- Say the IP once, slowly: "forty-one dot two-twenty dot thirteen dot seven" - it's the
  villain of the story and worth the four seconds.
- The Turn takes real time to run (two live LLM calls). Either record that section in
  real time and trim the waiting in the edit, or pre-record the run and cut to it.
- Everything shown is real app behavior: warm demo start, cited answers, the IOC ring,
  the attacker/alibi timeline filters, and the before/after flip are all in the product -
  nothing staged.
