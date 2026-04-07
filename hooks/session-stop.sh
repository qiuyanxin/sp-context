#!/bin/bash
# Stop hook: smart knowledge extraction reminder
# Uses official JSON output format (matching session-start.sh):
#   systemMessage     → user-visible terminal status
#   additionalContext → AI-only context
set -euo pipefail

SP_REPO="${SP_CONTEXT_REPO:-$HOME/sp-context}"
CLAUDE_MEM_DB="$HOME/.claude-mem/claude-mem.db"

[ ! -d "$SP_REPO" ] && exit 0

# ── Smart extraction from claude-mem ──
HARVEST_HINT=""
SYS_MSG=""

if [ -f "$CLAUDE_MEM_DB" ] && command -v sqlite3 &>/dev/null; then
  RECENT_OBS=$(sqlite3 -separator '|' "$CLAUDE_MEM_DB" "
    SELECT id, type, substr(title, 1, 60)
    FROM observations
    WHERE created_at_epoch > strftime('%s', 'now', '-2 hours')
    AND type IN ('decision', 'discovery', 'feature')
    ORDER BY created_at_epoch DESC
    LIMIT 5
  " 2>/dev/null || echo "")

  if [ -n "$RECENT_OBS" ]; then
    IDS=$(echo "$RECENT_OBS" | cut -d'|' -f1 | tr '\n' ',' | sed 's/,$//')
    OBS_COUNT=$(echo "$RECENT_OBS" | wc -l | tr -d ' ')

    SYS_MSG="[sp-context] ${OBS_COUNT} 条高价值 observations 可同步"
    HARVEST_HINT="本次 session 发现 ${OBS_COUNT} 条高价值 observations (IDs: ${IDS})。下次 session 可用 /sp-context:sp-harvest 或 sp import --ids ${IDS} 同步。"
  fi
fi

if [ -z "$HARVEST_HINT" ]; then
  HARVEST_HINT="如果本次 session 有值得沉淀的发现、决策或经验，可以用 /sp-context:sp-quick 快速捕获或 sp push 同步到公司知识库。"
fi

if [ -z "$SYS_MSG" ]; then
  SYS_MSG="[sp-context] session 结束"
fi

# ── Output JSON ──
# Stop hook only supports top-level fields (systemMessage, stopReason, etc.)
# hookSpecificOutput is NOT valid for Stop events — only PreToolUse/UserPromptSubmit/PostToolUse
jq -n \
  --arg sys "$SYS_MSG" \
  --arg ctx "$HARVEST_HINT" \
  '{
    systemMessage: ($sys + "\n" + $ctx)
  }'
