"""In-app warm restore of the demo case from the committed snapshot.

The whole Cognee memory stack (relational + vector + graph) lives in one
Postgres, so a single ``pg_restore`` of the committed dump repopulates the demo
graph with ZERO LLM calls. ``scripts/restore.sh`` does this from the host with
the backend stopped; this module does the equivalent from INSIDE the running
backend so the UI can offer a one-click "reload demo" after an analyst's upload
replaced the graph.

Doing it live is delicate - the backend holds pooled connections to the same
database that ``pg_restore --clean`` will drop and recreate. We mitigate:
  1. serialize against the engine's mutate lock (no concurrent Cognee work);
  2. clear Cognee's cached DB engine factories so they rebuild afterwards;
  3. terminate every OTHER connection to the DB so ``--clean`` can DROP cleanly;
  4. run ``pg_restore`` (mirrors restore.sh, minus the host stop-backend);
  5. restore the data-root blobs (needed for teach/forget after a cold restore);
  6. clear caches again and confirm the graph came back populated.

``make demo`` / ``make restore`` remain the guaranteed fallback if a live
restore ever misbehaves.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tarfile
from pathlib import Path

from . import settings

log = logging.getLogger("tracepoint.restore")

DUMP = settings.SNAPSHOT_DIR / "cognee_db.dump"
BLOBS = settings.SNAPSHOT_DIR / "dataroot.tgz"


def snapshot_available() -> bool:
    return DUMP.is_file()


def _pg_env() -> dict[str, str]:
    env = dict(os.environ)
    env["PGPASSWORD"] = os.environ.get("DB_PASSWORD", "cognee")
    return env


def _pg_restore() -> subprocess.CompletedProcess:
    """Blocking pg_restore of the committed dump (run in a worker thread)."""
    cmd = [
        "pg_restore", "--clean", "--if-exists", "--no-owner",
        "-h", os.environ.get("DB_HOST", "postgres"),
        "-p", os.environ.get("DB_PORT", "5432"),
        "-U", os.environ.get("DB_USERNAME", "cognee"),
        "-d", os.environ.get("DB_NAME", "cognee_db"),
        str(DUMP),
    ]
    return subprocess.run(cmd, env=_pg_env(), capture_output=True, text=True, timeout=180)


async def _terminate_other_connections() -> None:
    """Kill every other backend connection to the DB so DROP can proceed."""
    try:
        import asyncpg
    except Exception:
        return
    try:
        conn = await asyncpg.connect(
            host=os.environ.get("DB_HOST", "postgres"),
            port=int(os.environ.get("DB_PORT", "5432")),
            user=os.environ.get("DB_USERNAME", "cognee"),
            password=os.environ.get("DB_PASSWORD", "cognee"),
            database=os.environ.get("DB_NAME", "cognee_db"),
            timeout=10,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("could not open maintenance connection: %s", exc)
        return
    try:
        await conn.execute(
            """
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()
            """,
            os.environ.get("DB_NAME", "cognee_db"),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("pg_terminate_backend failed (continuing): %s", exc)
    finally:
        await conn.close()


def _untar_blobs() -> None:
    if not BLOBS.is_file():
        return
    try:
        settings.APP_STATE_DIR.mkdir(parents=True, exist_ok=True)
        with tarfile.open(BLOBS, "r:gz") as tf:
            tf.extractall(settings.APP_STATE_DIR)
    except Exception as exc:  # noqa: BLE001
        log.warning("data-root blob restore skipped: %s", exc)


async def restore_demo() -> dict:
    """Warm-restore the demo graph from the committed snapshot. Raises if the
    snapshot is missing or the graph is still empty afterwards."""
    if not DUMP.is_file():
        raise RuntimeError(f"demo snapshot not found at {DUMP}")

    # Imported lazily so this module carries no cognee import at module load.
    from . import cognee_engine
    from .settings import clear_cognee_db_caches

    async with cognee_engine._mutate_lock:  # noqa: SLF001 - deliberate shared lock
        clear_cognee_db_caches()
        await _terminate_other_connections()

        proc = await asyncio.to_thread(_pg_restore)
        if proc.returncode != 0:
            # pg_restore commonly returns non-zero on benign "already exists"
            # warnings; only real failures leave the graph empty (checked below).
            log.warning("pg_restore returncode=%s stderr=%s",
                        proc.returncode, (proc.stderr or "")[:500])

        _untar_blobs()
        clear_cognee_db_caches()

    counts = await cognee_engine.graph_counts()
    nodes = counts.get("nodes") or 0
    if not nodes:
        raise RuntimeError(
            "restore ran but the graph is still empty - use `make demo` / "
            "`make restore` to reload the snapshot with the backend stopped."
        )
    return {"status": "restored", **counts}
