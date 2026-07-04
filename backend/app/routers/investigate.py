"""Recall / improve / forget endpoints:
    POST /ask    -> recall  (cognee.search)
    POST /teach  -> improve (cognee.add CONFIRMED correction + cognify + improve)
    POST /forget -> forget  (cognee.forget one source)
"""

from __future__ import annotations

from fastapi import APIRouter

from .. import cognee_engine
from ..schemas import AskRequest, ForgetRequest, TeachRequest

router = APIRouter(tags=["investigate"])


@router.post("/ask")
async def ask(req: AskRequest) -> dict:
    """Multi-hop recall: answer + connected entities + timeline + cited sources."""
    return await cognee_engine.ask(req.question, want_timeline=req.want_timeline)


@router.post("/teach")
async def teach(req: TeachRequest) -> dict:
    """Add a CONFIRMED analyst correction and re-cognify so the graph reweights."""
    correction = req.correction or cognee_engine.DEFAULT_CORRECTION
    return await cognee_engine.teach(correction)


@router.post("/forget")
async def forget(req: ForgetRequest) -> dict:
    """Surgically forget one evidence source so conclusions built on it collapse."""
    return await cognee_engine.purge(target=req.target)
