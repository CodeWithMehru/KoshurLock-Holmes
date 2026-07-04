"""Graph + timeline endpoints:
    GET /graph    -> SOC-typed nodes+edges for the Cytoscape view
    GET /timeline -> deterministic chronological events (actor-filterable)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query

from .. import cases, cognee_engine, graph_transform, timeline

router = APIRouter(tags=["graph"])


@router.get("/graph")
async def graph(
    include_structural: bool = Query(
        False, description="Include TextDocument/DocumentChunk/EntityType scaffolding."
    ),
    node_set: Optional[str] = Query(
        None, description="Scope to one source's subgraph (filename)."
    ),
) -> dict:
    """Return the knowledge graph as SOC-typed nodes and edges."""
    return await graph_transform.get_graph_payload(
        node_set=node_set, include_structural=include_structural
    )


@router.get("/timeline")
async def get_timeline(
    actor: Optional[str] = Query(None, description="Filter by actor (e.g. rsharma).")
) -> dict:
    """Chronological reconstruction from the ACTIVE case's evidence.

    Demo: every seeded file minus held-back/purged (unchanged). Upload: the
    case's own in-graph files, read from its own evidence directory.
    """
    case = cases.active_case()
    evidence_dir = Path(case["evidence_dir"])
    if case.get("kind") == "demo":
        active = set(cognee_engine.active_source_files()) - cognee_engine.purged_sources()
    else:
        active = {
            f["filename"] for f in case.get("files", [])
            if f.get("status") == cases.STATUS_IN_GRAPH
        }
    events = timeline.build_timeline(active, actor=actor, evidence_dir=evidence_dir)
    return {"events": events, "count": len(events), "actor": actor}
