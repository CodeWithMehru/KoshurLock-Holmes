"""Status / health / sources / evidence endpoints for the sidebar and citations:
    GET /health              -> liveness + DB connectivity (used by healthcheck)
    GET /status              -> LLM / embeddings / DB provider chips + graph counts
    GET /sources             -> evidence list with ingest status
    GET /evidence/{filename} -> raw provenance-wrapped log lines for a citation
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from .. import cases, cognee_engine, ingest
from ..settings import db_summary

router = APIRouter(tags=["meta"])


async def _db_ping() -> bool:
    """SELECT 1 against Postgres via asyncpg, independent of Cognee internals."""
    try:
        import asyncpg

        conn = await asyncpg.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            port=int(os.environ.get("DB_PORT", "5432")),
            user=os.environ.get("DB_USERNAME", "cognee"),
            password=os.environ.get("DB_PASSWORD", "cognee"),
            database=os.environ.get("DB_NAME", "cognee_db"),
            timeout=5,
        )
        try:
            return (await conn.fetchval("SELECT 1")) == 1
        finally:
            await conn.close()
    except Exception:
        return False


@router.get("/health")
async def health() -> dict:
    connected = await _db_ping()
    return {
        "status": "ok" if connected else "degraded",
        "db_connected": connected,
        "openai_present": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
    }


@router.get("/status")
async def status() -> dict:
    db = db_summary()
    connected = await _db_ping()
    try:
        counts = await cognee_engine.graph_counts()
        ingested = await cognee_engine.is_ingested()
    except Exception:
        counts, ingested = {"nodes": None, "edges": None}, False

    llm_model = os.environ.get("LLM_MODEL", "")
    emb_model = os.environ.get("EMBEDDING_MODEL", "")
    emb_dim = os.environ.get("EMBEDDING_DIMENSIONS", "")
    return {
        "llm": {
            "provider": os.environ.get("LLM_PROVIDER", ""),
            "model": llm_model.split("/")[-1] or llm_model,
            "ok": bool(os.environ.get("LLM_API_KEY")) and llm_model.startswith("groq/"),
        },
        "embeddings": {
            "provider": os.environ.get("EMBEDDING_PROVIDER", ""),
            "model": emb_model.split("/")[-1] or emb_model,
            "dim": int(emb_dim) if emb_dim.isdigit() else emb_dim,
            "ok": emb_dim == "384" and os.environ.get("EMBEDDING_PROVIDER") == "fastembed",
        },
        "db": {**db, "connected": connected},
        "ingested": ingested,
        "nodes": counts.get("nodes"),
        "edges": counts.get("edges"),
        "openai_present": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
    }


@router.get("/sources")
async def sources() -> dict:
    """Evidence list for the ACTIVE case with ingest status. Demo reads the seeded
    directory + graph tags; an upload reads its registry file entries."""
    case = cases.active_case()

    if case.get("kind") != "demo":
        out = []
        for f in case.get("files", []):
            source_type, reliability = ingest.source_meta_for(f["filename"])
            out.append({
                "filename": f["filename"],
                "source_type": source_type,
                "reliability": reliability,
                "held_back": False,
                "purged": False,
                "in_graph": f.get("status") == cases.STATUS_IN_GRAPH,
                "status": f.get("status"),
                "error": f.get("error"),
            })
        return {"sources": out}

    try:
        present = await cognee_engine.present_source_tags()
    except Exception:
        present = set()
    purged = cognee_engine.purged_sources()

    out = []
    for d in ingest.load_all_evidence(case["evidence_dir"]):
        stem = Path(d.filename).stem.lower()
        in_graph = d.filename.lower() in present or stem in present
        out.append({
            "filename": d.filename,
            "source_type": d.source_type,
            "reliability": d.reliability,
            "held_back": d.filename in cognee_engine.HELD_BACK_SOURCES,
            "purged": d.filename in purged,
            "in_graph": in_graph,
        })
    return {"sources": out}


@router.get("/evidence/{filename}")
async def evidence(filename: str, line: int = Query(None, ge=0)) -> dict:
    """Return the raw provenance-wrapped log lines for a source (for a citation
    chip). Filename is basename-sanitized and read from the ACTIVE case's dir."""
    case = cases.active_case()
    safe = os.path.basename(filename)
    path = Path(case["evidence_dir"]) / safe
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"evidence not found: {safe}")

    doc = ingest.read_evidence_file(path)
    all_lines = doc.text.splitlines()
    # header = first 3 lines (SOURCE / SOURCE TYPE / RELIABILITY), then '---'.
    body = [ln for ln in all_lines[4:] if ln.strip()]
    return {
        "filename": safe,
        "source_type": doc.source_type,
        "reliability": doc.reliability,
        "header": "\n".join(all_lines[:3]),
        "lines": body,
        "line": body[line] if (line is not None and 0 <= line < len(body)) else None,
    }
