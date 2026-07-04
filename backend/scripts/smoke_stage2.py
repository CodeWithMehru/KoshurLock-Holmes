"""Stage-2 smoke test - the single hardest thing, done FIRST.

Proves the whole memory stack works on self-hosted PostgreSQL + pgvector:

    cognee.add  ->  cognee.cognify  ->  cognee.search(GRAPH_COMPLETION)

with Groq (json_mode) for the LLM and local FastEmbed for embeddings, using
USE_UNIFIED_PROVIDER=pghybrid so relational + vector + graph all live in ONE
Postgres. It mirrors Cognee's own tests/e2e/postgres/test_pghybrid.py.

Gate (all must hold):
  * assert_no_openai() passes and OPENAI_API_KEY is absent
  * cognify completes with no "Missing required pgvector/Postgres graph credentials"
  * get_graph_data() returns nodes > 0 AND edges > 0
  * search returns a non-empty answer

Run (host, against the docker Postgres exposed on localhost:5432):

    cd backend
    LLM_API_KEY=... DB_HOST=localhost .venv/bin/python scripts/smoke_stage2.py

Nothing else in the project should be built until this passes.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Make `app` importable when run as backend/scripts/smoke_stage2.py
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))


def _preset_env() -> None:
    """Set LLM + embedding env BEFORE importing cognee (values match .env)."""
    os.environ.setdefault("LLM_PROVIDER", "custom")
    os.environ.setdefault("LLM_MODEL", "groq/llama-3.3-70b-versatile")
    os.environ.setdefault("LLM_TEMPERATURE", "0.0")
    os.environ.setdefault("LLM_INSTRUCTOR_MODE", "json_mode")
    os.environ.setdefault("EMBEDDING_PROVIDER", "fastembed")
    os.environ.setdefault("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    os.environ.setdefault("EMBEDDING_DIMENSIONS", "384")
    os.environ.setdefault("COGNEE_SKIP_CONNECTION_TEST", "true")
    os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")
    os.environ.setdefault("CACHING", "false")
    # Local data/system dirs for this host run (avoid touching /data).
    smoke_root = BACKEND_ROOT / ".cognee_system_smoke"
    (smoke_root / "data").mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("SYSTEM_ROOT_DIRECTORY", str(smoke_root))
    os.environ.setdefault("DATA_ROOT_DIRECTORY", str(smoke_root / "data"))


def _apply_db_env() -> None:
    """Set the Postgres/pghybrid env. Done AFTER importing cognee, because
    cognee.__init__ calls dotenv.load_dotenv(override=True) which can clobber
    os.environ from a .env; re-asserting here + clearing the cached config
    factories (below) guarantees our values win. This mirrors test_pghybrid.py.
    """
    os.environ["USE_UNIFIED_PROVIDER"] = "pghybrid"
    os.environ["DB_PROVIDER"] = "postgres"
    os.environ["VECTOR_DB_PROVIDER"] = "pgvector"
    os.environ["GRAPH_DATABASE_PROVIDER"] = "postgres"
    os.environ["DB_HOST"] = os.environ.get("DB_HOST", "localhost")
    os.environ["DB_PORT"] = os.environ.get("DB_PORT", "5432")
    os.environ["DB_USERNAME"] = os.environ.get("DB_USERNAME", "cognee")
    os.environ["DB_PASSWORD"] = os.environ.get("DB_PASSWORD", "cognee")
    os.environ["DB_NAME"] = os.environ.get("DB_NAME", "cognee_db")


def _clear_caches() -> None:
    """Clear the five lru-cached config/engine factories so they re-read env."""
    from cognee.infrastructure.databases.relational.config import get_relational_config
    from cognee.infrastructure.databases.relational.create_relational_engine import (
        create_relational_engine,
    )
    from cognee.infrastructure.databases.graph.config import get_graph_config
    from cognee.infrastructure.databases.graph.get_graph_engine import _create_graph_engine
    from cognee.infrastructure.databases.vector.create_vector_engine import (
        _create_vector_engine,
    )

    get_relational_config.cache_clear()
    get_graph_config.cache_clear()
    create_relational_engine.cache_clear()
    _create_graph_engine.cache_clear()
    _create_vector_engine.cache_clear()


async def main() -> int:
    _preset_env()

    # Prove the no-OpenAI guard passes before we touch Cognee.
    from app.settings import assert_no_openai

    assert_no_openai()
    if os.environ.get("OPENAI_API_KEY", "").strip():
        print("FAIL: OPENAI_API_KEY is present")
        return 1
    if not os.environ.get("LLM_API_KEY", "").strip():
        print("FAIL: LLM_API_KEY is not set (export your Groq key)")
        return 1

    import cognee  # noqa: E402  (after env preset)
    from cognee.modules.search.types import SearchType  # noqa: E402
    from cognee.infrastructure.databases.graph import get_graph_engine  # noqa: E402

    _apply_db_env()
    _clear_caches()

    dataset = "smoke_stage2"
    print("[smoke] pruning any prior smoke data ...")
    try:
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[smoke] prune skipped: {exc}")

    doc = (
        "SOURCE: smoke_test\n---\n"
        "At 2026-07-01T02:03:12, user 'rsharma' logged in over VPN from IP "
        "41.220.13.7 located in Lagos, NG. At 2026-07-01T02:19:04, that same "
        "session downloaded the file Q4_Customer_Database.xlsx from host FIN-FS-02."
    )

    print("[smoke] add ...")
    await cognee.add(doc, dataset_name=dataset, node_set=["smoke_test"])
    print("[smoke] cognify (Groq json_mode + FastEmbed) ...")
    await cognee.cognify(datasets=[dataset])

    print("[smoke] search (GRAPH_COMPLETION) ...")
    results = await cognee.search(
        query_text="Which IP address did user rsharma log in from, and what did that session download?",
        query_type=SearchType.GRAPH_COMPLETION,
        top_k=10,
    )
    answer_parts: list[str] = []
    for item in results or []:
        sr = item.get("search_result") if isinstance(item, dict) else getattr(item, "search_result", None)
        if sr is None and isinstance(item, str):
            answer_parts.append(item)
        elif isinstance(sr, (list, tuple)):
            answer_parts.extend(str(x) for x in sr)
        elif sr is not None:
            answer_parts.append(str(sr))
    answer = " ".join(p.strip() for p in answer_parts if p and p.strip())

    engine = await get_graph_engine()
    nodes, edges = await engine.get_graph_data()
    n_nodes, n_edges = len(nodes), len(edges)

    print("\n" + "=" * 68)
    print(f"  GRAPH   nodes={n_nodes}  edges={n_edges}")
    print(f"  ANSWER  {answer[:400]}")
    print(f"  STORE   relational=postgres vector=pgvector graph=postgres (pghybrid)")
    print(f"  OPENAI  present={bool(os.environ.get('OPENAI_API_KEY', '').strip())}")
    print("=" * 68)

    ok = n_nodes > 0 and n_edges > 0 and bool(answer)
    if ok:
        print("\nSTAGE 2 PASS: cognee add -> cognify -> search on Postgres+pgvector, "
              "nodes/edges > 0, Groq + FastEmbed, no OpenAI.")
        return 0
    print("\nSTAGE 2 FAIL: see counts/answer above.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
