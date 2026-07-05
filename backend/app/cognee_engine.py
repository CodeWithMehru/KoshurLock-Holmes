"""The Tracepoint investigation engine - a thin, robust async wrapper
around Cognee's memory lifecycle.

Four investigator operations map onto Cognee's real memory verbs:

    ingest_all()  ->  remember   (cognee.add + cognee.cognify)
    ask()         ->  recall     (cognee.search: answer + entities + timeline)
    teach()       ->  improve    (add a CONFIRMED correction + cognify + cognee.improve)
    purge()       ->  forget     (cognee.forget one source, so its conclusions collapse)

Ported from the v1 backup, with the Streamlit-specific persistent-event-loop
thread removed: FastAPI endpoints are already async and ``await`` Cognee directly.
DB-mutating work is serialized by an ``asyncio.Lock`` (matters for the Kuzu
fallback, and prevents Groq free-tier 429 storms); searches go through a small
semaphore. Run uvicorn with a single worker so these in-process primitives are
authoritative.

Design notes carried over:
* Most evidence lives in ONE shared dataset (``case_evidence``) so cross-source
  entity resolution stays tight. Only sources we want to forget individually get
  their own dataset, so purge() is a clean ``cognee.forget(dataset=...)``.
* Signature shims (``_accepts`` + ``inspect.signature``) tolerate Cognee param
  drift across releases.
* Every LLM-backed call is wrapped in exponential backoff so a transient Groq
  free-tier 429 does not abort a whole ingest.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import os
import re
from pathlib import Path
from typing import Any, Callable, Optional

from . import ingest
from .settings import CASE_DATASET, configure

# Ensure env is populated and the no-OpenAI guard has fired BEFORE importing
# cognee. configure() is idempotent; verbose=False keeps this import quiet.
configure(verbose=False)

import cognee  # noqa: E402  (must come after configure())
from cognee.modules.search.types import SearchType  # noqa: E402

TEMPORAL_COGNIFY = os.environ.get("TEMPORAL_COGNIFY", "false").strip().lower() in (
    "1", "true", "yes", "on",
)

log = logging.getLogger("tracepoint.engine")

# Hard per-file ceiling on add+cognify (including retry backoff) so one file
# stuck behind an exhausted Groq quota cannot hang the whole ingest queue.
try:
    INGEST_FILE_TIMEOUT_S = float(os.environ.get("INGEST_FILE_TIMEOUT_S", "360"))
except ValueError:
    INGEST_FILE_TIMEOUT_S = 360.0

# Substrings marking a Groq free-tier rate limit; shared by the retry loop and
# the per-file error messages shown in the upload UI.
_RATE_LIMIT_MARKERS = ("rate limit", "ratelimit", "429", "too many requests")

# Each visible rate-limit wait is capped here; the file retries until it
# completes (or the ingest is cancelled), so the cap only bounds one nap.
_RATE_LIMIT_WAIT_CAP_S = 120.0

# Groq/litellm embed the retry hint in the message, e.g. "Please try again in
# 7.66s" or "in 2m59.559s"; some providers say "Retry-After: 30".
_RETRY_AFTER_RE = re.compile(
    r"try again in\s+(?:(\d+)\s*m)?(\d+(?:\.\d+)?)\s*s", re.IGNORECASE
)
_RETRY_AFTER_HDR_RE = re.compile(r"retry[- ]after[:\s]+(\d+(?:\.\d+)?)", re.IGNORECASE)


def _is_rate_limit(exc: Exception) -> bool:
    """True for provider rate limits (litellm RateLimitError / Groq 429s)."""
    if "ratelimit" in type(exc).__name__.lower():
        return True
    return any(k in str(exc).lower() for k in _RATE_LIMIT_MARKERS)


# NOTE on the timeout default: cognee's LLM layer retries 429s internally with
# a tenacity policy that only gives up after >= 2 attempts AND >= 240s elapsed
# (cognee/infrastructure/llm/retry_config.py, not configurable). The per-file
# timeout MUST stay above that floor (~255s observed) or a rate-limited file
# is cut off mid-backoff and mis-classified as a hard timeout - the
# InstructorRetryException that finally surfaces carries the RateLimitError
# text that _is_rate_limit() matches.


def _retry_after_s(exc: Exception, attempt: int) -> float:
    """Seconds to wait before retrying a rate-limited call: the provider's own
    hint when the message carries one, else an escalating default. Clamped to
    [2, _RATE_LIMIT_WAIT_CAP_S]."""
    msg = str(exc)
    wait: Optional[float] = None
    m = _RETRY_AFTER_RE.search(msg)
    if m:
        wait = (int(m.group(1) or 0)) * 60 + float(m.group(2))
    else:
        h = _RETRY_AFTER_HDR_RE.search(msg)
        if h:
            wait = float(h.group(1))
    if wait is None:
        wait = 15.0 * (2 ** max(0, attempt - 1))  # 15, 30, 60, 120, 120...
    return max(2.0, min(wait, _RATE_LIMIT_WAIT_CAP_S))


# --------------------------------------------------------------------------- #
# Public constants (shared with the API and the smoke tests)
# --------------------------------------------------------------------------- #
CORRECTION_DATASET = "analyst_correction"

# Sources ingested into their own dataset so a single forget-by-dataset drops
# them cleanly. The planted anonymous tip is the demo target.
OWN_DATASET_SOURCES: frozenset[str] = frozenset({"anonymous_tip.txt"})

# The phishing note is the "fact" the analyst connects mid-investigation via
# teach(); holding it back from the initial ingest makes the before/after flip
# crisp. Any OTHER file dropped into data/ is still ingested automatically.
HELD_BACK_SOURCES: frozenset[str] = frozenset({"phishing_evidence.txt"})

# The single question the whole demo turns on.
CENTRAL_QUESTION = (
    "Who is responsible for the after-hours download and exfiltration of the "
    "customer database on the night of 30 June - 1 July, and what actually happened?"
)

# The analyst correction taught in the reveal - CONFIRMED, entity-explicit, and
# causal, reusing exact strings already in the graph so it links (not islands).
DEFAULT_CORRECTION = (
    "CONFIRMED FINDING (SOC determination, ref SOC-2026-0619): The IP address "
    "41.220.13.7 (egress Lagos, NG) is a KNOWN EXTERNAL ATTACKER and part of a "
    "credential-abuse cluster. Rahul Sharma's corporate credentials (user rsharma) "
    "were PHISHED and STOLEN on 2026-06-19; the password was never rotated and "
    "MFA was not enforced on the legacy VPN. Therefore the VPN login and the file "
    "downloads on 2026-07-01 between 01:58 and 02:41 originating from 41.220.13.7 "
    "were an ACCOUNT TAKEOVER by the external attacker using Rahul Sharma's stolen "
    "credentials - they were NOT actions performed by Rahul Sharma. Rahul Sharma was "
    "physically inside the Northgate office working late at that time (confirmed by "
    "badge_logs and cctv_events) and could not simultaneously log in from Lagos. "
    "Rahul Sharma did NOT exfiltrate the customer database and was framed; the recent "
    "resignation is a coincidental red herring, not a motive for this incident."
)


# --------------------------------------------------------------------------- #
# Concurrency primitives (single-worker process)
# --------------------------------------------------------------------------- #
_mutate_lock = asyncio.Lock()      # serialize add/cognify/teach/forget/prune
_llm_semaphore = asyncio.Semaphore(1)  # throttle concurrent Groq-backed searches

# Minimal in-memory state so the API can reflect what's loaded this session.
_STATE: dict[str, Any] = {"purged": set()}

# Case ids whose in-flight ingest should stop after the current file. Set by
# the cancel endpoint, consumed by materialize_case. Single event loop, so a
# plain set is safe.
_cancel_requested: set[str] = set()


def request_cancel(case_id: str) -> None:
    """Ask a running materialize_case(case_id) to stop after the current file."""
    _cancel_requested.add(case_id)


# --------------------------------------------------------------------------- #
# Low-level helpers (signature shims, retry, result parsing)
# --------------------------------------------------------------------------- #
def _accepts(fn: Callable, name: str) -> bool:
    try:
        return name in inspect.signature(fn).parameters
    except (TypeError, ValueError):
        return False


async def _with_retry(
    make_coro: Callable[[], Any],
    tries: int = 5,
    base: float = 2.0,
    raise_rate_limit: bool = False,
):
    """Await ``make_coro()`` with retry on two transient classes:

    * Groq free-tier rate limits -> exponential backoff (or, with
      ``raise_rate_limit=True``, surface immediately so the caller can show a
      visible waiting state instead of burning its timeout budget here).
    * Postgres write contention during concurrent graph builds
      (``DeadlockDetectedError`` / serialization failures) -> short backoff; the
      transaction rolls back and the call re-runs instead of failing the file.
    Any other exception is re-raised immediately.
    """
    last: Optional[Exception] = None
    for attempt in range(tries):
        try:
            return await make_coro()
        except Exception as exc:  # noqa: BLE001 - we re-raise non-transient errors
            last = exc
            msg = str(exc).lower()
            ename = type(exc).__name__.lower()
            if any(k in msg for k in _RATE_LIMIT_MARKERS):
                if raise_rate_limit:
                    raise
                await asyncio.sleep(base * (2 ** attempt))
                continue
            if (
                "deadlock" in ename
                or "deadlock" in msg
                or "serialization" in msg
                or "could not serialize" in msg
            ):
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
            raise
    assert last is not None
    raise last


def _extract_results(raw: Any) -> list[str]:
    """Flatten Cognee's ``List[SearchResult]`` into a list of answer strings."""
    out: list[str] = []
    for item in raw or []:
        if isinstance(item, dict):
            sr = item.get("search_result")
        else:
            sr = getattr(item, "search_result", None)
        if sr is None:
            if isinstance(item, str):
                out.append(item)
            continue
        if isinstance(sr, (list, tuple)):
            out.extend(str(x) for x in sr)
        else:
            out.append(str(sr))
    return [s for s in (x.strip() for x in out) if s]


