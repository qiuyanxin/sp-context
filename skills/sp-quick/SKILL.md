---
name: sp-quick
description: Low-friction one-line knowledge capture. Auto-infers type/tags and pushes to sp-context knowledge base.
---

# sp-quick — One-line Knowledge Capture

Extract knowledge from user input or conversation context. Auto-infer type, tags, title. Push via `sp push`.

## Type Inference Rules

- "决定/decided/choose" → decision
- "TIL/学到/发现/原来" → learning
- "步骤/SOP/流程" → playbook
- "竞品/数据/分析" → reference
- Default → learning

## Workflow

1. Get content (from args or conversation context)
2. Infer type + tags + title
3. `sp search "<keywords>" --limit 3` for related docs
4. `sp push --title "..." --type ... --tags "..." --content "..."`
5. If related docs found, suggest adding links
