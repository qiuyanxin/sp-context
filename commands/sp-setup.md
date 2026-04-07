---
description: "Check sp-context dependencies (claude-mem, git, bun) and guide installation. Use when sp-context features are degraded or user wants to set up knowledge sync. Triggers: /sp-context:sp-setup, 'sp setup', 'install claude-mem', 'knowledge sync setup'"
---

# sp-context Setup & Dependency Check

You are checking the health of the sp-context knowledge management system and its dependencies.

## Step 1: Check Core Dependencies

Run these checks in parallel:

```bash
# Check 1: sp CLI available
which sp 2>/dev/null || echo "SP_MISSING"

# Check 2: sp-context repo exists
ls -d ~/sp-context/.git 2>/dev/null || echo "REPO_MISSING"

# Check 3: bun runtime
bun --version 2>/dev/null || echo "BUN_MISSING"

# Check 4: git available
git --version 2>/dev/null || echo "GIT_MISSING"
```

## Step 2: Check claude-mem Integration

This is the critical dependency for knowledge sync features (sp import, sp harvest).

```bash
# Check claude-mem database
test -f ~/.claude-mem/claude-mem.db && echo "CLAUDE_MEM_DB_OK" || echo "CLAUDE_MEM_DB_MISSING"
```

Then check if claude-mem plugin is enabled in Claude Code:

```bash
# Check settings.json for claude-mem plugin
cat ~/.claude/settings.json 2>/dev/null | grep -o '"claude-mem@thedotmack": *[a-z]*'
```

Also verify the MCP tools are accessible by trying:

```bash
# Check if claude-mem MCP server is responding
ls ~/.claude/plugins/cache/thedotmack/claude-mem/ 2>/dev/null
```

## Step 3: Report & Fix

Based on the checks, output a status table:

| Component | Status | Action |
|-----------|--------|--------|
| sp CLI | ... | ... |
| sp-context repo | ... | ... |
| bun | ... | ... |
| claude-mem DB | ... | ... |
| claude-mem plugin | ... | ... |

### If claude-mem is missing:

Tell the user:

> claude-mem 未安装。它是 sp-context 知识同步的核心依赖（sp import, /sp-harvest 功能需要）。
>
> 安装方式：在 Claude Code 中运行：
> ```
> /install claude-mem@thedotmack
> ```
> 安装后重启 Claude Code session 即可。

### If claude-mem DB exists but plugin not enabled:

Tell the user:

> claude-mem 已安装但未启用。请在 Claude Code 设置中启用：
> Settings → Plugins → claude-mem@thedotmack → Enable

### If sp-context repo is missing:

```bash
sp init ~/sp-context
```

## Step 4: Verify After Fix

If any fixes were applied, re-run the checks to confirm everything is working.

Output final status: `[sp-context] Setup complete. All dependencies OK.` or list remaining issues.
