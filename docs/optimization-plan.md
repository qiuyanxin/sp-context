# sp-context + sp-context-plugin 优化方案

> 日期: 2026-03-30
> 版本: v1.1
> 参考: Pensieve (项目记忆系统) + InsForge (BaaS 语义层) + OpenSpace (技能自进化引擎)
> 范围: sp-context (知识库) + sp-context-plugin (Agent 接口)

---

## 现状诊断

### sp-context（知识库）：205 篇文档，7.4/10 质量分

| 问题 | 证据 | 严重度 |
|------|------|--------|
| 4 对重复文档 | `context/company.md` 与 `plans/lafe-2026-03-03-huakai/company.md` hash 完全相同（4cce9781c5f0）；`goals.md` 与 `plans/2026-03/goals.md` 完全相同 | 高 |
| Tag 不一致 | `AI-agent`(3次) vs `ai-agent`(2次)；24 个 tag 中 20 个只用过一次 | 中 |
| 类型失衡 | 74% 是 status(152篇)，learning 只有 1 篇，decisions/meetings/playbook 为空 | 中 |
| 无文档间关联 | 7 篇竞品分析和 feature-spec 之间零链接 | 高 |
| 无过期机制 | 2/22 的 Version Plan 标注 "V1.0=3月"，3/30 了没有任何更新提示 | 中 |
| 大文件风险 | `context/feature-spec.md`(79KB) 单体 | 低 |

### sp-context-plugin（Agent 接口）：功能完整但粗糙，7/10

| 问题 | 证据 | 严重度 |
|------|------|--------|
| 搜索只支持 AND | 搜 "竞品 定价" 要求两词都命中，竞品分析里可能用 "pricing" 或 "价格" | 高 |
| Session 注入无差异化 | 不管在哪个项目目录，都注入同样的 114 token 目录摘要 | 中 |
| 无质量校验 | push 任意内容都接受，frontmatter 缺字段不报错 | 中 |
| MiniSearch 每次重建 | 每次 `sp search` 都重新构建搜索索引（205 篇还行，1000+ 会慢） | 低 |
| 无 schema 自省 | agent 不知道有哪些合法 type/tag/category，只能靠 help 文本猜 | 高 |
| 搜索无上下文 | 返回 title + summary，不知道关键词命中在文档哪个位置 | 中 |

---

## 优化参考来源

### Pensieve 的可借鉴点

| 特性 | Pensieve 实现 | sp-context 适配方式 |
|------|--------------|-------------------|
| 语义链接 | `[[...]]` + based-on/leads-to/related 三种类型 | frontmatter `links` 字段 + INDEX 解析 |
| doctor 校验 | Python 引擎扫描结构/格式/关键文件漂移 | TypeScript `sp doctor` 扫描重复/过期/缺失/tag 不一致 |
| short-term → long-term | 默认写入 short-term/（TTL 7 天），确认后晋升 | `--ttl` 参数 + `expires` frontmatter + `sp gc` 清理 |
| self-improve 自动积累 | PostToolUse hook 触发知识图谱同步 | session-stop hook 提示 + 未来自动提取 |
| 状态机 | EMPTY → SEEDED → ALIGNED / DRIFTED | `sp doctor` 输出健康度报告 |

### InsForge 的可借鉴点

| 特性 | InsForge 实现 | sp-context 适配方式 |
|------|--------------|-------------------|
| MCP 语义层 | fetch-docs 让 agent 按需拉取文档 | `sp schema` 让 agent 自省可用类型/tag/统计 |
| 结构化操作 | agent 通过工具理解后端能力 | 搜索结果返回关联文档链接，agent 可顺链查找 |
| SDK 统一接口 | createClient() + {data, error} | CLI pipe JSON 已实现，增强 error 结构 |

### OpenSpace 的可借鉴点

OpenSpace 是一个 AI Agent 技能自进化引擎（41,706 行 Python），核心创新是三重触发的技能自动进化 + 质量追踪 + 版本谱系。GDPVal 基准测试中实现 4.2× 收入提升、46% token 节省。

