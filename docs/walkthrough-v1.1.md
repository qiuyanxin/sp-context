# sp-context-plugin v1.1.0 完整 Walkthrough

> 本文档覆盖 v1.1.0 所有新增功能和增强改动，包含架构说明、代码结构、使用示例和实现细节。

---

## 目录

1. [版本概览](#1-版本概览)
2. [项目结构](#2-项目结构)
3. [类型系统变更](#3-类型系统变更)
4. [新增命令：sp doctor](#4-新增命令sp-doctor)
5. [新增命令：sp schema](#5-新增命令sp-schema)
6. [新增命令：sp gc](#6-新增命令sp-gc)
7. [增强命令：sp search](#7-增强命令sp-search)
8. [增强命令：sp push](#8-增强命令sp-push)
9. [使用量追踪系统](#9-使用量追踪系统)
10. [智能 Session 注入](#10-智能-session-注入)
11. [文档链接机制](#11-文档链接机制)
12. [文档生命周期管理](#12-文档生命周期管理)
13. [数据流全景图](#13-数据流全景图)
14. [开发指南](#14-开发指南)

---

## 1. 版本概览

### v1.0.0 → v1.1.0 变更摘要

| 维度 | v1.0.0 | v1.1.0 |
|------|--------|--------|
| 命令数 | 10 (search/get/list/push/sync/import/init/add/delete/move) | 13 (+doctor/schema/gc) |
| 搜索能力 | AND only，无上下文 | +OR 模式, +snippet, +关联文档 |
| 数据治理 | 无 | doctor 扫描 + gc 清理 + 使用量追踪 |
| Agent 感知 | 114 token 统一注入 | +项目感知注入 + schema 自省 |
| 文档关联 | 无 | links (based-on / leads-to / related) |
| 生命周期 | 无 | expires + status + TTL + 归档 |
| Tag 质量 | 用户自行管理 | 自动小写 + 相似 tag 检测 (Levenshtein) |

### 新增文件清单

```
src/tools/doctor.ts      — 知识库健康检查引擎 (221 行)
src/tools/schema.ts      — 元数据自省接口 (137 行)
src/tools/gc.ts          — 过期文档清理 (67 行)
src/tools/usage.ts       — 使用量追踪模块 (55 行)
src/commands/doctor.ts   — doctor CLI 路由 (39 行)
src/commands/schema.ts   — schema CLI 路由 (11 行)
src/commands/gc.ts       — gc CLI 路由 (36 行)
```

### 修改文件清单

```
src/utils/frontmatter.ts — 新增 DocLink / expires / status 类型
src/index-builder.ts     — IndexEntry 新增 links / expires / archived
src/tools/search.ts      — OR 模式 + snippet + 关联文档 + 归档过滤 + 使用量追踪
src/tools/push.ts        — Tag 标准化 + TTL + 级联复审
src/tools/get.ts         — 使用量追踪集成
src/commands/search.ts   — 新增 --mode / --snippet 参数
src/commands/push.ts     — 新增 --ttl 参数
src/cli.ts               — 注册 doctor/schema/gc + 版本号 + help 更新
hooks/session-start.sh   — 项目感知注入 + 新命令列表
```

---

## 2. 项目结构

```
sp-context-plugin/
├── src/
│   ├── cli.ts                  # CLI 入口，子命令路由
│   ├── output.ts               # TTY/JSON 输出适配
│   ├── index-builder.ts        # INDEX.json 构建引擎
│   ├── http.ts                 # HTTP 服务（SSE）
│   ├── commands/               # CLI 命令处理（解析参数 → 调用 tool）
│   │   ├── search.ts
│   │   ├── get.ts
│   │   ├── list.ts
│   │   ├── push.ts
│   │   ├── sync.ts
│   │   ├── import.ts
│   │   ├── init.ts
│   │   ├── add.ts
│   │   ├── delete.ts
│   │   ├── move.ts
│   │   ├── config.ts
│   │   ├── doctor.ts           # [NEW]
│   │   ├── schema.ts           # [NEW]
│   │   └── gc.ts               # [NEW]
│   ├── tools/                  # 业务逻辑层（纯函数，不处理 CLI 参数）
│   │   ├── search.ts
│   │   ├── get.ts
│   │   ├── list.ts
│   │   ├── push.ts
│   │   ├── sync.ts
│   │   ├── import.ts
│   │   ├── init.ts
│   │   ├── add.ts
│   │   ├── delete.ts
│   │   ├── move.ts
│   │   ├── doctor.ts           # [NEW]
│   │   ├── schema.ts           # [NEW]
│   │   ├── gc.ts               # [NEW]
│   │   └── usage.ts            # [NEW]
│   └── utils/
│       ├── config.ts           # 多仓库配置管理
│       ├── frontmatter.ts      # Frontmatter 解析/构建 [MODIFIED]
│       └── git.ts              # Git 操作封装
├── hooks/
│   └── session-start.sh        # Claude Code SessionStart hook [MODIFIED]
├── docs/
│   ├── optimization-plan.md    # 优化方案文档
│   └── walkthrough-v1.1.md     # 本文档
└── package.json
```

### 架构分层

```
┌──────────────────────────────────────────────────────┐
│  CLI 层 (cli.ts)                                      │
│  解析全局 flags → 路由到 commands/*                     │
├──────────────────────────────────────────────────────┤
│  Commands 层 (commands/*.ts)                          │
│  解析子命令参数 → 调用 tools/* → 通过 output.ts 输出     │
├──────────────────────────────────────────────────────┤
│  Tools 层 (tools/*.ts)                                │
│  纯业务逻辑，不依赖 CLI 参数格式                         │
│  返回结构化数据（interface 定义）                        │
├──────────────────────────────────────────────────────┤
│  Utils 层 (utils/*.ts)                                │
│  config.ts — 多仓库配置                                │
│  frontmatter.ts — Markdown frontmatter 解析/构建       │
│  git.ts — simple-git 封装                              │
├──────────────────────────────────────────────────────┤
│  Index 层 (index-builder.ts)                          │
│  遍历仓库 → 解析每篇 .md → 生成 INDEX.json             │
│  支持 TF 关键词提取 + CJK bigram + MD5 hash            │
└──────────────────────────────────────────────────────┘
```

---

## 3. 类型系统变更

### 3.1 DocLink（新增）

**文件**: `src/utils/frontmatter.ts`

```typescript
export interface DocLink {
  type: "based-on" | "leads-to" | "related";
  target: string;  // 文档在仓库中的相对路径
}
```

三种链接语义：
- `based-on`：依赖关系（这篇文档基于哪个上游文档）
- `leads-to`：驱动关系（这篇文档驱动了哪个下游决策/计划）
- `related`：并列关联

### 3.2 DocMeta（扩展）

```typescript
export interface DocMeta {
  title: string;
  type: string;
  project?: string;
  author?: string;
  date?: string;
  tags: string[];
  links?: DocLink[];               // [NEW] 文档间链接
  expires?: string;                // [NEW] 过期日期 (YYYY-MM-DD)
  status?: "active" | "archived" | "draft";  // [NEW] 文档状态
}
```

### 3.3 IndexEntry（扩展）

**文件**: `src/index-builder.ts`

```typescript
export interface IndexEntry {
  path: string;
  title: string;
  type: string;
  project?: string;
  tags: string[];
  date?: string;
  summary: string;
  keywords: string[];
  contentHash: string;
  links?: DocLink[];    // [NEW] 从 frontmatter 解析
  expires?: string;     // [NEW] 过期日期
  archived?: boolean;   // [NEW] status === "archived" 时为 true
}
```

### 3.4 Frontmatter 解析与构建

**解析**（`parseDoc` 函数）:
- `links` 从 frontmatter YAML 数组解析，过滤无效条目（缺 type 或 target 的）
- `expires` 直接读取为字符串
- `status` 读取并类型断言为联合类型

**构建**（`buildFrontmatter` 函数）:
- `expires` 作为日期字符串写入
- `status` 作为枚举字符串写入
- `links` 以 YAML 数组格式写入

构建示例输出：

```yaml
---
title: "Version Plan — CloudApp"
type: status
author: qiuyanxin
date: 2026-03-30
tags: [openstore, planning]
expires: 2026-04-30
status: active
links:
  - type: based-on
    target: context/company.md
  - type: leads-to
    target: plans/2026-04/sprint-plan.md
---
```

### 3.5 Index 构建变更

`buildIndex` 函数中，每篇文档的 `IndexEntry` 新增：

```typescript
const isArchived = meta.status === "archived";
entries.push({
  // ... 原有字段 ...
  links: meta.links,
  expires: meta.expires,
  archived: isArchived || undefined,  // 只有 true 才写入，减少 JSON 体积
});
```

---

## 4. 新增命令：sp doctor

### 4.1 用途

检查知识库的数据质量问题，输出诊断报告。

### 4.2 使用方式

```bash
# TTY 模式 — 彩色输出
sp doctor

# JSON 模式 — 结构化数据
sp doctor --json

# 指定仓库
sp doctor --repo /path/to/repo
```

### 4.3 检查项

| 检查项 | 级别 | 标签 | 规则 |
|--------|------|------|------|
| 重复文档 | error | `[DUPLICATE]` | contentHash 相同的文档组 |
| Tag 大小写不一致 | warning | `[TAG]` | 同一 tag 的不同大小写形式 |
| 过期文档 | warning | `[STALE]` | type=status 且 date 距今 > 30 天 |
| 缺失字段 | warning | `[MISSING]` | title 未设置（等于文件路径）或 type 为空 |
| 空目录 | info | `[EMPTY]` | 已知目录下无 .md 文件 |
| 链接断裂 | error | `[BROKEN_LINK]` | links.target 指向不存在的文档 |
| 零使用文档 | info | `[UNUSED]` | 30 天内 read_count 为 0 |

### 4.4 输出格式

**TTY 模式**（彩色）:

```
[DUPLICATE] 2 entries share the same content hash     (红色)
    plans/lafe-2026-03-23-sp/00-data-inventory.md
    plans/lafe-2026-03-18-sp/00-data-inventory.md
[TAG] Tag case mismatch: AI-agent, ai-agent — suggest using "ai-agent"  (黄色)
[STALE] Status doc "Version Plan" has date 2026-02-22 (older than 30 days)  (黄色)
[EMPTY] Directory "decisions" exists but contains no .md files  (青色)
[UNUSED] "Raw Info" has never been read  (青色)

Summary: 2 errors, 3 warnings, 5 info
```

**JSON 模式**:

```json
{
  "findings": [
    {
      "level": "error",
      "category": "DUPLICATE",
      "message": "2 entries share the same content hash",
      "paths": ["plans/.../a.md", "plans/.../b.md"]
    }
  ],
  "summary": { "errors": 2, "warnings": 3, "info": 5 }
}
```

### 4.5 实现细节

**文件**: `src/tools/doctor.ts`

核心函数 `doctor(repoPath: string): DoctorReport`，内部调用 7 个检查函数：

1. `checkDuplicates` — 用 Map<contentHash, paths[]> 分组，paths.length > 1 即重复
2. `checkTagCasing` — 用 Map<lowercase, Set<原始形式>> 分组，Set.size > 1 即不一致
3. `checkStale` — 过滤 type=status 且 date < (now - 30d)
4. `checkMissing` — 检查 title === path（说明未设置）或 type 为空
5. `checkEmptyDirs` — 遍历 7 个已知目录，用 `readdirSync({ recursive: true })` 检查有无 .md
6. `checkBrokenLinks` — 将所有 entry.path 放入 Set，检查 links.target 是否在 Set 中
7. `checkUnused` — 从 `usage.json` 读取使用量数据，read_count=0 或 last_read 超过 30 天

**文件**: `src/commands/doctor.ts`

CLI 处理：加载 config → 调用 `doctor()` → TTY 时彩色逐行输出 + summary，JSON 时直接 `output(report)`。

颜色映射：error → 红色 `\x1b[31m`，warning → 黄色 `\x1b[33m`，info → 青色 `\x1b[36m`。

---

## 5. 新增命令：sp schema

### 5.1 用途

为 AI Agent 提供知识库的元数据自省能力。Agent 在 push 前调用 `sp schema` 就能知道该用什么 type、该加什么已有 tag，避免猜测。

### 5.2 使用方式

```bash
sp schema              # 始终输出 JSON
sp schema --repo /path/to/repo
```

### 5.3 输出结构

```json
{
  "types": ["reference", "learning", "decision", "meeting", "status", "playbook", "personal"],
  "categories": ["context", "decisions", "experience", "meetings", "plans", "playbook", "people"],
  "tags": {
    "AI-agent": 4,
    "tool-research": 3,
    "ai-agent": 2,
    "openspace": 2
  },
  "stats": {
    "total": 298,
    "by_type": { "status": 244, "reference": 51, "personal": 2, "learning": 1 },
    "by_category": { "plans": 239, "product-analysis": 39, "context": 13 },
    "stale_count": 180,
    "duplicate_count": 42,
    "oldest": "2026-02-22",
    "newest": "2026-03-30"
  },
  "top_used": [
    { "path": "context/company.md", "title": "CloudApp", "read_count": 12 }
  ],
  "least_used": [
    { "path": "plans/old-plan.md", "title": "Old Plan", "read_count": 0 }
  ]
}
```

### 5.4 字段说明

| 字段 | 说明 |
|------|------|
| `types` | 所有合法的文档类型（硬编码） |
| `categories` | 所有顶层目录分类（硬编码） |
| `tags` | 当前仓库中所有 tag 及其出现次数，按次数降序 |
| `stats.total` | 文档总数 |
| `stats.by_type` | 按 type 分组计数 |
| `stats.by_category` | 按顶层目录分组计数 |
| `stats.stale_count` | status 类型且 date > 30 天前的文档数 |
| `stats.duplicate_count` | 与其他文档 contentHash 相同的文档数 |
| `stats.oldest / newest` | 最早/最新的文档日期 |
| `top_used` | 读取次数最多的 10 篇文档（需 usage.json 存在） |
| `least_used` | 读取次数最少的 10 篇文档（需 usage.json 存在） |

### 5.5 实现细节

**文件**: `src/tools/schema.ts`

核心函数 `schema(repoPath: string): SchemaOutput`：

- 调用 `buildIndex()` 获取全部 entries
- 调用 `loadUsage()` 获取使用量数据
- Tag 统计：遍历所有 entries 的 tags，用 Map 计数，转为 Record 并按 count 降序排列
- 重复数统计：用 Map<contentHash, count> 分组，count > 1 的累加
- 使用量排行：将 usage.json 数据与 index entries 做 inner join（只展示仍存在的文档），分别取 top 10 和 bottom 10

---

## 6. 新增命令：sp gc

### 6.1 用途

扫描并归档已过期的文档。过期判断依据 frontmatter 中的 `expires` 字段。

### 6.2 使用方式

```bash
# 列出过期文档（不执行归档）
sp gc

# 自动归档过期文档
sp gc --yes
sp gc -y

# JSON 模式
sp gc --json
```

### 6.3 执行逻辑

1. 调用 `buildIndex()` 获取全部 entries
2. 过滤出 `expires < today` 且 `archived !== true` 的文档
3. 如果传入 `--yes`：
   - 逐个读取文件，修改 frontmatter 中的 `status` 为 `archived`
   - 如果已有 `status` 字段则替换，没有则在 `---` 前插入
   - 修改完毕后调用 `writeIndex()` 重建索引
4. 返回 `{ expired, archived, message }`

### 6.4 输出示例

```
Expired documents:
  plans/2026-02-24-daily-plan/task-brief.md (expired: 2026-03-24)
  plans/2026-02-25-research/notes.md (expired: 2026-03-25) ✓ archived

Archived 2 of 2 expired documents.
```

### 6.5 归档后的效果

- 文档 frontmatter 的 `status` 被设为 `archived`
- INDEX.json 中该文档的 `archived` 字段变为 `true`
- `sp search` 默认排除 `archived: true` 的文档
- `sp doctor` 不再将其标记为 `[STALE]`

---

## 7. 增强命令：sp search

### 7.1 新增参数

| 参数 | 短参数 | 说明 |
|------|--------|------|
| `--mode <and\|or>` | `-m` | 搜索词组合模式，默认 and |
| `--snippet` | 无 | 返回关键词上下文片段 |

### 7.2 使用示例

```bash
# OR 搜索：任一词命中即返回
sp search "竞品 定价" --mode or

# 带 snippet：返回关键词周围文本
sp search "定价" --snippet

# 组合使用
sp search "竞品 视频生成" --mode or --snippet --limit 5

# 过滤类型 + OR 搜索
sp search "pricing model" --mode or --type reference
```

### 7.3 新增返回字段

v1.1 的搜索结果类型从 `IndexEntry` 扩展为 `SearchResult`：

```typescript
export interface SearchResult extends IndexEntry {
  snippet?: string;                                          // 关键词上下文
  linked?: Array<{ type: string; path: string; title: string }>;  // 关联文档
}
```

输出示例：

```json
{
  "path": "context/competitors/stan-store.md",
  "title": "stan.store",
  "type": "reference",
  "tags": [],
  "snippet": "...价格: ~$29/月\n- 定位: 创作者商铺（Link-in-bio + 结账 + 变现）...",
  "linked": [
    { "type": "leads-to", "path": "context/feature-spec.md", "title": "Feature Spec — CloudApp" }
  ]
}
```

### 7.4 OR 模式实现

MiniSearch 的 `search()` 方法支持传入 options 覆盖默认配置：

```typescript
const searchResults = engine.search(params.query, {
  combineWith: params.mode === 'or' ? 'OR' : 'AND',
});
```

- `AND`（默认）：所有搜索词都必须命中
- `OR`：任一搜索词命中即返回

对中文搜索特别有用：搜索 "竞品 定价" 时，AND 要求两词同时出现；OR 会找到只提了 "定价" 或只提了 "竞品" 的文档。

### 7.5 Snippet 提取

`extractSnippet(config, entry, query)` 函数：

1. 读取原文件全文
2. 逐行扫描，找到第一个包含任一搜索词的行
3. 取该行前后各 2 行（共 5 行窗口）作为 snippet
4. 未找到命中行则返回 `undefined`

### 7.6 关联文档解析

对于有 `links` 字段的搜索结果：

1. 从当前 index 的 `entryByPath` Map 中查找 `link.target`
2. 如果找到，使用该 entry 的 `title`
3. 如果未找到（链接断裂），用 `link.target` 路径作为 title

### 7.7 归档文档过滤

在搜索候选集构建阶段，最先执行归档过滤：

```typescript
candidates = candidates.filter(e => !e.archived);
```

确保 `status: archived` 的文档不出现在搜索结果中。

### 7.8 使用量追踪集成

搜索函数末尾，对最终返回的结果调用 `trackSearchHit()`：

```typescript
trackSearchHit(config.repoPath, results.map(r => r.path));
```

每次搜索命中的文档，其 `search_hit_count` 自增 1。

---

## 8. 增强命令：sp push

### 8.1 新增参数

| 参数 | 说明 |
|------|------|
| `--ttl <e.g. 30d>` | 自动设置过期日期（从今天起算） |

### 8.2 使用示例

```bash
# 带 TTL：30 天后过期
sp push --title "Sprint 3 日报" --type status --ttl 30d --content "..."

# Tag 自动标准化
sp push --title "New Tool" --type reference --tags "AI-Agent,Tool" --content "..."
# 输出: Tag "ai-agent" similar to existing "ai-agent", auto-replaced
```

### 8.3 Tag 自动标准化

push 时自动执行两步 tag 清洗：

**第一步：强制小写**

```typescript
if (params.tags) {
  params.tags = params.tags.map(t => t.toLowerCase());
}
```

**第二步：相似 tag 检测**

从 INDEX 中收集所有已有 tag（小写化），对每个新 tag 做 Levenshtein 距离检查：

```typescript
for (let i = 0; i < params.tags.length; i++) {
  const tag = params.tags[i];
  for (const existing of existingTags) {
    if (existing !== tag && levenshtein(existing, tag) <= 2) {
      tagWarnings.push(`Tag "${tag}" similar to existing "${existing}", auto-replaced`);
      params.tags[i] = existing;
      break;
    }
  }
}
```

- 编辑距离 ≤ 2 → 自动替换为已有 tag
- 产生警告消息附在 push 返回结果中

**Levenshtein 距离算法**：标准 DP 实现，O(m*n) 时间复杂度。

### 8.4 TTL 支持

```bash
sp push --title "临时文档" --type status --ttl 30d --content "..."
```

实现：

```typescript
if (params.ttl) {
  const days = parseTTLDays(params.ttl);  // "30d" → 30
  if (days > 0) {
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    meta.expires = expires.toISOString().split("T")[0];  // "2026-04-29"
  }
}
```

- `parseTTLDays()` 用正则 `/^(\d+)d$/` 解析天数
- expires 写入 frontmatter，格式 YYYY-MM-DD
- `sp gc` 可根据此字段自动归档过期文档

### 8.5 级联复审告警

当一篇文档被更新时，检查是否有其他文档通过 `based-on` 链接依赖它：

```typescript
function checkCascadeReview(existingIndex: Index, updatedPath: string): string[] {
  const warnings: string[] = [];
  for (const entry of existingIndex.entries) {
    if (!entry.links) continue;
    for (const link of entry.links) {
      if (link.type === "based-on" && link.target === updatedPath) {
        warnings.push(`[CASCADE] ${entry.path} (based-on: ${updatedPath}) may need review`);
      }
    }
  }
  return warnings;
}
```

使用场景：`context/company.md` 被更新时，如果 `context/feature-spec.md` 有 `based-on: context/company.md`，push 结果会附加警告：

```
Pushed: context/company.md
Committed and pushed to origin/main
[CASCADE] context/feature-spec.md (based-on: context/company.md) may need review
```

---

## 9. 使用量追踪系统

### 9.1 设计理念

参考 OpenSpace SkillStore 的使用量追踪——知道哪些文档有价值、哪些是死文档。

### 9.2 存储位置

```
<sp-context-repo>/.sp-context/usage.json
```

**不推到 git**——各端独立统计，避免合并冲突。建议在 `.gitignore` 中添加 `.sp-context/`。

### 9.3 数据结构

```typescript
export interface UsageRecord {
  read_count: number;       // 被 sp get 读取的次数
  last_read: string;        // 最近一次读取日期 (YYYY-MM-DD)
  search_hit_count: number; // 被 sp search 命中的次数
}

export interface UsageStore {
  [path: string]: UsageRecord;  // key 是文档在仓库中的相对路径
}
```

### 9.4 触发点

| 操作 | 触发函数 | 更新字段 |
|------|----------|----------|
| `sp get <path>` | `trackRead()` | `read_count++`, `last_read = today` |
| `sp search <query>` | `trackSearchHit()` | 命中文档的 `search_hit_count++` |

### 9.5 消费点

| 消费者 | 使用方式 |
|--------|----------|
| `sp doctor` | 标记 `[UNUSED]` — read_count=0 或 last_read > 30 天前 |
| `sp schema` | `top_used` (read_count Top 10) / `least_used` (Bottom 10) |

### 9.6 API

```typescript
// 读取使用量数据（外部可调用）
loadUsage(repoPath: string): UsageStore

// 记录一次 get 读取
trackRead(repoPath: string, docPath: string): void

// 记录搜索命中（批量）
trackSearchHit(repoPath: string, docPaths: string[]): void
```

---

## 10. 智能 Session 注入

### 10.1 改动位置

`hooks/session-start.sh` — Claude Code 的 SessionStart hook。

### 10.2 三层注入架构

```
Layer 0: 统一注入 (保持原有行为)
  - 知识库总量统计
  - 分类目录 + 近期文档标题
  - CLI 用法说明
  ~114 tokens

Layer 1: 按需搜索 (保持原有行为)
  - sp search → 摘要
  - sp get → 全文

Layer 2: 项目感知注入 (v1.1 新增)
  - 检测当前工作目录
  - 自动搜索相关文档 (最多 3 篇)
  - 以 markdown 链接格式注入
```

### 10.3 项目感知逻辑

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROJECT_NAME=$(basename "$PROJECT_DIR")

RELATED=$(sp search "$PROJECT_NAME" --limit 3 --json 2>/dev/null || echo "[]")
# 解析 JSON，生成 markdown 链接列表
```

效果：
- 在 `~/code/openstore/` 目录下 → 注入 company.md + feature-spec + version-plan
- 在 `~/code/dune-react/` 目录下 → 注入 Articles 组件重构经验
- 在 `~/code/random-project/` 目录下 → 只显示通用目录

### 10.4 新增命令列表

hook 输出中新增 3 条命令：

```
sp doctor                 检查知识库质量（重复/过期/tag不一致）
sp schema                 知识库元数据自省（类型/tag/统计）
sp gc [--yes]             清理过期文档
```

搜索命令更新提示新增 `[--mode or] [--snippet]`。

---

## 11. 文档链接机制

### 11.1 Frontmatter 格式

```yaml
---
title: Wix — 5 层深度分析
type: reference
links:
  - type: based-on
    target: context/competitors/landscape.md
  - type: related
    target: context/competitors/squarespace.md
  - type: leads-to
    target: context/feature-spec.md
---
```

### 11.2 三种链接类型

| 类型 | 方向 | 含义 | 典型用法 |
|------|------|------|----------|
| `based-on` | 上游 | 本文档依赖该文档 | 功能规格 based-on 公司定义 |
| `leads-to` | 下游 | 本文档驱动了该文档 | 竞品分析 leads-to 功能设计 |
| `related` | 平级 | 相关联的文档 | Wix 分析 related Squarespace 分析 |

### 11.3 数据流

```
Frontmatter (YAML)
  ↓ parseDoc() 解析
DocMeta.links (TypeScript)
  ↓ buildIndex() 收录
IndexEntry.links (INDEX.json)
  ↓ search() 解析
SearchResult.linked (搜索结果)

  ↓ doctor → checkBrokenLinks() 检查完整性
  ↓ push → checkCascadeReview() 级联告警
```

### 11.4 建议的知识库链接关系

```
context/company.md (公司定义)
  ├── leads-to: context/feature-spec.md
  ├── leads-to: plans/2026-03/version-plan.md
  └── based-on: context/competitors/landscape.md

context/competitors/landscape.md (竞品全景)
  ├── leads-to: context/competitors/wix.md
  ├── leads-to: context/competitors/stan-store.md
  └── leads-to: context/feature-spec.md

context/feature-spec.md (功能规格)
  ├── based-on: context/company.md
  ├── based-on: context/competitors/landscape.md
  └── leads-to: plans/2026-03/version-plan.md
```

---

## 12. 文档生命周期管理

### 12.1 完整生命周期

```
创建 (sp push)
  ↓ --ttl 可设置 expires
活跃 (status: active / 默认)
  ↓ sp doctor 检查过期
过期 (expires < today)
  ↓ sp gc --yes
归档 (status: archived)
  ↓ 搜索默认排除
  ↓ 仍可 sp get 读取
```

### 12.2 各阶段行为

| 阶段 | 搜索可见 | doctor 标记 | gc 操作 |
|------|----------|-------------|---------|
| 创建/活跃 | 可见 | 可能标记 [STALE] | 不处理 |
| 过期（未归档） | 可见 | 标记 [STALE] | 列出，可归档 |
| 已归档 | 默认不可见 | 不标记 | 不处理 |

### 12.3 相关 Frontmatter 字段

```yaml
expires: 2026-04-30      # sp push --ttl 30d 自动设置
status: active           # active | archived | draft
```

---

## 13. 数据流全景图

```
                        ┌─────────────────┐
                        │  sp-context repo │
                        │  (Markdown 文件)  │
                        └────────┬────────┘
                                 │
                    buildIndex() │ 遍历 + 解析 frontmatter
                                 ▼
                        ┌─────────────────┐
                        │   INDEX.json     │
                        │  (索引 + 元数据)  │
                        └──┬──┬──┬──┬──┬──┘
                           │  │  │  │  │
            ┌──────────────┘  │  │  │  └──────────────┐
            │                 │  │  │                  │
            ▼                 ▼  │  ▼                  ▼
      ┌──────────┐    ┌────────┐│┌────────┐    ┌──────────┐
      │ sp search│    │sp get  │││sp push │    │sp list   │
      │  MiniSearch   │读取全文│││写入文档│    │按目录列表│
      │  BM25+CJK│    │        │││        │    │          │
      └────┬─────┘    └───┬────┘│└───┬────┘    └──────────┘
           │              │     │    │
           │   trackRead()│     │    │ tag 标准化
           │              ▼     │    │ TTL → expires
           │      ┌────────────┐│    │ 级联复审
           │      │ usage.json ││    │
           │      │ (使用量)    ││    │
           │      └──────┬─────┘│    │
    track  │             │      │    │
    Search │             │      │    │
    Hit()  │    ┌────────┘      │    │
           │    │               │    │
           ▼    ▼               ▼    ▼
      ┌──────────────┐    ┌──────────────┐
      │  sp doctor    │    │  sp schema   │
      │  7 项检查     │    │  元数据自省   │
      │  ↑ 读 usage   │    │  ↑ 读 usage  │
      └──────────────┘    └──────────────┘
                │
                ▼
      ┌──────────────┐
      │   sp gc       │
      │  归档过期文档  │
      │  修改 status   │
      │  重建 INDEX    │
      └──────────────┘
```

---

## 14. 开发指南

### 14.1 环境要求

- Bun (运行时 + 打包)
- Node.js 18+ (TypeScript 类型)
- Git

### 14.2 开发命令

```bash
# 运行 CLI（开发模式）
bun run src/cli.ts <command>

# 构建二进制
bun build src/cli.ts --target bun --compile --outfile dist/sp

# 构建 HTTP 服务
bun build src/http.ts --outdir dist --target bun --entry-naming http.js

# 重建索引
bun run src/index-builder.ts

# TypeScript 类型检查
npx tsc --noEmit
```

### 14.3 添加新命令的步骤

1. **创建 tool** — `src/tools/<name>.ts`
   - 定义输入/输出接口
   - 实现纯业务逻辑函数
   - 不依赖 CLI 参数格式

2. **创建 command** — `src/commands/<name>.ts`
   - 用 `parseArgs` 解析命令行参数
   - 调用 tool 函数
   - 用 `output()` / `outputMessage()` 输出

3. **注册路由** — `src/cli.ts`
   - import command
   - 在 switch 中添加 case
   - 更新 printHelp

4. **更新 hook** — `hooks/session-start.sh`
   - 在 CLI 工具列表中添加新命令

### 14.4 输出约定

- **TTY 模式**（终端交互）：人类可读格式，支持颜色
- **Pipe 模式**（`| jq` / Agent 调用）：自动切换 JSON
- `--json` 全局 flag 强制 JSON
- 用 `output()` 自动判断模式
- 用 `outputMessage()` 输出纯文本消息（JSON 模式下包装为 `{ message: "..." }`）
- 用 `useJson()` 检查当前是否 JSON 模式

### 14.5 INDEX.json 字段参考

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `path` | string | 文件系统 | 仓库内相对路径 |
| `title` | string | frontmatter / 推断 | 文档标题 |
| `type` | string | frontmatter / 推断 | 文档类型 |
| `project` | string? | frontmatter / 推断 | 所属项目 |
| `tags` | string[] | frontmatter | 标签列表 |
| `date` | string? | frontmatter / 文件名 / mtime | 日期 (YYYY-MM-DD) |
| `summary` | string | 自动提取 | 前 3 行非标题文本，≤120 字符 |
| `keywords` | string[] | TF 提取 | Top 8 关键词 (含 CJK bigram) |
| `contentHash` | string | MD5 | 12 位内容哈希，用于去重 |
| `links` | DocLink[]? | frontmatter | [v1.1] 文档间链接 |
| `expires` | string? | frontmatter | [v1.1] 过期日期 |
| `archived` | boolean? | frontmatter status | [v1.1] 是否已归档 |

### 14.6 配置文件位置

```
~/.sp-context/config.json      — 多仓库配置
<repo>/.sp-context/usage.json  — 使用量数据（本地，不推 git）
<repo>/INDEX.json               — 搜索索引（推 git）
```

---

## 附录：命令速查表

```bash
# ── 读取 ──
sp search <query>                      # 搜索文档
sp search <query> --mode or            # OR 搜索
sp search <query> --snippet            # 返回关键词上下文
sp search <query> -t reference         # 按类型过滤
sp get <path>                          # 读取全文
sp list <category>                     # 按目录列表

# ── 写入 ──
sp push --title <t> --type <type> --content <text>  # 写入文档
sp push --title <t> --type status --ttl 30d         # 30 天后过期
sp push --title <t> --type reference --tags a,b     # 自动 tag 标准化

# ── 治理 ──
sp doctor                              # 检查知识库质量
sp schema                              # 元数据自省
sp gc                                  # 列出过期文档
sp gc --yes                            # 归档过期文档
sp sync                                # 同步远程

# ── 管理 ──
sp add <file>                          # 添加本地文件
sp delete <path>                       # 删除文档
sp move <path> --to <dir>              # 移动文档
sp config list                         # 列出仓库
sp config switch <label>               # 切换仓库
```