async def _search(query: str, query_type, top_k: int = 15,
                  datasets: Optional[list[str]] = None, only_context: bool = False):
    """Version-tolerant wrapper around ``cognee.search``."""
    kw: dict[str, Any] = {}
    kw["query_text" if _accepts(cognee.search, "query_text") else "query"] = query
    kw["query_type" if _accepts(cognee.search, "query_type") else "search_type"] = query_type
    if _accepts(cognee.search, "top_k"):
        kw["top_k"] = top_k
    if datasets and _accepts(cognee.search, "datasets"):
        kw["datasets"] = datasets
    if only_context and _accepts(cognee.search, "only_context"):
        kw["only_context"] = True
    return await cognee.search(**kw)


async def _cognify(datasets: list[str]):
    kw: dict[str, Any] = {}
    if TEMPORAL_COGNIFY and _accepts(cognee.cognify, "temporal_cognify"):
        kw["temporal_cognify"] = True
    return await cognee.cognify(datasets=datasets, **kw)


async def _graph_counts() -> dict[str, Optional[int]]:
    try:
        from cognee.infrastructure.databases.graph import get_graph_engine
        engine = await get_graph_engine()
        data = await engine.get_graph_data()
        if isinstance(data, (list, tuple)) and len(data) == 2:
            nodes, edges = data
            return {"nodes": len(nodes), "edges": len(edges)}
    except Exception:
        pass
    return {"nodes": None, "edges": None}