| 特性 | OpenSpace 实现 | sp-context 适配方式 |
|------|--------------|-------------------|
| **使用量追踪** | SkillStore 记录每个 skill 的 applied/completion/effective/fallback rate | INDEX 新增 `read_count` 字段，`sp get` 时自增，追踪哪些文档实际被使用 |
| **质量衰退检测** | 三重触发器：post-execution analysis + tool degradation + metric monitor | `sp doctor --watch` 定期扫描：过期、使用率为 0、链接断裂 |
| **混合搜索** | BM25 + Embedding + LLM 三级搜索 | Phase 5 考虑：当前 BM25 only → 加 embedding 语义搜索（对中文效果提升大） |
| **版本谱系 (Lineage DAG)** | 每个 skill 记录 parent_skill_ids + generation + unified diff | 文档更新时保留 `previous_hash`，可追溯文档演变历史 |
| **持久身份 (.skill_id)** | sidecar 文件，目录移动后 ID 不变 | frontmatter 中的 `contentHash` 已部分实现，可扩展为稳定 `doc_id` |
| **自动积累 (CAPTURED)** | 从成功执行中自动提取可复用模式 | session-stop hook 分析对话，建议 push 的知识点 |
| **级联更新** | 单个 tool 故障 → 所有依赖 skill 重新评估 | 文档更新时，检查所有 `based-on` 指向该文档的下游文档，标记需复审 |

#### OpenSpace 不照搬的部分

| 特性 | 不适用原因 |
|------|-----------|
| LLM Agent Loop 进化 | sp-context 是知识库不是技能执行系统，不需要 agent 循环修改文档内容 |
| GUI/Shell/Web 后端 | sp-context 是纯文档系统，不涉及工具执行 |
| 云社区 (open-space.cloud) | 3 人团队单仓库够用，不需要跨实例共享 |
| 并发控制 (Semaphore) | git 单分支已保证串行写入 |
| 安全沙箱 | 知识库是 Markdown 文件，无安全执行需求 |

---

## A. sp-context（知识库内容优化）

### A1. 清理现有数据质量问题 — `sp doctor`

新增 `sp doctor` 命令，扫描以下问题：

| 检查项 | 规则 | 输出标签 |
|--------|------|----------|
| 重复文档 | contentHash 相同的文档对 | `[DUPLICATE]` |
| Tag 标准化 | 大小写不一致的 tag 对 | `[TAG]` |
| 缺失字段 | frontmatter 缺 title/type/date | `[MISSING]` |
| 空目录 | 有 .gitkeep 但无内容 | `[EMPTY]` |
| 过期文档 | status 类型 + date 距今 > 30 天 | `[STALE]` |
| 链接断裂 | links 指向不存在的文档（A2 实现后） | `[BROKEN_LINK]` |

输出示例：

```
sp doctor

[DUPLICATE] context/company.md ↔ plans/lafe-2026-03-03-huakai/company.md (hash: 4cce9781c5f0)
[DUPLICATE] goals.md ↔ plans/2026-03/goals.md (hash: identical)
[DUPLICATE] plans/lafe-2026-03-03-huakai/post-meeting-analysis.md ↔ product-analysis/meowant/lafe-2026-03-03-huakai/post-meeting-analysis.md
[DUPLICATE] plans/lafe-2026-03-03-huakai/00-prd.md ↔ product-analysis/meowant/lafe-2026-03-03-huakai/01-华凯合作方案草稿.md
[TAG] "AI-agent" (3次) 和 "ai-agent" (2次) 应统一为 "ai-agent"
[STALE] plans/2026-03/version-plan.md — V1.0 目标 "3月" 已过，37 天未更新
[EMPTY] decisions/ — 0 篇文档
[EMPTY] meetings/ — 0 篇文档
[EMPTY] playbook/ — 0 篇文档

Summary: 4 duplicates, 1 tag issue, 1 stale, 3 empty dirs
```

### A2. 文档链接机制

在 frontmatter 中支持 `links` 字段，三种链接类型（参考 Pensieve）：

- `based-on`：依赖关系（这篇决策基于哪个知识/分析）
- `leads-to`：驱动关系（这篇分析驱动了哪个功能设计/计划）
- `related`：并列关联

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

#### 当前知识库应建立的链接关系

```
context/company.md (公司定义)
  ├── leads-to: context/feature-spec.md
  ├── leads-to: plans/2026-03/version-plan.md
  └── based-on: context/competitors/landscape.md

context/competitors/landscape.md (竞品全景)
  ├── leads-to: context/competitors/wix.md
  ├── leads-to: context/competitors/stan-store.md
  ├── leads-to: context/competitors/durable.md
  ├── leads-to: context/competitors/squarespace.md
  ├── leads-to: context/competitors/whop.md
  ├── leads-to: context/competitors/linktree.md
  ├── leads-to: context/competitors/atoms.md
  └── leads-to: context/feature-spec.md

context/feature-spec.md (功能规格)
  ├── based-on: context/company.md
  ├── based-on: context/competitors/landscape.md
  └── leads-to: plans/2026-03/version-plan.md

plans/2026-03/version-plan.md (版本规划)
  ├── based-on: context/feature-spec.md
  └── based-on: context/company.md
```

