#!/bin/bash
# SessionStart hook: progressive context loading
# Uses official JSON output format:
#   systemMessage  → user-visible terminal status
#   additionalContext → AI-only context (catalog, related docs, CLI help)
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
TODAY=$(date +%Y-%m-%d 2>/dev/null || echo "2026-03-31")
D30=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d 2>/dev/null || echo "2026-03-01")
D90=$(date -v-90d +%Y-%m-%d 2>/dev/null || date -d '90 days ago' +%Y-%m-%d 2>/dev/null || echo "2025-12-31")

# ── Freshness counts ──
FRESH_COUNT=$(jq -r --arg d30 "$D30" '[.entries[] | select(.date != null and .date >= $d30)] | length' "$INDEX_FILE" 2>/dev/null || echo 0)
AGING_COUNT=$(jq -r --arg d30 "$D30" --arg d90 "$D90" '[.entries[] | select(.date != null and .date >= $d90 and .date < $d30)] | length' "$INDEX_FILE" 2>/dev/null || echo 0)
STALE_COUNT=$(jq -r --arg cutoff "$D90" '[.entries[] | select(.date != null and .date < $cutoff)] | length' "$INDEX_FILE" 2>/dev/null || echo 0)

# ── Build catalog ──
CATALOG=$(jq -r --arg d30 "$D30" --arg d90 "$D90" '
  .entries | group_by(.path | split("/")[0]) |
  map({
    dir: .[0].path | split("/")[0],
    count: length,
    recent: [.[:3][] | .title] | join(", ")
  }) |
  sort_by(-.count) |
  .[] | "- \(.dir)/ (\(.count)\u7bc7) \u2014 \(.recent)"
' "$INDEX_FILE" 2>/dev/null || echo "")

UPDATED=$(jq -r '.entries[0].date // "unknown"' "$INDEX_FILE" 2>/dev/null || echo "unknown")

# ── Category summary (compact) ──
CATEGORY_SUMMARY=$(jq -r '
  .entries | group_by(.path | split("/")[0]) |
  map("\(.[0].path | split("/")[0])/\(length)") |
  sort_by(- (split("/")[1] | tonumber)) |
  join(" ")
' "$INDEX_FILE" 2>/dev/null || echo "")

# ── claude-mem dependency check ──
CLAUDE_MEM_DB="$HOME/.claude-mem/claude-mem.db"
CLAUDE_MEM_CONTEXT=""
SYS_WARNINGS=""

if [ ! -f "$CLAUDE_MEM_DB" ]; then
  CLAUDE_MEM_CONTEXT="
> **claude-mem 未安装**: sp import / /sp-context:sp-harvest 功能不可用。运行 /sp-context:sp-setup 引导安装。"
  SYS_WARNINGS="claude-mem 未安装"
else
  if command -v sqlite3 &>/dev/null; then
    UNSYNC_COUNT=$(sqlite3 "$CLAUDE_MEM_DB" "
      SELECT COUNT(*) FROM observations
      WHERE created_at_epoch > strftime('%s', 'now', '-24 hours')
      AND type IN ('decision', 'discovery')
    " 2>/dev/null || echo 0)
    if [ "$UNSYNC_COUNT" -gt 0 ] 2>/dev/null; then
      CLAUDE_MEM_CONTEXT="
> **claude-mem**: ${UNSYNC_COUNT} 条近 24h 的 decision/discovery 未同步。运行 /sp-context:sp-harvest 同步。"
    fi
  fi
fi

# ── Project-aware context injection ──
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROJECT_NAME=$(basename "$PROJECT_DIR")
CONTEXT_SECTION=""

if command -v bun &>/dev/null; then
  RELATED=$(SP_CONTEXT_REPO="$SP_REPO" bun run "$PLUGIN_ROOT/src/cli.ts" search "$PROJECT_NAME" --limit 3 --json 2>/dev/null || echo "[]")

  GIT_KEYWORDS=""
  if [ -d "$PROJECT_DIR/.git" ]; then
    GIT_KEYWORDS=$(cd "$PROJECT_DIR" && git diff --name-only HEAD 2>/dev/null | \
      sed 's|/| |g; s|\.[^.]*$||' | tr ' ' '\n' | \
      grep -v '^\(src\|lib\|test\|spec\|node_modules\|dist\|build\|index\|package\)$' | \
      sort -u | grep -v '^$' | head -5 | tr '\n' ' ' 2>/dev/null || echo "")
  fi

  GIT_RELATED="[]"
  if [ -n "$GIT_KEYWORDS" ]; then
    GIT_RELATED=$(SP_CONTEXT_REPO="$SP_REPO" bun run "$PLUGIN_ROOT/src/cli.ts" search "$GIT_KEYWORDS" --limit 3 --mode or --json 2>/dev/null || echo "[]")
  fi

  MERGED=$(echo "[$RELATED, $GIT_RELATED]" | jq -s '
    [.[0][], .[1][]] | unique_by(.path) | .[:5]
  ' 2>/dev/null || echo "$RELATED")

  RELATED_COUNT=$(echo "$MERGED" | jq 'length' 2>/dev/null || echo 0)
  if [ "$RELATED_COUNT" -gt 0 ] 2>/dev/null && [ "$RELATED_COUNT" != "0" ]; then
    RELATED_LIST=$(echo "$MERGED" | jq -r --arg d30 "$D30" --arg d90 "$D90" '
      .[] |
      (if (.date // "") >= $d30 then "🟢"
       elif (.date // "") >= $d90 then "🟡"
       else "🔴" end) as $badge |
      "- \($badge) [\(.title)](\(.path)) (\(.date // "no date"))"
    ' 2>/dev/null || echo "")
    if [ -n "$RELATED_LIST" ]; then
      CONTEXT_SECTION="
# 与当前项目相关的知识 (sp get <path> 获取全文)
${RELATED_LIST}"
    fi
  fi
fi

# ── Build systemMessage (concise, user-visible) ──
SYS_MSG="[sp-context] ${TOTAL}篇 | ${CATEGORY_SUMMARY} | 🟢${FRESH_COUNT} 🟡${AGING_COUNT} 🔴${STALE_COUNT}"
if [ -n "$SYS_WARNINGS" ]; then
  SYS_MSG="${SYS_MSG} | ⚠ ${SYS_WARNINGS}"
fi

# ── Build additionalContext (AI-only, full catalog) ──
read -r -d '' AI_CONTEXT <<CTXEOF || true
# 公司知识库 (${TOTAL}篇, 最近更新 ${UPDATED})
# 新鲜度: 🟢${FRESH_COUNT} (<30d) 🟡${AGING_COUNT} (30-90d) 🔴${STALE_COUNT} (>90d)

${CATALOG}

CLI 工具 (通过 Bash 调用, pipe 模式自动输出 JSON):
  sp search <query> [--type <type>] [--tags <t1,t2>] [--limit <n>] [--mode or] [--snippet]  搜索文档
  sp get <path>                                                      读取全文
  sp list <category>  [--project <name>]                             浏览分类 (context/decisions/experience/meetings/plans/playbook/clients/people)
  sp push --title <t> --type <type> [--tags <t1,t2>] [--content <text> | --file <path>] [--dir <path>]  推送新知识
  sp add <file|dir> [--to <path>] [--yes]                             添加本地文件（无 --to 时先建议路径，等待确认）
  sp sync                                                            同步远程
  sp import [--ids <id1,id2>] [--query <q>]                          从 claude-mem 导入
  sp doctor                                                          检查知识库质量（重复/过期/tag不一致）
  sp schema                                                          知识库元数据自省（类型/tag/统计）
  sp gc [--yes]                                                      清理过期文档
  sp config list|add|switch                                          管理仓库
  类型: reference|learning|decision|meeting|status|playbook|personal
  personal 类型自动路由到 people/\$USER/
渐进加载: sp search 搜索 → sp get 读取全文 → sp push 推送新知识

Skills (通过 /sp-context:<name> 调用):
  /sp-context:sp-setup    — 检查依赖（claude-mem等）并引导安装
  /sp-context:sp-quick    — 低摩擦一行知识捕获（AI 自动推断 type/tags）
  /sp-context:sp-harvest  — 从 claude-mem 批量同步高价值知识
  /sp-context:sp-health   — 知识库健康检查 + 自动修复
${CLAUDE_MEM_CONTEXT}${CONTEXT_SECTION:-}
CTXEOF

# ── Output JSON (single object, only thing on stdout) ──
# systemMessage → user-visible status line
# additionalContext → AI-only context (catalog, CLI help, related docs)
jq -n \
  --arg sys "$SYS_MSG" \
  --arg ctx "$AI_CONTEXT" \
  '{
    systemMessage: $sys,
    additionalContext: $ctx
  }'
