"""POST /ingest -> remember (cognee.add + cognee.cognify)."""

from __future__ import annotations

from fastapi import APIRouter

from .. import cognee_engine
from ..schemas import IngestRequest

router = APIRouter(tags=["remember"])


@router.post("/ingest")
async def ingest(req: IngestRequest) -> dict:
    """Build the evidence knowledge graph. Short-circuits to status 'exists'
    (no LLM calls) when the graph is already populated, unless rebuild=true."""
    return await cognee_engine.ingest_all(rebuild=req.rebuild)
