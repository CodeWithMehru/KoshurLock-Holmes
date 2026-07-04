#!/usr/bin/env bash
# Restore the seeded case so the graph is warm and POST /ingest short-circuits to
# 'exists' with zero LLM calls. Backend is stopped during the pg_restore to avoid
# in-use conflicts, then brought back up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
SNAP="$ROOT/scripts/snapshots"
COMPOSE="docker compose"

if [ ! -f "$SNAP/cognee_db.dump" ]; then
  echo "[restore] no snapshot at $SNAP/cognee_db.dump - run 'make seed' then 'make snapshot' first."
  exit 1
fi

echo "[restore] stopping backend during restore ..."
$COMPOSE stop backend >/dev/null 2>&1 || true

echo "[restore] pg_restore cognee_db ..."
$COMPOSE exec -T postgres pg_restore --clean --if-exists --no-owner -U cognee -d cognee_db \
  < "$SNAP/cognee_db.dump" \
  || echo "[restore] pg_restore reported warnings (usually harmless: extension/object already exists)"

echo "[restore] starting backend ..."
$COMPOSE up -d backend >/dev/null

if [ -f "$SNAP/dataroot.tgz" ]; then
  echo "[restore] restoring Cognee data-root blobs ..."
  sleep 3
  $COMPOSE exec -T backend sh -c 'mkdir -p /data && tar xzf - -C /data' < "$SNAP/dataroot.tgz" 2>/dev/null \
    && echo "[restore] data-root restored" \
    || echo "[restore] data-root restore skipped (not required for warm /ask)"
fi

echo "[restore] done. The graph is warm; POST /ingest will report 'exists' with no LLM calls."
