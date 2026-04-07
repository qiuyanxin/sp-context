---
name: sp-health
description: Run knowledge base health check and auto-fix actionable issues. Runs sp doctor, fixes tags, broken links, missing metadata automatically.
---

# sp-health — Doctor + Auto-fix

## Workflow

1. `sp doctor --json` — get all findings
2. Auto-fix: TAG (normalize casing), BROKEN_LINK (search for moved files), MISSING (infer from content)
3. Suggest: DUPLICATE (ask which to keep), MISSING_EVIDENCE (propose evidence text), STALE (archive or update?)
4. Report only: UNUSED
5. `sp sync` to rebuild index
6. Git commit all fixes
7. Output summary report