INDEX 构建时解析 links，搜索结果中返回关联文档路径。agent 搜到一篇竞品分析时，能看到它 leads-to 哪个功能设计决策。

### A3. 文档使用量追踪（参考 OpenSpace SkillStore）

OpenSpace 对每个 skill 追踪四个指标：applied rate（被选中率）、completion rate（成功率）、effective rate（有效率）、fallback rate（回退率）。这让系统知道哪些 skill 有价值、哪些是死代码。

sp-context 当前的问题：205 篇文档，不知道哪些被 agent 实际使用，哪些从未被读取。

**做什么**：在 INDEX 中为每篇文档新增使用量字段：

```json
{
  "path": "context/company.md",
  "title": "CloudApp",
  "read_count": 12,
  "last_read": "2026-03-30",
  "search_hit_count": 25
}
```

追踪机制：
- `sp get <path>` 执行时，自增 `read_count`，更新 `last_read`
- `sp search` 命中时，自增 `search_hit_count`
- 存储在本地 `.sp-context/usage.json`（不推到 git，各端独立统计）
- `sp doctor` 用使用量数据标记 "零使用文档"：`[UNUSED] context/raw_info.md — 30 天内 0 次读取`
- `sp schema` 输出 top 10 高频文档和 bottom 10 零使用文档

### A4. 级联复审标记（参考 OpenSpace 级联更新）

OpenSpace 的关键设计：当一个 tool 出故障，系统自动找到所有依赖该 tool 的 skill，批量触发重新评估。

sp-context 的适配：当一篇基础文档更新后，所有 `based-on` 指向它的下游文档应被标记为 "需复审"。

```
# 假设 context/company.md 被更新了
# 自动检查：哪些文档 based-on 它？

context/feature-spec.md (based-on: context/company.md) → 标记 [REVIEW_NEEDED]
plans/2026-03/version-plan.md (based-on: context/company.md) → 标记 [REVIEW_NEEDED]
```

实现：`sp push` 更新已有文档时（contentHash 变化），扫描 INDEX 中所有 `links.type === "based-on"` 且 `links.target` 指向该文档的条目，输出告警。

### A5. 文档生命周期管理

在 frontmatter 支持 `expires` 和 `status` 字段：

```yaml
---
title: Version Plan — CloudApp
type: status
status: active    # active | archived | draft
expires: 2026-04-30
---
```

机制：
- `sp push --ttl 30d`：自动计算 expires 日期写入 frontmatter
- `sp doctor` 扫描时标记过期文档为 `[STALE]`
- `sp gc`：列出过期文档，确认后标记 `status: archived`
- INDEX 构建时，archived 文档仍索引但标记 `archived: true`，搜索默认排除

---

## B. sp-context-plugin（Agent 接口优化）

### B1. `sp doctor` 命令

```typescript
// src/tools/doctor.ts
interface Finding {
  level: 'error' | 'warning' | 'info';
  category: string;  // DUPLICATE | TAG | STALE | MISSING | EMPTY | BROKEN_LINK
  message: string;
  paths?: string[];
}

interface DoctorReport {
  findings: Finding[];
  summary: { errors: number; warnings: number; info: number };
}

export function doctor(config: SpConfig): DoctorReport {
  const index = buildIndex(config.repoPath);
  const findings: Finding[] = [];

  // 1. 重复检测：contentHash 相同的文档对
  // 2. Tag 标准化：大小写不一致的 tag
  // 3. 过期检测：status 类型 + date 距今 > 30 天
  // 4. 缺失字段：frontmatter 缺 title/type
  // 5. 空目录：有 .gitkeep 但无 .md 文件
  // 6. 链接完整性：links.target 指向不存在的文件

  return { findings, summary };
}
```

### B2. `sp schema` — Agent 自省接口

参考 InsForge 的 MCP `fetch-docs`——agent 需要知道系统能做什么。

```bash
sp schema
```

输出：

