"""Case registry + graph-swap state for Tracepoint.

Tracepoint keeps ONE case materialized in the shared Cognee graph at a time
(graph-swap): this avoids Cognee 1.2.2's leaky dataset-scoped search so the
demo's scripted "Turn" and an analyst's uploaded case never blend answers.

This module is the small, pure bookkeeping layer around that model:

* a JSON registry (``cases.json`` on the ``dataroot`` volume) of every case,
* which case is ACTIVE (what the UI is viewing) and which is MATERIALIZED
  (whose data is currently in the graph),
* per-file ingest status for uploaded evidence.

No Cognee import here - the engine performs the actual add/cognify/restore and
calls back into this module to record status. The demo case is always present
and points at the baked-in ``backend/data`` directory.
"""

from __future__ import annotations

import json
import re
import shutil
import threading
from pathlib import Path
from typing import Any, Optional

from .settings import CASE_DATASET, CASES_FILE, DATA_DIR, UPLOADS_DIR

DEMO_ID = "demo"

# Per-file ingest lifecycle used by the upload UI.
STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_IN_GRAPH = "in_graph"
STATUS_FAILED = "failed"

ALLOWED_EXTENSIONS = {".csv", ".txt", ".pdf", ".docx", ".md"}

# One lock guards the registry file + the in-memory copy (single worker, async,
# but background ingest tasks touch this too).
_lock = threading.RLock()
_registry: Optional[dict[str, Any]] = None


def _demo_case() -> dict[str, Any]:
    """The always-present seeded case, backed by the committed warm snapshot."""
    return {
        "id": DEMO_ID,
        "name": "Northgate Financial",
        "case_id_label": "NGF-2026-0701",
        "descriptor": "data exfiltration",
        "kind": "demo",
        "evidence_dir": str(DATA_DIR),
        "dataset": CASE_DATASET,
        "created_at": "2026-06-30T00:00:00",
        "files": [],  # demo files are enumerated live from DATA_DIR
    }


def _blank_registry() -> dict[str, Any]:
    return {
        "active_case_id": DEMO_ID,
        "materialized_case_id": DEMO_ID,
        "cases": {DEMO_ID: _demo_case()},
    }


def _load() -> dict[str, Any]:
    global _registry
    if _registry is not None:
        return _registry
    reg = _blank_registry()
    try:
        if CASES_FILE.is_file():
            stored = json.loads(CASES_FILE.read_text(encoding="utf-8"))
            if isinstance(stored, dict) and isinstance(stored.get("cases"), dict):
                reg = stored
    except Exception:
        reg = _blank_registry()
    # The demo case is authoritative code, not stored config - always refresh it.
    reg.setdefault("cases", {})
    reg["cases"][DEMO_ID] = _demo_case()
    reg.setdefault("active_case_id", DEMO_ID)
    reg.setdefault("materialized_case_id", DEMO_ID)
    _registry = reg
    return reg


def _save() -> None:
    reg = _load()
    try:
        CASES_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = CASES_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(reg, indent=2), encoding="utf-8")
        tmp.replace(CASES_FILE)
    except Exception:
        # Persistence is best-effort; the in-memory registry still works.
        pass


# --------------------------------------------------------------------------- #
# Reads
# --------------------------------------------------------------------------- #
def list_cases() -> list[dict[str, Any]]:
    with _lock:
        reg = _load()
        return [_public(c) for c in reg["cases"].values()]