async def _graph_is_empty() -> bool:
    from cognee.infrastructure.databases.graph import get_graph_engine
    engine = await get_graph_engine()
    return await engine.is_empty()


# --------------------------------------------------------------------------- #
# Dataset naming & source bookkeeping
# --------------------------------------------------------------------------- #
def _stem(filename: str) -> str:
    return Path(filename).stem.lower().replace(" ", "_").replace("-", "_")


def _dataset_for(filename: str) -> str:
    """Which dataset a file goes in: its own (if individually forgettable) or the
    shared case dataset."""
    return _stem(filename) if filename in OWN_DATASET_SOURCES else CASE_DATASET


def active_source_files(held_back: frozenset[str] = HELD_BACK_SOURCES) -> list[str]:
    """Filenames the initial ingest loads (every file except held-back)."""
    return [d.filename for d in ingest.load_all_evidence() if d.filename not in held_back]


# --------------------------------------------------------------------------- #
# OP 1 - ingest_all (remember)
# --------------------------------------------------------------------------- #
async def is_ingested() -> bool:
    """True if the graph already has data (survives restarts / restore)."""
    try:
        return not await _graph_is_empty()
    except Exception:
        return False


async def graph_counts() -> dict:
    return await _graph_counts()


async def ingest_all(rebuild: bool = False,
                     held_back: frozenset[str] = HELD_BACK_SOURCES) -> dict:
    """Load every evidence file (except held-back) into its dataset and build the
    knowledge graph. Returns a summary the API can render.

    Warm-start short-circuit: a full ingest is slow and burns Groq tokens, so if
    the graph already has data and no rebuild was requested, just report the case.
    """
    docs = [d for d in ingest.load_all_evidence() if d.filename not in held_back]
    if not docs:
        raise RuntimeError("No evidence files to ingest.")

    if not rebuild and await is_ingested():
        files = [d.filename for d in docs]
        datasets = {f: _dataset_for(f) for f in files}
        counts = await graph_counts()
        return {"status": "exists", "files": files, "datasets": datasets,
                "held_back": sorted(held_back), **counts}

    async with _mutate_lock:
        if rebuild:
            await _prune_all_async()
            _STATE["purged"] = set()

        datasets: dict[str, str] = {}
        for doc in docs:
            ds = _dataset_for(doc.filename)
            datasets[doc.filename] = ds
            await _with_retry(
                lambda d=doc, s=ds: cognee.add(d.text, dataset_name=s, node_set=[d.filename])
            )

        unique_datasets = sorted(set(datasets.values()))
        await _with_retry(lambda: _cognify(unique_datasets))
        counts = await _graph_counts()

    return {
        "status": "ok",
        "files": [d.filename for d in docs],
        "datasets": datasets,
        "held_back": sorted(held_back),
        **counts,
    }