```json
{
  "types": ["reference", "learning", "decision", "meeting", "status", "playbook", "personal"],
  "categories": ["context", "decisions", "experience", "meetings", "plans", "playbook", "people"],
  "tags": {
    "ai-agent": 5,
    "tool-research": 3,
    "competitor": 2,
    "baas": 1
  },
  "stats": {
    "total": 205,
    "by_type": { "status": 152, "reference": 50, "personal": 2, "learning": 1 },
    "by_category": { "plans": 146, "product-analysis": 39, "context": 13 },
    "stale_count": 3,
    "duplicate_count": 4,
    "oldest": "2026-02-23",
    "newest": "2026-03-30"
  }
}
```

agent 在 push 前调 `sp schema` 就知道该用什么 type、该加什么已有 tag。

### B3. 智能 Session 注入

改造 `hooks/session-start.sh`，从统一注入变为项目感知注入：

```bash
# Layer 1: 始终注入（保持当前行为）
# 知识库统计 + CLI 用法
# ~114 tokens

# Layer 2: 项目感知注入（新增）
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROJECT_NAME=$(basename "$PROJECT_DIR")

# 搜索与当前项目相关的文档
RELATED=$(sp search "$PROJECT_NAME" --limit 3 --json 2>/dev/null)
if [ -n "$RELATED" ] && [ "$RELATED" != "[]" ]; then
  echo ""
  echo "# 与当前项目相关的知识 (sp get <path> 获取全文)"
  echo "$RELATED" | jq -r '.[] | "- [\(.title)](\(.path))"'
fi
```

效果：
- 在 openstore 目录下：自动看到 company.md + feature-spec + version-plan
- 在 dune-react 目录下：看到 Articles 组件重构经验
- 在其他目录：只看到通用目录

### B4. 搜索增强

#### 4a. OR 模式

```bash
sp search "竞品 视频生成" --mode or
```

当前只有 AND（两个词都要命中），加 OR 模式允许任一词命中。

```typescript
// src/tools/search.ts
const combineWith = options?.mode === 'or' ? 'OR' : 'AND';
const results = miniSearch.search(query, {
  combineWith,
  prefix: true,
  fuzzy: 0.2,
  boost: { title: 5, tagsText: 3, keywordsText: 2.5, project: 2, summary: 1.5, path: 1 },
});
```

#### 4b. 搜索结果片段

```bash
sp search "定价" --snippet
```

返回关键词周围的文本片段，而不只是 title + summary：

```json
{
  "path": "context/competitors/stan-store.md",
  "title": "stan.store",
  "snippet": "...价格: ~$29/月\n- 定位: 创作者商铺（Link-in-bio + 结账 + 变现）..."
}
```

```typescript
// 命中后从原文提取关键词上下文
function extractSnippet(content: string, query: string, contextLines: number): string {
  const lines = content.split('\n');
  const queryTerms = query.toLowerCase().split(/\s+/);
  for (let i = 0; i < lines.length; i++) {
    if (queryTerms.some(t => lines[i].toLowerCase().includes(t))) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      return lines.slice(start, end).join('\n');
    }
  }
  return '';
}
```

#### 4c. 关联文档返回

搜索结果中包含 links 关联的文档（A2 实现后）：

```json
{
  "path": "context/competitors/landscape.md",
  "title": "竞品全景",
  "linked": [
    { "type": "leads-to", "path": "context/feature-spec.md", "title": "Feature Spec — CloudApp" },
    { "type": "leads-to", "path": "context/competitors/wix.md", "title": "Wix — 5 层深度分析" }
  ]
}
```

### B5. Push 时自动校验

```typescript
// src/tools/push.ts 改动

// 1. Tag 自动标准化：统一小写
params.tags = params.tags?.map(t => t.toLowerCase());

// 2. Tag 相似度检查：编辑距离 ≤ 2 时建议使用已有 tag
const existingTags = getExistingTags(index);
const warnings: string[] = [];
for (const tag of params.tags || []) {
  const similar = existingTags.find(t => levenshtein(t, tag) <= 2 && t !== tag);
  if (similar) {
    warnings.push(`Tag "${tag}" 与已有 tag "${similar}" 相似，已自动替换`);
    // 自动替换
  }
}

// 3. TTL 支持
if (params.ttl) {
  const expires = new Date();
  expires.setDate(expires.getDate() + parseTTLDays(params.ttl));
  meta.expires = expires.toISOString().split('T')[0];
}
```

### B6. 使用量追踪实现（参考 OpenSpace SkillStore）