def get_case(case_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        return _load()["cases"].get(case_id)


def active_case() -> dict[str, Any]:
    with _lock:
        reg = _load()
        return reg["cases"].get(reg["active_case_id"]) or reg["cases"][DEMO_ID]


def active_case_id() -> str:
    with _lock:
        return _load()["active_case_id"]


def materialized_case_id() -> str:
    with _lock:
        return _load()["materialized_case_id"]


def state() -> dict[str, Any]:
    with _lock:
        reg = _load()
        return {
            "active_case_id": reg["active_case_id"],
            "materialized_case_id": reg["materialized_case_id"],
            "cases": [_public(c) for c in reg["cases"].values()],
        }


def _public(case: dict[str, Any]) -> dict[str, Any]:
    """A registry entry annotated with derived flags for the API/UI."""
    reg = _load()
    files = case.get("files", [])
    return {
        **case,
        "materialized": reg["materialized_case_id"] == case["id"],
        "active": reg["active_case_id"] == case["id"],
        "file_count": len(files),
        "in_graph_count": sum(1 for f in files if f.get("status") == STATUS_IN_GRAPH),
    }


# --------------------------------------------------------------------------- #
# Mutations
# --------------------------------------------------------------------------- #
def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or "case"


def create_case(name: str) -> dict[str, Any]:
    """Register a new (empty) upload case and create its evidence directory."""
    with _lock:
        reg = _load()
        base = _slug(name)
        cid = base
        n = 2
        while cid in reg["cases"]:
            cid = f"{base}-{n}"
            n += 1
        evidence_dir = UPLOADS_DIR / cid
        try:
            evidence_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        case = {
            "id": cid,
            "name": name.strip() or "Untitled case",
            "case_id_label": f"CASE-{cid.upper()}",
            "descriptor": "analyst upload",
            "kind": "upload",
            "evidence_dir": str(evidence_dir),
            "dataset": f"case_{re.sub(r'[^a-z0-9]+', '_', cid)}",
            "created_at": "",  # stamped by caller if desired; avoid nondeterminism here
            "files": [],
        }
        reg["cases"][cid] = case
        _save()
        return case


def set_active(case_id: str) -> None:
    with _lock:
        reg = _load()
        if case_id in reg["cases"]:
            reg["active_case_id"] = case_id
            _save()


def set_materialized(case_id: str) -> None:
    with _lock:
        reg = _load()
        if case_id in reg["cases"]:
            reg["materialized_case_id"] = case_id
            _save()


def delete_case(case_id: str) -> None:
    """Remove an uploaded case: its registry entry and its uploaded files.

    The demo case is protected and can never be deleted here. Graph/DB cleanup is
    the caller's job (only the materialized case has a graph footprint). Active /
    materialized pointers that referenced the deleted case fall back to the demo.
    """
    with _lock:
        reg = _load()
        case = reg["cases"].get(case_id)
        if not case:
            raise ValueError(f"case not found: {case_id!r}")
        if case.get("kind") == "demo":
            raise ValueError("the demo case is protected and cannot be deleted")

        # Delete the upload folder - but ONLY if it lives under UPLOADS_DIR, so the
        # demo's baked-in DATA_DIR can never be touched even by a malformed record.
        evidence_dir = Path(case.get("evidence_dir", ""))
        try:
            if evidence_dir.is_dir() and str(evidence_dir.resolve()).startswith(
                str(UPLOADS_DIR.resolve())
            ):
                shutil.rmtree(evidence_dir, ignore_errors=True)
        except Exception:
            pass

        reg["cases"].pop(case_id, None)
        if reg.get("active_case_id") == case_id:
            reg["active_case_id"] = DEMO_ID
        if reg.get("materialized_case_id") == case_id:
            reg["materialized_case_id"] = DEMO_ID
        _save()


def add_files(case_id: str, filenames: list[str]) -> dict[str, Any]:
    """Register uploaded files as QUEUED (dedup by filename)."""
    with _lock:
        reg = _load()
        case = reg["cases"].get(case_id)
        if not case or case["kind"] == "demo":
            raise ValueError(f"cannot add files to case {case_id!r}")
        existing = {f["filename"] for f in case["files"]}
        for name in filenames:
            if name in existing:
                # Re-queue an overwritten file.
                for f in case["files"]:
                    if f["filename"] == name:
                        f["status"] = STATUS_QUEUED
                        f.pop("error", None)
            else:
                case["files"].append({"filename": name, "status": STATUS_QUEUED})
        _save()
        return case


def set_file_status(case_id: str, filename: str, status: str, error: str | None = None) -> None:
    with _lock:
        reg = _load()
        case = reg["cases"].get(case_id)
        if not case:
            return
        for f in case["files"]:
            if f["filename"] == filename:
                f["status"] = status
                if error:
                    f["error"] = error[:500]
                else:
                    f.pop("error", None)
                break
        _save()


def queued_or_all_files(case_id: str) -> list[str]:
    """Filenames to ingest: queued/failed if any, otherwise every registered file
    (used when re-materializing a case that was pruned by a graph-swap)."""
    with _lock:
        case = _load()["cases"].get(case_id)
        if not case:
            return []
        pending = [
            f["filename"] for f in case["files"]
            if f.get("status") in (STATUS_QUEUED, STATUS_FAILED)
        ]
        return pending or [f["filename"] for f in case["files"]]


def evidence_path(case: dict[str, Any], filename: str) -> Path:
    return Path(case["evidence_dir"]) / Path(filename).name
