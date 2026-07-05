"""KoshurLock Holmes - FastAPI application.

Startup order is load-bearing: configure the environment and fire the no-OpenAI
guard BEFORE any module imports cognee. main.py does that here, then imports the
engine (which imports cognee) and the routers.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

# 1) Environment + no-OpenAI guard, before cognee is imported anywhere.
from .settings import configure

configure(verbose=True)

# 2) Now it is safe to import the engine (imports cognee) and routers.
from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from . import cognee_engine, restore  # noqa: E402
from .routers import cases, graph, investigate, meta, remember  # noqa: E402

log = logging.getLogger("tracepoint")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Always warm-restore the demo snapshot on startup when one is present, so a
    # restart / redeploy (which resets case state even when Postgres still holds
    # data) always comes back with the demo materialized. Best-effort; the app
    # still starts if restore fails.
    if restore.snapshot_available():
        log.info("Startup: restoring demo snapshot in-app ...")
        try:
            result = await restore.restore_demo()
            log.info("Demo snapshot restored (nodes=%s edges=%s)",
                     result.get("nodes"), result.get("edges"))
        except Exception as exc:  # noqa: BLE001
            log.warning("in-app snapshot restore failed (%s). Run `make demo`.", exc)
    else:
        status = await cognee_engine.warm_status()
        if status.get("ingested"):
            log.info("Warm start: graph populated (nodes=%s edges=%s)",
                     status.get("nodes"), status.get("edges"))
        else:
            log.info("Cold start: graph empty, no snapshot. Run POST /ingest or `make seed`.")
    yield


app = FastAPI(
    title="KoshurLock Holmes",
    description="Self-hosted AI incident investigator on Cognee + Postgres.",
    version="2.0.0",
    lifespan=lifespan,
)

# Same-origin in production (nginx proxies /api -> backend). CORS stays permissive
# so a split-host dev setup (vite dev server) also works.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(remember.router)
app.include_router(investigate.router)
app.include_router(graph.router)
app.include_router(meta.router)
app.include_router(cases.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": exc.__class__.__name__, "detail": str(exc)},
    )


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "name": "KoshurLock Holmes",
        "ops": {
            "remember": "POST /ingest",
            "recall": "POST /ask",
            "improve": "POST /teach",
            "forget": "POST /forget",
        },
        "views": ["GET /graph", "GET /timeline", "GET /status", "GET /sources",
                  "GET /evidence/{filename}"],
        "cases": ["GET /cases", "POST /cases", "POST /cases/{id}/files",
                  "POST /cases/{id}/ingest", "POST /cases/{id}/open"],
    }