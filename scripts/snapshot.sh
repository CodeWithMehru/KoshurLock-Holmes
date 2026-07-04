#!/usr/bin/env bash
# Save the seeded case so the app starts warm without re-ingesting (the Groq
# token saver). Config A keeps relational + vector + graph in one Postgres, so a
# single pg_dump captures the whole memory stack. The Cognee data-root blobs are
# archived best-effort (only needed for teach/forget AFTER a cold restore).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
SNAP="$ROOT/scripts/snapshots"
mkdir -p "$SNAP"
COMPOSE="docker compose"

echo "[snapshot] pg_dump cognee_db (relational + vector + graph) ..."
$COMPOSE exec -T postgres pg_dump -Fc -U cognee cognee_db > "$SNAP/cognee_db.dump"
echo "[snapshot] wrote $SNAP/cognee_db.dump ($(du -h "$SNAP/cognee_db.dump" | cut -f1))"

if $COMPOSE exec -T backend true >/dev/null 2>&1; then
  echo "[snapshot] archiving Cognee data-root blobs ..."
  if $COMPOSE exec -T backend tar czf - -C /data . > "$SNAP/dataroot.tgz" 2>/dev/null; then
    echo "[snapshot] wrote $SNAP/dataroot.tgz"
  else
    rm -f "$SNAP/dataroot.tgz"
    echo "[snapshot] data-root archive skipped (tar unavailable); pg dump is sufficient for a warm start"
  fi
fi
echo "[snapshot] done."
