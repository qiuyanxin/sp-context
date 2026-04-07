#!/bin/bash
# SessionStart hook: minimal context injection (~100 tokens)
# Design: T0 (status line) + T1 (compressed catalog) only
# CLI help lives in CLAUDE.md / sp --help (not injected every session)
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SP_REPO="${SP_CONTEXT_REPO:-$HOME/sp-context}"

[ ! -d "$SP_REPO" ] && exit 0

INDEX_FILE="$SP_REPO/INDEX.json"

# Auto-pull (best effort, 3s timeout)
if command -v git &>/dev/null && [ -d "$SP_REPO/.git" ]; then
  (cd "$SP_REPO" && git pull --rebase --quiet 2>/dev/null &
   BGPID=$!; sleep 3; kill $BGPID 2>/dev/null; wait $BGPID 2>/dev/null) || true
fi

# Rebuild INDEX.json if stale (>1h) or missing
if [ ! -f "$INDEX_FILE" ] || [ "$(find "$INDEX_FILE" -mmin +60 2>/dev/null)" ]; then
  if command -v bun &>/dev/null; then
    SP_CONTEXT_REPO="$SP_REPO" bun run "$PLUGIN_ROOT/src/index-builder.ts" 2>/dev/null || true
  fi
fi

[ ! -f "$INDEX_FILE" ] && exit 0

TOTAL=$(jq '.entries | length' "$INDEX_FILE" 2>/dev/null || echo 0)
[ "$TOTAL" = "0" ] && exit 0

# ── Date references for freshness ──
TODAY=$(date +%Y-%m-%d 2>/dev/null || echo "2026-04-07")
D30=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d 2>/dev/null || echo "2026-03-08")
D90=$(date -v-90d +%Y-%m-%d 2>/dev/null || date -d '90 days ago' +%Y-%m-%d 2>/dev/null || echo "2026-01-07")

# ── Freshness counts ──
FRESH_COUNT=$(jq -r --arg d30 "$D30" '[.entries[] | select(.date != null and .date >= $d30)] | length' "$INDEX_FILE" 2>/dev/null || echo 0)
AGING_COUNT=$(jq -r --arg d30 "$D30" --arg d90 "$D90" '[.entries[] | select(.date != null and .date >= $d90 and .date < $d30)] | length' "$INDEX_FILE" 2>/dev/null || echo 0)
STALE_COUNT=$(jq -r --arg cutoff "$D90" '[.entries[] | select(.date != null and .date < $cutoff)] | length' "$INDEX_FILE" 2>/dev/null || echo 0)

UPDATED=$(jq -r '.entries[0].date // "unknown"' "$INDEX_FILE" 2>/dev/null || echo "unknown")

# ── T1: Compressed catalog (abbreviated format, ~50 tokens) ──
COMPACT_CATALOG=$(jq -r '
  .entries | group_by(.path | split("/")[0]) |
  map({dir: .[0].path | split("/")[0], count: length}) |
  sort_by(-.count) |
  map("\(.dir)/\(.count)") |
  join(" ")
' "$INDEX_FILE" 2>/dev/null || echo "")

# ── T0: systemMessage (user-visible status line) ──
SYS_MSG="[sp-context] ${TOTAL} docs | ${COMPACT_CATALOG}"

# ── T1: additionalContext (AI-only, compressed catalog) ──
read -r -d '' AI_CONTEXT <<CTXEOF || true
KB:${TOTAL}docs|${COMPACT_CATALOG}|upd:${UPDATED}
fresh:${FRESH_COUNT}<30d ${AGING_COUNT}:30-90d ${STALE_COUNT}>90d
cmds: sp search|get|list|push|add|doctor|schema|gc|sync|config — run sp --help for full reference
CTXEOF

# ── Output JSON ──
jq -n \
  --arg sys "$SYS_MSG" \
  --arg ctx "$AI_CONTEXT" \
  '{
    systemMessage: $sys,
    additionalContext: $ctx
  }'
