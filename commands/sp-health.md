---
description: "Run knowledge base health check and auto-fix actionable issues. Triggers: /sp-context:sp-health, 'check knowledge base', '知识库健康检查', 'sp doctor fix'"
---

# sp-health — Doctor + Auto-fix

You are the knowledge base health manager. Run diagnostics and fix what you can automatically.

## Step 1: Run Doctor

```bash
sp doctor --json
```

Parse the JSON output into categories:
- **DUPLICATE** (error) — identical content files
- **BROKEN_LINK** (error) — links pointing to non-existent docs
- **TAG** (warning) — case mismatches in tags
- **STALE** (warning) — status docs older than 30 days
- **MISSING** (warning) — docs missing title or type
- **MISSING_EVIDENCE** (warning) — links without evidence
- **UNUSED** (info) — docs never read
- **EMPTY** (info) — empty directories

## Step 2: Auto-fix What's Possible

### TAG issues — auto-fix
For each tag case mismatch, read the affected files and normalize to lowercase:

```bash
sp get <path>  # Read the doc
```

Then edit the frontmatter to fix the tag casing. Use the Edit tool on the actual markdown file in `~/sp-context/`.

### STALE status docs — suggest archive
For status docs older than 30 days:

```bash
sp gc --yes  # Archive expired docs
```

Or for individual docs, suggest:
> "plans/2025-12/old-task.md" 已超过 30 天，建议归档还是更新？

### DUPLICATE — suggest delete
Show the duplicate pairs and ask user which to keep:

> 发现重复文档：
> - context/doc-a.md (2026-01-15)
> - context/doc-b.md (2026-03-01)  ← 更新
> 建议删除旧版本？

If confirmed: `sp delete <path>`

### BROKEN_LINK — auto-fix
For broken links, search for the correct target:

```bash
sp search "<broken target filename>" --limit 3 --json
```

If a likely match is found (renamed/moved file), update the link in the source file's frontmatter.

### MISSING (title/type) — auto-fix
Read the file content, infer title from first heading and type from path, then update frontmatter.

### MISSING_EVIDENCE — suggest
For links missing evidence, read both the source and target docs, then suggest an evidence string:

> Link: "doc-a.md" → related "doc-b.md"
> 建议 evidence: "Both analyze client growth strategy from different angles"
> 添加？

### UNUSED — report only
List unused docs for user awareness. Don't auto-delete.

## Step 3: Rebuild Index

After all fixes:

```bash
cd ~/sp-context && bun run /path/to/sp-context-plugin/src/index-builder.ts
```

Or: `sp sync`

## Step 4: Commit Changes

If any files were modified:

```bash
cd ~/sp-context && git add -A && git commit -m "fix: auto-fix doctor findings (tag normalization, broken links, missing metadata)" && git push
```

## Step 5: Summary Report

```
[sp-health] 健康检查完成
  Fixed:    3 tag issues, 1 broken link, 2 missing metadata
  Archived: 1 stale status doc
  Pending:  2 duplicates (需确认), 5 missing evidence (已建议)
  Info:     275 unused docs (仅报告)
  
  Knowledge base: 282 docs, 0 errors, 2 warnings remaining
```