```typescript
// src/tools/usage.ts
import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

interface UsageRecord {
  read_count: number;
  last_read: string;
  search_hit_count: number;
}

interface UsageStore {
  [path: string]: UsageRecord;
}

const USAGE_FILE = ".sp-context/usage.json";

function loadUsage(repoPath: string): UsageStore {
  const usagePath = join(repoPath, USAGE_FILE);
  if (!existsSync(usagePath)) return {};
  return JSON.parse(readFileSync(usagePath, "utf-8"));
}

function saveUsage(repoPath: string, store: UsageStore): void {
  const dir = join(repoPath, ".sp-context");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(repoPath, USAGE_FILE), JSON.stringify(store, null, 2));
}

export function trackRead(repoPath: string, docPath: string): void {
  const store = loadUsage(repoPath);
  const record = store[docPath] || { read_count: 0, last_read: "", search_hit_count: 0 };
  record.read_count++;
  record.last_read = new Date().toISOString().split("T")[0];
  store[docPath] = record;
  saveUsage(repoPath, store);
}

export function trackSearchHit(repoPath: string, docPaths: string[]): void {
  const store = loadUsage(repoPath);
  for (const p of docPaths) {
    const record = store[p] || { read_count: 0, last_read: "", search_hit_count: 0 };
    record.search_hit_count++;
    store[p] = record;
  }
  saveUsage(repoPath, store);
}
```

集成点：
- `sp get` 调用 `trackRead()`
- `sp search` 对返回结果调用 `trackSearchHit()`
- `sp doctor` 从 usage.json 读取，标记 `[UNUSED]` 文档
- `sp schema` 输出 top/bottom 使用文档
- `.sp-context/usage.json` 加入 `.gitignore`（各端独立统计，不冲突）

### B7. 级联复审告警实现（参考 OpenSpace 级联更新）

```typescript
// 在 sp push 更新已有文档时触发
function checkCascadeReview(index: IndexData, updatedPath: string): string[] {
  const warnings: string[] = [];
  for (const entry of index.entries) {
    if (!entry.links) continue;
    for (const link of entry.links) {
      if (link.type === "based-on" && link.target === updatedPath) {
        warnings.push(`[CASCADE] ${entry.path} (based-on: ${updatedPath}) 可能需要复审`);
      }
    }
  }
  return warnings;
}
```

当 `context/company.md` 被更新时，自动输出：
```
[CASCADE] context/feature-spec.md (based-on: context/company.md) 可能需要复审
[CASCADE] plans/2026-03/version-plan.md (based-on: context/company.md) 可能需要复审
```

### B8. `sp gc` — 过期文档清理

```bash
sp gc
# 输出：
# Expired documents:
#   plans/2026-02-24-daily-plan/task-brief.md (expired: 2026-03-24)
#   plans/lafe-2026-02-25-tech-research/... (expired: 2026-03-25)
#
# Archive 3 documents? [y/N]
```

实现：扫描 INDEX 中 `expires` 已过的文档，确认后将 frontmatter `status` 改为 `archived`。

---

## 实施路线

### Phase 1：数据清理（优先级最高）

| 任务 | 改动位置 | 代码量 | 收益 |
|------|----------|--------|------|
| 实现 `sp doctor` | plugin: tools/doctor.ts + commands/doctor.ts + cli.ts | ~120 行 | 立即发现 4 对重复 + tag 问题 |
| 运行 doctor 清理 sp-context | sp-context: 删重复、统一 tag | 手动 | 知识库质量从 7.4 → 8.5 |

### Phase 2：Agent 感知增强

| 任务 | 改动位置 | 代码量 | 收益 |
|------|----------|--------|------|
| 实现 `sp schema` | plugin: tools/schema.ts + commands/schema.ts + cli.ts | ~80 行 | agent 不再猜 type/tag |
| 智能 Session 注入 | plugin: hooks/session-start.sh | ~20 行 | 每次会话注入相关上下文 |
| Push tag 标准化 | plugin: tools/push.ts | ~30 行 | 杜绝未来 tag 不一致 |
| 搜索 `--mode or` + `--snippet` | plugin: tools/search.ts | ~50 行 | 搜索准确率提升 |

### Phase 3：知识图谱基础

