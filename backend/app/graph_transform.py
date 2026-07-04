"""Transform Cognee's raw graph into SOC-typed nodes/edges for the frontend.

Cognee's ``get_graph_data()`` returns a provider-agnostic tuple:
    nodes = List[(id: str, props: dict)]     # props has {"name", "type", ...}
    edges = List[(source_id, target_id, relationship_name, props)]

The frontend Cytoscape view colors nodes by a small SOC ontology:
    Person, Account, Device, IP, File, Location, Event  (else Other)

Cognee stores domain entities as ``Entity`` nodes linked to an ``EntityType``
node (e.g. "person", "ip address"). We classify by (a) the connected EntityType
name, then (b) a regex/keyword fallback on the entity's own name. Structural
scaffolding (TextDocument, DocumentChunk, EntityType, TextSummary) is tagged
``Document`` and filtered out unless include_structural=True.
"""

from __future__ import annotations

import re
from typing import Any, Optional

# Cognee node "type" values that are graph scaffolding, not domain entities.
_STRUCTURAL_TYPES = {
    "textdocument", "documentchunk", "textsummary", "entitytype", "document",
    "tabledata", "columnvalue",
}

# SOC category <- keyword cues found in an EntityType name or an entity name.
_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Person": ("person", "employee", "user ", "analyst", "staff", "manager",
               "whistleblower", "individual", "people", "attacker", "actor",
               "human"),
    "Account": ("account", "credential", "session", "login", "mailbox",
                "email address", "username", "identity"),
    "Device": ("device", "host", "camera", "cctv", "laptop", "workstation",
               "turnstile", "server", "machine", "endpoint", "gateway", "badge reader"),
    "IP": ("ip address", "ip", "address", "source ip"),
    "File": ("file", "document", "database", "attachment", "spreadsheet",
             "export", "dataset", "customer list"),
    "Location": ("location", "zone", "office", "door", "site", "floor", "city",
                 "building", "wing", "lobby", "egress", "geolocation", "country",
                 "residential", "kitchenette"),
    "Event": ("event", "login attempt", "download", "email", "badge", "detection",
              "incident", "activity", "action", "exfiltration", "resignation",
              "phishing", "logout"),
}

_IPV4 = re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")
_ISO_TS = re.compile(r"\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}", re.IGNORECASE)
_FILE_EXT = re.compile(r"\.(csv|xlsx|docx|pdf|txt|zip|json)\b", re.IGNORECASE)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _classify(name: str, entitytype_name: Optional[str], raw_type: str) -> str:
    """Return a SOC category for a node."""
    rt = (raw_type or "").strip().lower()
    if rt == "event":
        return "Event"

    hay = " ".join(x for x in (entitytype_name or "", name or "") if x).lower()

    # 1) Keyword match against the EntityType name first, then the entity name.
    #    Order matters: check the most specific categories before broad ones.
    for category in ("IP", "File", "Person", "Account", "Device", "Location", "Event"):
        if any(cue in hay for cue in _CATEGORY_KEYWORDS[category]):
            # Guard: "ip" is a short cue; only accept it as a whole word.
            if category == "IP" and not re.search(r"\bip\b", hay) and not _IPV4.search(name or ""):
                continue
            return category

    # 2) Regex fallback on the raw name.
    n = name or ""
    if _IPV4.search(n):
        return "IP"
    if _FILE_EXT.search(n) or "database" in n.lower() or "customer_" in n.lower():
        return "File"
    if _EMAIL.search(n):
        return "Account"
    if _ISO_TS.search(n):
        return "Event"
    return "Other"


def _entitytype_map(nodes: list, edges: list) -> dict[str, str]:
    """Map each Entity node id -> the name of its connected EntityType node."""
    type_node_names: dict[str, str] = {}
    for nid, props in nodes:
        p = props or {}
        if str(p.get("type", "")).strip().lower() == "entitytype":
            type_node_names[str(nid)] = str(p.get("name", ""))

    mapping: dict[str, str] = {}
    for src, tgt, _rel, _props in edges:
        s, t = str(src), str(tgt)
        if t in type_node_names:
            mapping[s] = type_node_names[t]
        elif s in type_node_names:
            mapping.setdefault(t, type_node_names[s])
    return mapping


def transform(nodes: list, edges: list, include_structural: bool = False) -> dict:
    """Build the frontend graph payload from Cognee's (nodes, edges)."""
    type_map = _entitytype_map(nodes, edges)

    out_nodes: list[dict[str, Any]] = []
    kept_ids: set[str] = set()
    counts_by_type: dict[str, int] = {}

    for nid, props in nodes:
        p = dict(props or {})
        nid = str(nid)
        raw_type = str(p.get("type", "")).strip()
        name = str(p.get("name", "") or "")

        if raw_type.lower() in _STRUCTURAL_TYPES:
            if not include_structural:
                continue
            category = "Document"
            label = name or (p.get("text", "") or "")[:60] or raw_type
        else:
            category = _classify(name, type_map.get(nid), raw_type)
            label = name or raw_type or nid[:8]

        kept_ids.add(nid)
        counts_by_type[category] = counts_by_type.get(category, 0) + 1
        meta = {k: v for k, v in p.items() if k not in ("name", "type")}
        out_nodes.append({
            "id": nid,
            "label": label,
            "type": category,
            "raw_type": raw_type,
            "meta": meta,
        })

    out_edges: list[dict[str, Any]] = []
    for src, tgt, rel, _props in edges:
        s, t = str(src), str(tgt)
        if s in kept_ids and t in kept_ids:
            out_edges.append({"source": s, "target": t, "label": str(rel or "")})

    return {
        "nodes": out_nodes,
        "edges": out_edges,
        "counts": {
            "nodes": len(out_nodes),
            "edges": len(out_edges),
            "by_type": counts_by_type,
        },
    }


async def get_graph_payload(node_set: Optional[str] = None,
                            include_structural: bool = False) -> dict:
    """Fetch Cognee's graph and transform it. ``node_set`` optionally scopes to
    one source's subgraph when the adapter supports id-filtering."""
    from cognee.infrastructure.databases.graph import get_graph_engine

    engine = await get_graph_engine()
    nodes, edges = await engine.get_graph_data()
    return transform(nodes, edges, include_structural=include_structural)
