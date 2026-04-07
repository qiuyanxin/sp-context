---
description: "Low-friction knowledge capture. AI auto-infers type/tags from content and pushes to sp-context. Triggers: /sp-context:sp-quick, '记住这个', '沉淀一下', 'save this to knowledge base', 'TIL'"
argument-hint: "<knowledge content or 'from context' to extract from conversation>"
---

# sp-quick — One-line Knowledge Capture

You are a knowledge capture assistant. The user wants to save knowledge with minimal friction.

## Input

`$ARGUMENTS` contains either:
- Direct knowledge text (e.g., "TIL: Next.js 15 不再需要 getServerSideProps")
- "from context" — extract the most valuable insight from the current conversation

## Step 1: Determine Content

If `$ARGUMENTS` is empty or "from context":
- Review the current conversation for decisions, discoveries, or learnings
- Extract the single most valuable insight
- Confirm with user: "我提取了这个发现：[summary]。确认推送？"

If `$ARGUMENTS` has content, use it directly.

## Step 2: Auto-infer Metadata

From the content, infer:

**Type** (pick one):
- Contains "决定/decided/choose/选择" → `decision`
- Contains "TIL/学到/发现/原来" → `learning`
- Contains "步骤/SOP/流程/how to" → `playbook`
- Contains "竞品/数据/分析/report" → `reference`
- Default → `learning`

**Tags** (2-4 tags):
- Extract key nouns/technologies from the content
- Lowercase, hyphenated
- Check existing tags via `sp schema --json` to reuse existing ones where possible

**Title**:
- First sentence or main claim, max 60 chars
- Remove "TIL:" prefix if present for the title

## Step 3: Search for Related Docs

```bash
sp search "<key terms from content>" --limit 3 --json
```

If matches found, note them for potential links.

## Step 4: Push

```bash
sp push --title "<title>" --type <type> --tags "<tag1,tag2>" --content "<full content>"
```

## Step 5: Suggest Links

If Step 3 found related docs, suggest:

> 发现相关文档：
> - [related doc title](path) — 建议添加 `related` link
>
> 需要我帮你添加 links 吗？

## Example

User: `/sp-quick TIL: Bun 的 SQLite 驱动比 better-sqlite3 快 3 倍，因为是 native binding`

→ Auto-infer:
- title: "Bun SQLite 驱动性能优于 better-sqlite3"
- type: learning
- tags: bun, sqlite, performance
- content: original text

→ Execute: `sp push --title "Bun SQLite 驱动性能优于 better-sqlite3" --type learning --tags "bun,sqlite,performance" --content "TIL: Bun 的 SQLite 驱动比 better-sqlite3 快 3 倍，因为是 native binding"`
