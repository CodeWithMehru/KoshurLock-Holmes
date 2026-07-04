"""Case + evidence-upload endpoints (graph-swap two-mode entry):

    GET  /cases                 -> registry + active/materialized ids
    POST /cases                 -> create a new upload case
    POST /cases/{id}/files      -> upload evidence (multipart)
    GET  /cases/{id}/files      -> per-file ingest status (poll)
    POST /cases/{id}/ingest     -> really ingest queued files through Cognee
    POST /cases/{id}/open       -> make this the active + materialized case

The demo case opens warm from the committed snapshot (zero re-ingest); an upload
case is genuinely ingested (cognee.add + cognify). Only one case is materialized
in the graph at a time.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from .. import cases, cognee_engine, restore
from ..schemas import CreateCaseRequest

log = logging.getLogger("tracepoint.cases")
router = APIRouter(tags=["cases"])


@router.get("/cases")
async def list_cases() -> dict:
    return {**cases.state(), "snapshot_available": restore.snapshot_available()}


@router.post("/cases")
async def create_case(req: CreateCaseRequest) -> dict:
    """Create a fresh (empty) upload case. Does NOT touch the live graph yet -
    the demo stays materialized until the analyst ingests their files."""
    case = cases.create_case(req.name)
    return {"case": case}


@router.get("/cases/{case_id}/files")
async def case_files(case_id: str) -> dict:
    case = cases.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"case not found: {case_id}")
    return {
        "case_id": case_id,
        "files": case.get("files", []),
        "materialized": cases.materialized_case_id() == case_id,
    }


@router.post("/cases/{case_id}/files")
async def upload_files(case_id: str, files: list[UploadFile] = File(...)) -> dict:
    """Save uploaded evidence to the case directory and queue it for ingest."""
    case = cases.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"case not found: {case_id}")
    if case.get("kind") == "demo":
        raise HTTPException(status_code=400, detail="cannot upload into the demo case")

    evidence_dir = Path(case["evidence_dir"])
    evidence_dir.mkdir(parents=True, exist_ok=True)

    accepted: list[str] = []
    rejected: list[dict] = []
    for uf in files:
        name = os.path.basename(uf.filename or "").strip()
        ext = Path(name).suffix.lower()
        if not name:
            rejected.append({"filename": "(unnamed)", "reason": "missing filename"})
            continue
        if ext not in cases.ALLOWED_EXTENSIONS:
            rejected.append({"filename": name, "reason": f"unsupported type '{ext or 'none'}'"})
            continue
        try:
            content = await uf.read()
            (evidence_dir / name).write_bytes(content)
            accepted.append(name)
        except Exception as exc:  # noqa: BLE001
            rejected.append({"filename": name, "reason": str(exc)[:200]})

    if accepted:
        cases.add_files(case_id, accepted)

    return {
        "case_id": case_id,
        "accepted": accepted,
        "rejected": rejected,
        "files": cases.get_case(case_id).get("files", []),
    }


@router.post("/cases/{case_id}/ingest")
async def ingest_case(case_id: str, background: BackgroundTasks) -> dict:
    """Kick off the REAL ingest of this case's files (prune + add + cognify).
    Returns immediately; poll GET /cases/{id}/files for per-file progress."""
    case = cases.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"case not found: {case_id}")
    if case.get("kind") == "demo":
        raise HTTPException(status_code=400, detail="the demo case is loaded from its snapshot")
    if not case.get("files"):
        raise HTTPException(status_code=400, detail="no files uploaded for this case")

    cases.set_active(case_id)
    background.add_task(cognee_engine.materialize_case, case_id)
    return {"status": "started", "case_id": case_id}


@router.post("/cases/{case_id}/open")
async def open_case(case_id: str, background: BackgroundTasks) -> dict:
    """Activate a case and materialize it in the graph if it isn't already.

    Demo -> warm restore from the committed snapshot (no LLM). Upload -> real
    re-ingest of its files (only when it isn't the materialized case)."""
    case = cases.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"case not found: {case_id}")

    cases.set_active(case_id)
    if cases.materialized_case_id() == case_id:
        return {"status": "active", "case_id": case_id}

    if case.get("kind") == "demo":
        result = await restore.restore_demo()
        cases.set_materialized(case_id)
        return {"status": "restored", "case_id": case_id, **result}

    if not case.get("files"):
        raise HTTPException(status_code=400, detail="no files uploaded for this case")
    background.add_task(cognee_engine.materialize_case, case_id)
    return {"status": "materializing", "case_id": case_id}


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str) -> dict:
    """Delete an uploaded case: its registry entry, its uploaded files, and (if it
    was the case materialized in the graph) its graph/DB data. The demo case is
    protected and cannot be deleted; deleting the live case restores the demo warm
    so the graph is never left polluted or empty."""
    case = cases.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"case not found: {case_id}")
    if case.get("kind") == "demo":
        raise HTTPException(
            status_code=400, detail="the demo case is protected and cannot be deleted"
        )

    was_materialized = cases.materialized_case_id() == case_id
    # Graph-swap: only the materialized case has any graph/cognee footprint; a
    # non-materialized upload was already pruned by an earlier swap.
    if was_materialized:
        await cognee_engine.prune_all()

    cases.delete_case(case_id)

    restored_demo = False
    if was_materialized:
        try:
            await restore.restore_demo()
            cases.set_materialized(cases.DEMO_ID)
            cases.set_active(cases.DEMO_ID)
            restored_demo = True
        except Exception as exc:  # noqa: BLE001
            log.warning("demo restore after delete failed (%s); run `make demo`.", exc)

    return {"status": "deleted", "case_id": case_id, "restored_demo": restored_demo}
