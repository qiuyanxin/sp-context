# Quick Start Guide

> Get your AI agents reading your team knowledge in 5 minutes.

## What is this?

A CLI tool that connects your AI coding agents (Claude Code, Codex, Cursor, etc.) to a shared Git-based knowledge repository. After setup, your agent sessions automatically load your team's context — product info, architecture decisions, lessons learned, and more.

## Prerequisites

- macOS / Linux
- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- [Git](https://git-scm.com)

## Install (3 steps)

### 1. Clone and install

```bash
git clone https://github.com/qiuyanxin/sp-context.git ~/sp-context-plugin
cd ~/sp-context-plugin && bun install
```

### 2. Set up the `sp` command

**Option A (recommended):** link the CLI globally after `bun install`:

```bash
cd ~/sp-context-plugin && bun link
```

**Option B:** shell alias:

```bash
echo 'alias sp="bun run ~/sp-context-plugin/src/cli.ts"' >> ~/.zshrc
source ~/.zshrc
```

### 3. Initialize your knowledge repo

```bash
sp init ~/my-team-context
```

This creates a Git repo with starter templates (company mission, tech stack, glossary).

### Verify

```bash
sp --version
# Should output: 1.2.0

sp list context
# Should show your starter documents
```

## Wire to Claude Code (recommended)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/sp-context-plugin/hooks/session-start.sh",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/sp-context-plugin/hooks/session-stop.sh",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
```

> If `settings.json` already has other config, merge the `hooks` section in.

### Verify hooks

Start Claude Code. You should see a short catalog overview (doc counts per folder, last updated).

If you install via the **Claude Code plugin** marketplace, hooks use `${CLAUDE_PLUGIN_ROOT}` automatically (`hooks/hooks.json`). The JSON above is for a **manual** clone at `$HOME/sp-context-plugin`.

If you see the overview, you're set.

## Daily Usage

### Talk naturally in Claude Code

```
→ "Search for our architecture decisions"
→ "Read context/company.md"
→ "Save this finding to the knowledge base"
```

### Use the CLI directly

```bash
# Search
sp search "authentication"
sp search "MVP" --type decision --tags infra --limit 5

# Read
sp get context/company.md

# Browse
sp list context
sp list decisions
sp list clients    # client/account folders under clients/

# Write
sp push --title "Redis caching lesson" --type learning \
  --tags "redis,cache" --content "Connection pools must set maxRetries..."
sp push --title "Notes" --type personal --category notes --content "…"

# Import from claude-mem (needs claude-mem plugin + local DB)
sp import --query "onboarding" --limit 10
# sp import --ids 101,102

# Sync with team
sp sync

# Check quality
sp doctor
```

### Pipe composition

```bash
# Search → extract path → read full doc
sp search "Stripe" | jq -r '.[0].path' | xargs sp get

# List all decision titles
sp list decisions | jq -r '.[].title'
```

## Document Types

When pushing knowledge, specify `--type`:

| Type | Purpose | Storage |
|------|---------|---------|
| `reference` | Company info, product specs, competitors | `context/` |
| `decision` | Tech / product / business decisions | `decisions/` |
| `learning` | Lessons learned, best practices | `experience/` |
| `meeting` | Meeting notes | `meetings/` |
| `status` | Plans, progress, weekly updates | `plans/` |
| `playbook` | SOPs, workflows | `playbook/` |
| `personal` | Private notes under `people/` | `people/` (optional `--category` e.g. `notes`, `drafts`) |

**Browse with `sp list`:** `context`, `decisions`, `experience`, `meetings`, `plans`, `playbook`, **`clients`**, `people`. Use `--project <name>` when docs are grouped by project.

## FAQ

**Q: `sp` command not found?**

Run `cd ~/sp-context-plugin && bun link`, or `source ~/.zshrc` if you use an alias, or run `bun run ~/sp-context-plugin/src/cli.ts --version`.

**Q: Search returns no results?**

Sync first: `sp sync` — this pulls latest and rebuilds the index.

**Q: Push fails with git error?**

Make sure your knowledge repo has a remote configured and you have push access:
```bash
cd ~/my-team-context && git remote -v
```

**Q: Multi-machine sync?**

Each machine installs independently. `sp push` auto-commits and pushes. `sp sync` pulls latest. Git handles the rest.

**Q: `sp import` errors or does nothing?**

`sp import` reads the local **claude-mem** database. Install the claude-mem plugin and ensure `~/.claude-mem/claude-mem.db` exists. For batch workflows, use the `/sp-context:sp-harvest` skill in Claude Code.

## Claude Code skills (plugin)

- `/sp-context:sp-setup` — dependencies and install checklist  
- `/sp-context:sp-quick` — quick capture  
- `/sp-context:sp-harvest` — claude-mem → sp-context  
- `/sp-context:sp-health` — doctor-style quality pass  

## Self-Hosting Sync Server (optional)

For teams wanting instant sync:

```bash
cd ~/sp-context-plugin   # repository root
export SP_CONTEXT_REPO=~/my-team-context
export SP_API_KEY="your-secret"   # optional; see below
export PORT=3100
bun run src/http.ts
```

Health check: `curl -s http://localhost:3100/health`

**`SP_API_KEY`:** Used **only** by the small HTTP service (`src/http.ts`), not by the `sp` CLI. You define it yourself (e.g. `openssl rand -hex 32`). When set, `POST /sync` requires `Authorization: Bearer <that value>`. When unset, `/sync` has no Bearer check—OK on localhost, risky if the port is public. **`SP_WEBHOOK_SECRET`** is separate: it validates GitHub signatures on **`POST /webhook`** only. Details: README → *Self-Hosting Sync Server*.
