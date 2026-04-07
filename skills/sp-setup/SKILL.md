---
name: sp-setup
description: Check sp-context dependencies (claude-mem, git, bun) and guide installation. Use when session-start reports missing dependencies or user wants to set up knowledge sync.
---

# sp-context Setup & Dependency Check

Check the health of sp-context knowledge management system and its dependencies.

## Checks to Run (in parallel)

1. **sp CLI**: `which sp` — if missing, suggest `bun link` in sp-context-plugin dir
2. **sp-context repo**: `ls ~/sp-context/.git` — if missing, run `sp init`
3. **bun runtime**: `bun --version` — if missing, suggest `curl -fsSL https://bun.sh/install | bash`
4. **claude-mem DB**: `test -f ~/.claude-mem/claude-mem.db` — if missing, plugin not installed
5. **claude-mem plugin**: `grep "claude-mem" ~/.claude/settings.json` — if not enabled, guide user

## If claude-mem Missing

claude-mem is required for: `sp import`, `/sp-context:sp-harvest`, session-stop knowledge extraction.

Installation: `/install claude-mem@thedotmack` then restart session.

## Output

Status table with all components, then actionable fix commands for any issues found.