async def materialize_case(case_id: str) -> dict:
    """Ingest an uploaded case's files as the SOLE case in the graph (graph-swap).

    Prune the current graph, then run the REAL remember path (cognee.add per file
    + one cognify) into the case's own dataset, updating per-file status in the
    registry so the upload UI can poll progress. This is the genuine ingestion
    path an analyst's own evidence flows through - not a mock.
    """
    from . import cases

    case = cases.get_case(case_id)
    if not case or case.get("kind") == "demo":
        raise RuntimeError(f"not an upload case: {case_id!r}")

    # A stale cancel flag from an earlier run must not kill this fresh run.
    _cancel_requested.discard(case_id)

    dataset = case["dataset"]
    filenames = cases.queued_or_all_files(case_id)
    if not filenames:
        raise RuntimeError("no files to ingest for this case")

    async with _mutate_lock:
        if case_id in _cancel_requested:
            # Cancelled while waiting for the lock: nothing pruned or swapped yet.
            _cancel_requested.discard(case_id)
            return {"status": "cancelled", "case_id": case_id, "ingested": []}

        if cases.materialized_case_id() != case_id:
            # Fresh slate: this case becomes the only one materialized in the
            # graph. A retry on the already-materialized case is incremental
            # instead, so files already in_graph keep their graph data.
            await _prune_all_async()
            _STATE["purged"] = set()
        cases.set_materialized(case_id)
        cases.set_active(case_id)

        # Serialize add + cognify ONE FILE AT A TIME so only a single cognify ever
        # writes to the graph tables at once. Running cognify over many documents
        # concurrently makes Postgres deadlock on graph_node INSERTs; sequencing it
        # (plus the deadlock retry in _with_retry) makes multi-file uploads reliable.
        # cognify is incremental, so each call mostly processes the file just added,
        # while cross-file entity resolution still happens in the shared dataset.
        added: list[str] = []
        for name in filenames:
            if case_id in _cancel_requested:
                log.info(
                    "ingest of case %s cancelled; %s and later files skipped",
                    case_id, name,
                )
                break
            path = cases.evidence_path(case, name)
            cases.set_file_status(case_id, name, cases.STATUS_PROCESSING)

            # raise_rate_limit=True: rate limits surface immediately instead of
            # burning the wait_for budget inside _with_retry's backoff - the
            # visible waiting loop below owns ALL rate-limit waiting, outside
            # the per-file timeout. Deadlock retries still happen inside.
            async def _ingest_one(p: Path = path) -> None:
                doc = ingest.read_evidence_file(p)
                await _with_retry(
                    lambda d=doc, ds=dataset: cognee.add(
                        d.text, dataset_name=ds, node_set=[d.filename]
                    ),
                    raise_rate_limit=True,
                )
                await _with_retry(
                    lambda ds=dataset: _cognify([ds]), raise_rate_limit=True
                )

            # Retry the SAME file through rate limits (visible "waiting" status,
            # queue paused behind it); real errors fail it and move on.
            rl_attempt = 0
            while True:
                if case_id in _cancel_requested:
                    break  # cancel already flipped this file via fail_queued
                rl_hint: Optional[str] = None
                try:
                    # Hard ceiling per attempt so genuinely stuck work fails
                    # this file and the queue moves on. Kept above cognee's
                    # internal 240s retry floor - see note near the constant.
                    await asyncio.wait_for(
                        _ingest_one(), timeout=INGEST_FILE_TIMEOUT_S
                    )
                    cases.set_file_status(case_id, name, cases.STATUS_IN_GRAPH)
                    added.append(name)
                    break
                except TimeoutError:
                    cases.set_file_status(
                        case_id, name, cases.STATUS_FAILED,
                        f"ingest timed out after {int(INGEST_FILE_TIMEOUT_S)}s "
                        "(stuck or very slow provider) - run ingest again to retry",
                    )
                    break
                except Exception as exc:  # noqa: BLE001
                    if _is_rate_limit(exc):
                        rl_hint = str(exc)
                    else:
                        cases.set_file_status(
                            case_id, name, cases.STATUS_FAILED, str(exc)
                        )
                        break

                # Rate limited: wait visibly (cancellable), then retry this file.
                rl_attempt += 1
                wait = _retry_after_s(Exception(rl_hint or ""), rl_attempt)
                log.info(
                    "rate limited on %s (attempt %d); waiting %.0fs",
                    name, rl_attempt, wait,
                )
                cases.set_file_status(
                    case_id, name, cases.STATUS_RATE_LIMITED,
                    f"waiting - rate limited (retry in {int(wait)}s, "
                    f"attempt {rl_attempt})",
                )
                # 1s slices so Cancel interrupts the wait immediately.
                for _ in range(int(wait)):
                    if case_id in _cancel_requested:
                        break
                    await asyncio.sleep(1)
                if case_id in _cancel_requested:
                    break  # file already flipped by fail_queued
                cases.set_file_status(case_id, name, cases.STATUS_PROCESSING)
                # loop continues: same file, fresh timeout budget

        counts = await _graph_counts()

    _cancel_requested.discard(case_id)
    return {"status": "ok", "case_id": case_id, "dataset": dataset,
            "ingested": added, **counts}


