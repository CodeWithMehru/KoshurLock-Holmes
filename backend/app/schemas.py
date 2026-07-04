"""Pydantic request models for the API. Responses are plain dicts assembled by
the engine, so they stay flexible across Cognee versions."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    rebuild: bool = Field(
        default=False,
        description="Force a full re-ingest. Normally false so a warm graph "
                    "short-circuits without spending Groq tokens.",
    )


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Plain-English question.")
    want_timeline: bool = True


class TeachRequest(BaseModel):
    correction: Optional[str] = Field(
        default=None,
        description="Analyst correction text. Defaults to the case's confirmed "
                    "SOC finding when omitted.",
    )


class ForgetRequest(BaseModel):
    target: str = Field(
        default="anonymous_tip.txt",
        description="Evidence source filename to surgically forget.",
    )


class CreateCaseRequest(BaseModel):
    name: str = Field(
        default="Untitled case",
        min_length=1,
        description="Human-readable case name for a new upload investigation.",
    )
