# Contributing to KoshurLock Holmes

Thanks for your interest in the project. This guide covers how to set it up, run it, add evidence, and submit changes.

## Prerequisites

- Docker and Docker Compose.
- A free Groq API key from https://console.groq.com.

## Run it

```
git clone <this-repo> koshurlock-holmes
cd koshurlock-holmes
cp .env.example .env          # then set LLM_API_KEY to your Groq key
docker compose up --build     # starts postgres, backend, frontend
```

Seed the demo once and snapshot it so later starts are warm:

```
make seed
make snapshot
```

The dashboard is at http://localhost:8080 and the API is at http://localhost:8000. Use `make demo` to start warm from the snapshot, and `make help` to list all targets.

## Project layout

- `backend/` FastAPI service that wraps Cognee. The four operations live in `backend/app/cognee_engine.py`; evidence parsing is in `backend/app/ingest.py`; the demo data is in `backend/data/`.
- `frontend/` React, Vite, TypeScript, Tailwind, and Cytoscape.js dashboard, served by nginx.
- `docs/` the project documentation.
- `scripts/` snapshot and restore helpers.
- `docker-compose.yml` the three services: postgres, backend, frontend.

## Adding evidence or a new case

You do not need to touch code to add evidence. In the dashboard, choose New investigation, name the case, and upload CSV, TXT, PDF, or DOCX files. Each file is parsed, wrapped with a provenance header, and ingested through the same remember and cognify path the demo uses. For the seeded demo, evidence files live in `backend/data/`, and the ingest loader reads every file in that directory.

## Testing and verification

- `make smoke` runs the Cognee plus Postgres smoke test in the container.
- `make reveal` runs The Turn headless and checks that the conclusion flips.
- The full set of verification gates is in [docs/test-plan.md](docs/test-plan.md). Please keep changes consistent with those gates.

## Coding conventions

- Match the style of the surrounding code. The backend is typed Python with async FastAPI handlers; the frontend is TypeScript and functional React components.
- Do not introduce an OpenAI dependency. The startup guard will hard-fail, and it is meant to. All inference stays on Groq and local FastEmbed.
- Keep the storage model as one Postgres unless you have a clear reason and a passing smoke test for an alternative.
- Run the backend and frontend builds locally before opening a pull request.

## Documentation conventions

- No emoji.
- No em dashes and no en dashes. Use hyphens and colons.
- Write in clear, natural prose. Keep names, endpoints, formats, and stack details consistent with the rest of the documentation.

## Pull requests

- Keep each pull request focused and describe what it changes and why.
- Note any change to behavior, configuration, or the verification gates.
- Confirm the app still builds and runs with `docker compose up --build`.

## License

By contributing, you agree that your contributions are licensed under the MIT license that covers this project. See the [LICENSE](LICENSE) file.