# --------------------------------------------------------------------------- #
# OP 2 - ask (recall)
# --------------------------------------------------------------------------- #
async def ask(question: str, want_timeline: bool = True) -> dict:
    """Answer a multi-hop question. Returns answer + connected entities + timeline."""
    async with _llm_semaphore:
        answer_raw = await _with_retry(
            lambda: _search(question, SearchType.GRAPH_COMPLETION, top_k=15)
        )
        answer = " ".join(_extract_results(answer_raw)) or (
            "No conclusion could be drawn from the current evidence graph."
        )

        entities: list[str] = []
        try:
            ctx = await _search(question, SearchType.GRAPH_COMPLETION, top_k=20,
                                only_context=True)
            entities = _extract_results(ctx)
        except Exception:
            pass

        timeline: list[str] = []
        if want_timeline:
            timeline = await _run_timeline(question)

    from . import cases
    known, keywords = _source_matchers(cases.active_case())
    return {
        "question": question,
        "answer": answer,
        "entities": entities,
        "timeline": timeline,
        "sources": _parse_sources(answer, entities, timeline, known=known, keywords=keywords),
    }


async def _run_timeline(question: str) -> list[str]:
    """Best-effort chronological timeline via TEMPORAL search, with a fallback."""
    tq = (
        "Reconstruct the chronological timeline of events relevant to this "
        f"question, each with its timestamp and source: {question}"
    )
    try:
        raw = await _with_retry(lambda: _search(tq, SearchType.TEMPORAL, top_k=25))
        res = _extract_results(raw)
        if res:
            return res
    except Exception:
        pass
    try:
        raw = await _with_retry(lambda: _search(
            "List every relevant event in chronological order with its exact "
            "timestamp and the source log it came from.",
            SearchType.GRAPH_COMPLETION, top_k=25))
        return _extract_results(raw)
    except Exception:
        return []


