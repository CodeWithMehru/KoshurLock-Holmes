"""One-shot seeding of the demo case (spends Groq tokens exactly once).

Run inside the backend container:  docker compose exec backend python -m app.seed
or via:                           make seed

Forces a full ingest. Afterwards, snapshot with `make snapshot` so every boot
starts warm and POST /ingest short-circuits to 'exists' with no LLM calls.
"""

from __future__ import annotations

import asyncio

from .settings import configure

configure(verbose=True)

from . import cognee_engine  # noqa: E402


async def main() -> int:
    print("[seed] ingesting the case (rebuild=True) ...")
    res = await cognee_engine.ingest_all(rebuild=True)
    nodes = res.get("nodes") or 0
    edges = res.get("edges") or 0
    print(
        f"[seed] status={res['status']} files={len(res['files'])} "
        f"held_back={res.get('held_back')} nodes={nodes} edges={edges}"
    )
    if nodes > 0 and edges > 0:
        print("[seed] OK: graph populated. Run `make snapshot` to persist it.")
        return 0
    print("[seed] FAIL: graph is empty after ingest.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