| 任务 | 改动位置 | 代码量 | 收益 |
|------|----------|--------|------|
| INDEX 支持 links 字段 | plugin: index-builder.ts + frontmatter.ts | ~40 行 | 文档关联可被索引 |
| 搜索返回关联文档 | plugin: tools/search.ts | ~30 行 | agent 能顺链查找 |
| 给现有竞品系列补 links | sp-context: 编辑 ~10 篇 frontmatter | 手动 | 竞品→功能→版本链路打通 |
| doctor 检查 links 完整性 | plugin: tools/doctor.ts | ~20 行 | 链接断裂自动检测 |

### Phase 4：生命周期管理

| 任务 | 改动位置 | 代码量 | 收益 |
|------|----------|--------|------|
| Push 支持 `--ttl` | plugin: tools/push.ts + commands/push.ts | ~20 行 | 文档有过期日期 |
| INDEX 标记 expires/archived | plugin: index-builder.ts | ~15 行 | 搜索排除过期文档 |
| 实现 `sp gc` | plugin: tools/gc.ts + commands/gc.ts + cli.ts | ~80 行 | 定期清理过期内容 |

### Phase 5：使用量追踪 + 级联更新（参考 OpenSpace）

| 任务 | 改动位置 | 代码量 | 收益 |
|------|----------|--------|------|
| 使用量追踪 (usage.json) | plugin: tools/usage.ts | ~60 行 | 知道哪些文档有价值 |
| `sp get` 集成 trackRead | plugin: tools/get.ts | ~5 行 | 自动记录读取 |
| `sp search` 集成 trackSearchHit | plugin: tools/search.ts | ~5 行 | 自动记录搜索命中 |
| doctor 标记零使用文档 | plugin: tools/doctor.ts | ~15 行 | 发现死文档 |
| schema 输出使用量排行 | plugin: tools/schema.ts | ~20 行 | agent 知道哪些文档高频 |
| 级联复审告警 | plugin: tools/push.ts | ~30 行 | 上游文档变更时告警下游 |

### Phase 6（远期）：语义搜索（参考 OpenSpace 混合搜索）

OpenSpace 使用 BM25 + Embedding + LLM 三级搜索，对中文效果远超纯 BM25。sp-context 当前纯 BM25 对中文的语义理解有限（如搜 "定价" 找不到写了 "pricing" 的文档）。

| 任务 | 改动位置 | 代码量 | 收益 |
|------|----------|--------|------|
| 文档 embedding 生成 | plugin: tools/embedding.ts | ~100 行 | 语义向量存储 |
| 混合搜索 (BM25 + cosine) | plugin: tools/search.ts | ~80 行 | 中文/跨语言搜索质量大幅提升 |
| embedding 缓存 | plugin: .sp-context/embeddings.json | ~30 行 | 避免重复计算 |

依赖：需要 LLM API (Claude/OpenAI embedding endpoint)。成本约 $0.001/篇，205 篇 ≈ $0.2 一次性。

> 注：Phase 6 为远期规划，当前 205 篇规模 BM25 + CJK bigram 基本够用。当知识库增长到 500+ 篇或频繁出现跨语言搜索需求时再启动。

---

## 总结

| 维度 | 当前 | Phase 1 后 | Phase 4 后 | Phase 5 后 |
|------|------|-----------|-----------|-----------|
| 知识库质量 | 7.4/10 | 8.5/10 | 9/10 | 9.5/10 |
| 搜索有效性 | AND only, 无上下文 | + OR + snippet | + 关联文档 | + 使用量排序 |
| Agent 感知 | 114 token 统一注入 | + 项目感知 + schema | + links 图谱 | + 高频文档推荐 |
| 数据治理 | 无 | doctor 扫描 | + TTL + gc 闭环 | + 使用量 + 级联告警 |
| 新增命令 | push/get/search/list/sync/add/delete/move | + doctor + schema | + gc | — |
| 总代码量 | — | ~200 行 | ~500 行 | ~635 行 |

## 参考项目总结

| 项目 | 核心借鉴 | 不照搬的部分 |
|------|---------|-------------|
| **Pensieve** | 语义链接、doctor 校验、short-term TTL、self-improve 自动积累 | 四层模型（sp 已有自己的分类）、Python 引擎、状态机 |
| **InsForge** | MCP 语义层（→ sp schema）、结构化操作、SDK 模式 | PostgREST、Deno、RLS（这是 BaaS 不是知识库）|
| **OpenSpace** | 使用量追踪、质量衰退检测、混合搜索、级联更新、版本谱系 | LLM Agent Loop 进化、GUI/Shell 后端、云社区、安全沙箱 |