_KNOWN_SOURCES = set(ingest.SOURCE_TYPES.keys())

# Natural-language cues the LLM uses instead of the literal filename, so source
# attribution still works when the answer says "the badge logs" etc.
_SOURCE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "vpn_logs.csv": ("vpn", "41.220.13.7", "login from"),
    "file_access_logs.csv": ("file access", "download", "customer_database",
                             "q4_customer", "customer_pii", "exfiltrat"),
    "email_logs.csv": ("email", "attachment", "gmail", "grey.market"),
    "badge_logs.csv": ("badge", "turnstile", "badged"),
    "cctv_events.csv": ("cctv", "camera", "cam-3f"),
    "hr_notes.txt": ("hr note", "resignation", "resigned", "notice period"),
    "phishing_evidence.txt": ("phish", "soc-2026", "account takeover",
                              "stolen credential", "credential"),
    "anonymous_tip.txt": ("anonymous tip", "whistleblower", "tip"),
}


def _parse_sources(
    *chunks: Any,
    known: Optional[set[str]] = None,
    keywords: Optional[dict[str, tuple[str, ...]]] = None,
) -> list[str]:
    """Attribute an answer to source files. ``known``/``keywords`` default to the
    demo maps (byte-for-byte demo behavior); an uploaded case passes its own."""
    known = _KNOWN_SOURCES if known is None else known
    keywords = _SOURCE_KEYWORDS if keywords is None else keywords
    blob_parts: list[str] = []
    for c in chunks:
        if isinstance(c, str):
            blob_parts.append(c)
        elif isinstance(c, (list, tuple)):
            blob_parts.extend(str(x) for x in c)
    blob = "\n".join(blob_parts)
    low = blob.lower()
    found = {f for f in known if f in blob}
    for fname, cues in keywords.items():
        if any(cue in low for cue in cues):
            found.add(fname)
    return sorted(found)


