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

### 2. Set up the sp command

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

Start Claude Code. You should see something like:

```
Knowledge base (12 docs, last updated 2026-04-07)
- context/ (3 docs) — Company, Tech Stack, Glossary
- decisions/ (0 docs)
- experience/ (0 docs)
...
```

If you see this, you're set.

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
sp search "MVP" --type decision

# Read
sp get context/company.md

# Browse
sp list context
sp list decisions

# Write
sp push --title "Redis caching lesson" --type learning \
  --tags "redis,cache" --content "Connection pools must set maxRetries..."

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

## FAQ

**Q: `sp` command not found?**

Run `source ~/.zshrc`, or directly: `bun run ~/sp-context-plugin/src/cli.ts --version`.

**Q: Search returns no results?**

Sync first: `sp sync` — this pulls latest and rebuilds the index.

**Q: Push fails with git error?**

Make sure your knowledge repo has a remote configured and you have push access:
```bash
cd ~/my-team-context && git remote -v
```

**Q: Multi-machine sync?**

Each machine installs independently. `sp push` auto-commits and pushes. `sp sync` pulls latest. Git handles the rest.

## Self-Hosting Sync Server (optional)

For teams wanting instant sync:

```bash
SP_CONTEXT_REPO=~/my-team-context \
SP_API_KEY="your-secret" \
PORT=3100 \
bun run src/http.ts
```

Health check: `curl -s http://localhost:3100/health`
