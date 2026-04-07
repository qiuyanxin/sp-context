---
description: "Auto-sync high-value knowledge from claude-mem to sp-context. Uses claude-mem MCP tools to find unsynced decisions/discoveries and batch import. Triggers: /sp-context:sp-harvest, '同步知识', 'sync from claude-mem', 'harvest knowledge'"
argument-hint: "[today|week|session] — time range to scan, default: today"
---

# sp-harvest — Auto-sync from claude-mem

You are harvesting high-value observations from claude-mem and syncing them to the sp-context knowledge base.

## Prerequisites Check

First verify claude-mem is available:

```bash
test -f ~/.claude-mem/claude-mem.db && echo "OK" || echo "MISSING"
```

If MISSING: tell user to run `/sp-context:sp-setup` first, then stop.

## Step 1: Find High-value Observations

Use claude-mem MCP `search` tool to find recent decision and discovery observations:

```
search(type="observations", obs_type="decision,discovery,feature", dateStart="<start_date>", limit=20, orderBy="date_desc")
```

Time range based on `$ARGUMENTS`:
- `today` or empty → today's date
- `week` → 7 days ago
- `session` → last 2 hours

## Step 2: Filter Already-synced

Search sp-context for docs tagged `imported-from-claude-mem`:

```bash
sp search "imported-from-claude-mem" --tags imported-from-claude-mem --limit 50 --json
```

Compare claude-mem observation IDs against already-imported docs (check titles or `cm-*` tags). Remove already-synced ones.

## Step 3: Present Candidates

Show user a table of unsynced observations:

| ID | Type | Title | Value |
|----|------|-------|-------|
| #4750 | decision | sp-context Plugin Evolution Strategy | High |
| #4733 | bugfix | Fixed Hook Terminal Output | Medium |

Ask: "要同步哪些？输入 ID 或 'all'"

## Step 4: Batch Import

For selected observations, use `get_observations` MCP tool to fetch full details:

```
get_observations(ids=[4750, 4733])
```

Then for each observation, run:

```bash
sp import --ids <id>
```

Or if sp import is slow, directly use `sp push` with properly formatted content:

```bash
sp push --title "<obs.title>" --type <mapped_type> --tags "imported-from-claude-mem,cm-<obs.type>" --content "<obs.narrative + obs.facts>"
```

Type mapping:
- decision → decision
- discovery → learning
- feature → learning
- bugfix → learning
- change → reference

## Step 5: Summary

Output:
```
[sp-harvest] Synced N observations from claude-mem:
  - #4750: sp-context Plugin Evolution Strategy → decisions/...
  - #4733: Fixed Hook Terminal Output → experience/...

Knowledge base: 282 → 284 docs
```

## Step 6: Suggest Links

For each newly imported doc, check if related docs exist:

```bash
sp search "<key terms>" --limit 3 --json
```

If found, suggest adding links between the new and existing docs.