def _source_matchers(case: dict) -> tuple[set[str], dict[str, tuple[str, ...]]]:
    """Source-attribution maps for the active case. Demo uses the curated cues;
    an uploaded case matches by filename and by its stem words."""
    if case.get("kind") == "demo":
        return _KNOWN_SOURCES, _SOURCE_KEYWORDS
    known: set[str] = set()
    keywords: dict[str, tuple[str, ...]] = {}
    for f in case.get("files", []):
        name = f["filename"]
        known.add(name)
        stem = Path(name).stem.lower().replace("_", " ").replace("-", " ").strip()
        cues = tuple(c for c in {name.lower(), stem} if len(c) >= 4)
        if cues:
            keywords[name] = cues
    return known, keywords


# --------------------------------------------------------------------------- #
# OP 3 - teach (improve)
# --------------------------------------------------------------------------- #
async def teach(correction: str, dataset: str = CORRECTION_DATASET,
                use_improve: bool = True) -> dict:
    """Apply an analyst correction: add it as a CONFIRMED source, re-cognify so it
    links into the graph, then best-effort run Cognee's real ``improve`` to
    consolidate/re-weight. The correction alone flips conclusions; improve is a
    bonus that is skipped gracefully if the free tier throttles it."""
    text = _frame_correction(correction)
    async with _mutate_lock:
        await _with_retry(lambda: cognee.add(text, dataset_name=dataset,
                                             node_set=["analyst_correction"]))
        await _with_retry(lambda: _cognify([dataset]))
        improved = await _try_improve(dataset) if use_improve else False
    return {"status": "taught", "dataset": dataset, "improved": improved,
            "correction": text}


def _frame_correction(raw: str) -> str:
    return (
        "SOURCE: analyst_correction\n"
        "SOURCE TYPE: verified analyst finding / SOC determination\n"
        "RELIABILITY: CONFIRMED (highest)\n"
        "---\n"
        f"{raw.strip()}\n"
    )


async def _try_improve(dataset: str) -> bool:
    """Invoke cognee.improve() best-effort (it consolidates truth/feedback)."""
    async def _do():
        kw: dict[str, Any] = {}
        if _accepts(cognee.improve, "build_truth_subspace"):
            kw["build_truth_subspace"] = True
        return await cognee.improve(dataset, **kw)

    try:
        await _do()
        return True
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# OP 4 - purge (forget)
# --------------------------------------------------------------------------- #
async def purge(target: str = "anonymous_tip.txt", recognify: bool = False) -> dict:
    """Surgically forget ONE source so any conclusion built on it collapses.

    * Sources in their own dataset (the planted tip) -> ``cognee.forget(dataset=)``.
    * Sources bundled in ``case_evidence`` -> match the Data record by its
      ``node_set`` tag (= filename) and ``forget(data_id=)`` (delete fallback).
    """
    from . import cases
    case = cases.active_case()
    case_dataset = case.get("dataset", CASE_DATASET)

    async with _mutate_lock:
        if case.get("kind") == "demo" and target in OWN_DATASET_SOURCES:
            ds = _stem(target)
            result = await _forget(dataset=ds)
            method = "forget(dataset)"
        else:
            result = await _forget_bundled_source(target, dataset=case_dataset)
            method = "forget/delete(data_id via node_set)"

        if recognify:
            try:
                await _with_retry(lambda: _cognify([case_dataset]))
            except Exception:
                pass

    _STATE["purged"].add(target)
    return {"status": "purged", "target": target, "method": method,
            "result": str(result)[:400]}


