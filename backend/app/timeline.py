"""Deterministic incident timeline built from the ingested evidence.

The five CSV log sources render each row as ``At <ISO timestamp>, ...`` (see
ingest.py). Parsing those lines gives an exact, source-cited, actor-filterable
chronology with zero LLM calls - the right primitive for a live SOC timeline
panel (the LLM TEMPORAL search is a heavier, less reliable fallback). Purged and
held-back sources are excluded so the timeline reflects the current case file.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

from . import ingest
from .settings import DATA_DIR

# Seconds are optional so uploaded feeds with minute-precision still land.
_AT_LINE = re.compile(r"^At (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?),\s*(.*)$")
_USER = re.compile(r"user '([^']+)'")
_EMPLOYEE = re.compile(r"employee (.+?) badged")
_DETECTED = re.compile(r"detected (.+?)\.")
_EMAIL_FROM = re.compile(r"from (\S+@\S+) to")
_IPV4 = re.compile(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b")


def _actor_of(sentence: str) -> Optional[str]:
    for rx in (_USER, _EMPLOYEE, _DETECTED, _EMAIL_FROM):
        m = rx.search(sentence)
        if m:
            return m.group(1).strip()
    return None


def build_timeline(
    active_files: set[str],
    actor: Optional[str] = None,
    evidence_dir: Path | str = DATA_DIR,
) -> list[dict]:
    """Return chronologically sorted events from the active CSV evidence.

    Any CSV in ``active_files`` is parsed (not just the five demo feeds), read
    from ``evidence_dir`` so an uploaded case's own directory works. The demo
    output is unchanged: its five CSVs render the same "At <ts>, ..." lines.
    """
    evidence_dir = Path(evidence_dir)
    events: list[dict] = []
    for name in sorted(active_files):
        if not name.lower().endswith(".csv"):
            continue
        path = evidence_dir / name
        if not path.is_file():
            continue
        doc = ingest.read_evidence_file(path)
        for line in doc.text.splitlines():
            m = _AT_LINE.match(line.strip())
            if not m:
                continue
            ts, sentence = m.group(1), m.group(2).strip()
            ip = _IPV4.search(sentence)
            events.append({
                "timestamp": ts,
                "actor": _actor_of(sentence),
                "description": sentence,
                "source": name,
                "ip": ip.group(1) if ip else None,
            })

    events.sort(key=lambda e: e["timestamp"])

    if actor:
        a = actor.strip().lower()
        events = [
            e for e in events
            if (e["actor"] and a in e["actor"].lower())
            or a in e["description"].lower()
        ]
    return events
