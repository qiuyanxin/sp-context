---
name: sp-harvest
description: Auto-sync high-value knowledge from claude-mem to sp-context. Finds unsynced decisions/discoveries and batch imports them.
---

# sp-harvest — Auto-sync from claude-mem

## Workflow

1. Check claude-mem available (`~/.claude-mem/claude-mem.db`)
2. Use claude-mem MCP `search(type="observations", obs_type="decision,discovery,feature")` to find candidates
3. Filter out already-imported (check `imported-from-claude-mem` tag in sp-context)
4. Present candidates to user for selection
5. Use `get_observations(ids=[...])` to fetch full details
6. `sp push` each selected observation with proper type mapping
7. Suggest links to related existing docs

## Type Mapping

- decision → decision
- discovery → learning
- feature → learning
- bugfix → learning
- change → reference

## Required

- claude-mem plugin installed and enabled
- sp-context repo initialized