async def _forget(dataset: Optional[str] = None, data_id=None, dataset_id=None):
    kw: dict[str, Any] = {}
    if dataset and _accepts(cognee.forget, "dataset"):
        kw["dataset"] = dataset
    if data_id is not None and _accepts(cognee.forget, "data_id"):
        kw["data_id"] = data_id
    if dataset_id is not None and _accepts(cognee.forget, "dataset_id"):
        kw["dataset_id"] = dataset_id
    if not kw:
        raise RuntimeError("cognee.forget: no usable selector")
    return await cognee.forget(**kw)


def _node_set_of(data) -> list[str]:
    ns = getattr(data, "node_set", None) or []
    if isinstance(ns, str):
        import json
        try:
            ns = json.loads(ns)
        except Exception:
            ns = [ns]
    return [str(x) for x in ns]


async def _forget_bundled_source(filename: str, dataset: str = CASE_DATASET):
    """Forget one file that shares a bundled dataset, matched by its node_set tag.
    ``dataset`` is the demo's case_evidence, or an uploaded case's own dataset."""
    from cognee.modules.users.methods import get_default_user
    from cognee.modules.data.methods import get_datasets_by_name, get_dataset_data

    user = await get_default_user()
    datasets = await get_datasets_by_name(dataset, user.id)
    if not datasets:
        raise RuntimeError(f"dataset {dataset!r} not found")

    results = []
    stem = _stem(filename)
    for ds in datasets:
        for data in await get_dataset_data(ds.id):
            tags = [t.lower() for t in _node_set_of(data)]
            if filename.lower() in tags or stem in tags:
                try:
                    results.append(await _forget(data_id=data.id, dataset_id=ds.id))
                except Exception:
                    results.append(await cognee.delete(data.id, ds.id, mode="hard"))
    if not results:
        raise RuntimeError(
            f"no Data record tagged {filename!r} found in {dataset}"
        )
    return results


# --------------------------------------------------------------------------- #
# Maintenance
# --------------------------------------------------------------------------- #
async def prune_all() -> dict:
    """Dev reset: wipe all data + graph/vector stores."""
    async with _mutate_lock:
        await _prune_all_async()
    _STATE["purged"] = set()
    return {"status": "pruned"}


async def prune_case_leftovers() -> bool:
    """Prune the graph after a case delete - unless another case has been
    materialized meanwhile (its own materialize already swapped the graph, so
    pruning now would destroy fresh work). Returns True if the prune ran."""
    from . import cases

    async with _mutate_lock:
        if cases.materialized_case_id() != cases.DEMO_ID:
            return False
        await _prune_all_async()
    _STATE["purged"] = set()
    return True


async def _prune_all_async():
    try:
        await cognee.prune.prune_data()
    except Exception:
        pass
    try:
        await cognee.prune.prune_system(metadata=True)
    except Exception:
        pass


async def warm_status() -> dict:
    """Lightweight startup probe: is the graph already populated?"""
    try:
        ingested = await is_ingested()
        counts = await graph_counts() if ingested else {"nodes": 0, "edges": 0}
        return {"ingested": ingested, **counts}
    except Exception as exc:  # noqa: BLE001
        return {"ingested": False, "nodes": None, "edges": None, "error": str(exc)}


async def present_source_tags() -> set[str]:
    """The node_set tags (filenames) currently present in the relational store,
    across the case + tip + correction datasets. Powers /sources' in_graph flag."""
    from cognee.modules.users.methods import get_default_user
    from cognee.modules.data.methods import get_datasets_by_name, get_dataset_data

    user = await get_default_user()
    tags: set[str] = set()
    for name in (CASE_DATASET, _stem("anonymous_tip.txt"), CORRECTION_DATASET):
        try:
            datasets = await get_datasets_by_name(name, user.id)
        except Exception:
            datasets = []
        for ds in datasets or []:
            try:
                for data in await get_dataset_data(ds.id):
                    for t in _node_set_of(data):
                        tags.add(str(t).lower())
            except Exception:
                continue
    return tags


def purged_sources() -> set[str]:
    """Sources explicitly forgotten this session."""
    return set(_STATE.get("purged", set()))
