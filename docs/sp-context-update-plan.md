# sp-context 知识库更新计划

> 诊断日期: 2026-03-30
> 版本: v3 (基于 review 反馈修正)
> 当前状态: 298 篇文档，16 errors / 36 warnings / 301 info
> 目标: 质量从 ~6/10 → 9.5/10，结构从扁平堆积 → 分层有链接
> Review: decisions/2026-03-30-review-sp-context-知识库更新计划.md

---

## 诊断全景

### 数量分布

| 目录 | 文档数 | 占比 | 问题 |
|------|--------|------|------|
| plans/ | 237 | 79.5% | 严重失衡，绝大多数是一次性 status 文档 |
| product-analysis/ | 39 | 13.1% | meowant 专项，与 plans/ 有大量重复 |
| context/ | 14 | 4.7% | 核心上下文，但混入了临时文件 (plan-3, base-info, raw_info) |
| people/ | 6 | 2.0% | 个人研究笔记，OK |
| experience/ | 1 | 0.3% | 仅 1 篇经验教训 |
| goals.md | 1 | 0.3% | 根目录散落文件，与 plans/2026-03/goals.md 重复 |
| decisions/ | 0 | — | 空目录 |
| meetings/ | 0 | — | 空目录 |
| playbook/ | 0 | — | 空目录 |

### 问题汇总

| 问题类型 | 数量 | 严重度 | 说明 |
|----------|------|--------|------|
| **DUPLICATE** | 16 组 (35 个文件) | 高 | 同一内容在 plans/ 和 product-analysis/ 之间复制多次 |
| **STALE** | 35 篇 | 中 | 2 月底的 status 文档，距今 > 30 天未更新 |
| **TAG 不一致** | 1 组 | 中 | `AI-agent` vs `ai-agent` |
| **EMPTY 目录** | 3 个 | 低 | decisions/ meetings/ playbook/ 空壳 |
| **UNUSED** | 298 篇 | — | usage.json 刚启用，全部为 0，暂不作为依据 |
| **无 links** | 298 篇 | 中 | 文档间零链接关系 |
| **context 噪音** | 3 篇 | 中 | plan-3.md / base-info.md / raw_info.md 混在 context/ |

### 重复文档详细分析

**模式 A: plans 版本复制 (9 组)**
`lafe-2026-03-23-sp/analysis-workspace/` ↔ `lafe-2026-03-18-sp/analysis-workspace/`
整个 analysis-workspace 目录被完整复制到新日期文件夹。

**模式 B: plans ↔ product-analysis 交叉引用 (5 组)**
- `context/company.md` ↔ `plans/lafe-2026-03-03-huakai/company.md`
- `product-analysis/meowant/context/competitors/landscape.md` ↔ `plans/lafe-2026-03-18-sp/reference/landscape.md` ↔ `plans/lafe-2026-03-11-huakai/reference/meowant-context/competitors/landscape.md` (三份)
- `post-meeting-analysis.md` 三份分散在不同目录

**模式 C: 根目录散落 (2 组)**
- `goals.md` ↔ `plans/2026-03/goals.md` 完全相同

### 目录结构偏差分析

设计意图 vs 实际使用：

| 设计目录 | 设计用途 | 实际状态 | 问题 |
|----------|----------|----------|------|
| `context/` | reference — 公司信息、竞品 | 14 篇，大致正确，但混入 plan-3/base-info/raw_info | 有噪音 |
| `decisions/` | decision — 架构/产品/商业决策 | **0 篇，空目录** | 技术决策实际散落在 plans/ 里 |
| `experience/` | learning — 踩坑、最佳实践 | 1 篇 | 正确但太少 |
| `meetings/` | meeting — 会议纪要 | **0 篇，空目录** | 华凯会议纪要存在 plans/ 里 |
| `plans/` | status — YYYY-MM 月度计划 | **237 篇，严重膨胀** | 核心病灶 |
| `playbook/` | playbook — SOP、工作流 | **0 篇，空目录** | SOP 文件存在 plans/ 里 |
| `people/` | personal — 个人空间 | 6 篇 | 正确 |
| `product-analysis/` | **不在设计中** | 39 篇 | 设计外的目录 |
| `tools/` | **不在设计中** | HTML 工具(非文档) | 设计外的目录 |
| `goals.md` | **不在设计中** | 根目录散落文件 | 应在 plans/ 内 |
| `tasks.jsonl` | **不在设计中** | Linear 任务导出 | 不是知识文档 |

#### 核心病灶: plans/ 成了万物垃圾桶

plans/ 的设计意图是 `status` 类型 — **计划、进度、周报**，应该按 `YYYY-MM/` 分月组织。

但实际情况是 237 篇文档全部堆在 plans/ 里，且内容类型极度混杂:

| 实际内容类型 | 文件举例 | 应归属目录 | 估计数量 |
|-------------|---------|-----------|---------|
| **PRD/计划** (真正的 status) | `00-prd.md`, `01-prd.md`, `version-plan.md` | plans/ ✓ | ~25 |
| **调研分析** (reference) | `05-OSS-RESEARCH.md`, `09-MARKET-LANDSCAPE.md`, `fast-launch-analysis.md` | context/ | ~40 |
| **技术方案** (decision) | `技术方案-01-project建表方案.md`, `域名管理流程.md` | decisions/ | ~10 |
| **SOP/工作流** (playbook) | `02-puck-sop.md`, `linear-sop-final3.md`, `SKILL.md` | playbook/ | ~15 |
| **会议纪要** (meeting) | `post-meeting-analysis.md`, `03-内部会议纪要-交付思路.md` | meetings/ | ~5 |
| **SEO 参考** (reference) | `reference/seo-agent-master/**` (48 篇 skills/commands) | context/ 或 playbook/ | ~48 |
| **招聘** (无对应类型) | `lafe-2026-03-13-招聘/**` | playbook/ | ~6 |
| **分析工作区** (临时产物) | `analysis-workspace/**` | 归档或删除 | ~20 |
| **工作安排** (status) | `brief-1-cpo-product.md` | plans/ ✓ | ~10 |
| **其余** | 任务分解、模块设计等 | 按内容归类 | ~58 |

**另一个问题**: `lafe-` 前缀。24 个子目录中有 22 个用 `lafe-YYYY-MM-DD-主题` 命名，偏离了设计的 `YYYY-MM/` 月度结构。这导致每个工作日都新建目录，plans/ 变成按天的流水账。

#### product-analysis/ 的定位

`product-analysis/` 不在原始设计的 7 种类型映射中。当前只有 `meowant/` 一个客户。

**决策: 方案 A — 合并到主目录结构，用 `project: meowant` tag 区分。**

理由 (来自 review):
- 当前只有 1 个客户，独立目录增加了 inferType 适配成本
- 用 `project` 字段和 tag 过滤等价于目录隔离，但更灵活
- `sp search --project meowant` 和 `sp list plans --project meowant` 已支持

迁移方式:
- `product-analysis/meowant/context/` → `context/` (加 `project: meowant`)
- `product-analysis/meowant/lafe-2026-03-03-huakai/` → 按内容类型分散到 decisions/ playbook/ plans/ 等
- `product-analysis/meowant/plans/` → plans/ 或 playbook/ (按内容)

#### Frontmatter 覆盖率极低

298 篇文档中只有 **29 篇 (9.7%)** 有 frontmatter。其余 271 篇全靠 index-builder 的 `inferType()`（按文件路径关键词猜测）来判断类型。这意味着：

- type 全部是猜的 → 237 篇被推断为 status 仅因为在 plans/ 下
- 没有 tags → 无法筛选
- 没有 project → 无法按项目维度查看
- 没有 links/expires/status → 所有新功能都用不上

---

## 更新计划

### 执行顺序（修正后）

> **Review 指出的致命问题**: 原方案 Phase 4（建链接）在 Phase 5（迁移目录）之前。
> 如果先写入 links（target 是旧路径），然后迁移文件——所有链接全部断裂。
>
> **修正**: Phase 4+5 必须合并为一个原子操作。Agent 先确定目标路径，再基于新路径生成 links。

```
Phase 1: 去重清理           ← bash 批量, 单次 commit
Phase 2: Tag 标准化          ← bash sed, 单次 commit
Phase 3: 归档过期            ← bash 批量加 frontmatter, 单次 commit
   ↓ sp doctor 验证 ↓
Phase 4: Agent 分析 + 重整 + 链接 (原 Phase 4+5 合并)
  4a: 6 Agent 并行读文档 → 输出 JSON 迁移+链接方案
  4b: 人工 review JSON
  4c: bash 批量执行 (迁移 + 写 frontmatter + 写 links, 单次 commit)
   ↓ sp doctor + sp schema 验证 ↓
```

### Phase 1: 去重清理 [优先级: 最高]

> **Review 指出**: `sp delete` 每次都 git pull → 删文件 → writeIndex → commit → push。
> 23 次 delete = 23 次 pull+commit+push，耗时长且污染 git history。
>
> **修正**: 全部用 bash 批量删除 + 一次性 writeIndex + 单次 commit。

#### 1.1 批量删除重复文件

```bash
cd ~/sp-context

# 模式 A: lafe-2026-03-23-sp/analysis-workspace/ 是 lafe-2026-03-18-sp/ 的副本 (9 篇)
rm plans/lafe-2026-03-23-sp/analysis-workspace/00-data-inventory.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/01-data-insights.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/02-competitor-keyword-gap.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/03-action-plan.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/04-musk-review.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/05-traffic-pool-model.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/06-traffic-pool-gap-matrix.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/07-multi-model-audit.md
rm plans/lafe-2026-03-23-sp/analysis-workspace/08-final-one-pager.md

# 模式 B: plans/ 内的 reference 副本 (6 篇)
rm plans/lafe-2026-03-18-sp/reference/landscape.md
rm plans/lafe-2026-03-18-sp/reference/company.md
rm plans/lafe-2026-03-11-huakai/reference/meowant-context/competitors/landscape.md
rm plans/lafe-2026-03-11-huakai/reference/meowant-context/company.md
rm plans/lafe-2026-03-11-huakai/reference/huakai-0303/post-meeting-analysis.md
rm plans/lafe-2026-03-11-huakai/reference/huakai-0303/03-内部会议纪要-交付思路.md

# 模式 B: product-analysis 与 plans 交叉重复 (2 篇)
rm product-analysis/meowant/lafe-2026-03-03-huakai/01-华凯合作方案草稿.md
rm product-analysis/meowant/lafe-2026-03-03-huakai/post-meeting-analysis.md

# 模式 C: 副本 (2 篇)
rm plans/lafe-2026-03-03-huakai/company.md
rm goals.md

# context/ 噪音 (3 篇)
rm context/plan-3.md
rm context/base-info.md
rm context/raw_info.md

# 一次性重建 INDEX + 单次 commit
SP_CONTEXT_REPO=~/sp-context bun run /path/to/sp-context-plugin/src/index-builder.ts
git add -A && git commit -m "cleanup: remove 22 duplicate/noise files"
git push
```

**预期效果**: 298 → ~276 篇，消除全部 16 组重复 + 3 篇 context 噪音

### Phase 2: Tag 标准化 [优先级: 高]

```bash
cd ~/sp-context

# 批量替换 frontmatter 中的 tag 大小写
# 只有 29 篇有 frontmatter，其中涉及 tag 的更少
find . -name "*.md" -exec grep -l "AI-agent" {} \; | xargs sed -i '' 's/AI-agent/ai-agent/g'
find . -name "*.md" -exec grep -l "MCP" {} \; | xargs sed -i '' 's/MCP/mcp/g'
# 其余单次出现的 tag 在 Phase 4 补 frontmatter 时统一处理

# 一次性重建 INDEX + 单次 commit
SP_CONTEXT_REPO=~/sp-context bun run /path/to/sp-context-plugin/src/index-builder.ts
git add -A && git commit -m "fix: standardize tag casing to lowercase"
git push
```

### Phase 3: 归档过期文档 [优先级: 中]

35 篇 STALE 文档全部是 2 月底的 status 类型。批量添加 `status: archived` frontmatter。

```bash
cd ~/sp-context

# 对所有 2 月目录下的 .md 文件，如果没有 frontmatter 就加一个带 archived 的
# 如果已有 frontmatter 就插入 status: archived
for f in $(find plans/2026-02-* plans/lafe-2026-02-* -name "*.md" 2>/dev/null); do
  if head -1 "$f" | grep -q "^---"; then
    # 已有 frontmatter，插入 status
    sed -i '' '/^---$/a\
status: archived
' "$f"
  else
    # 无 frontmatter，添加最小 frontmatter
    title=$(head -1 "$f" | sed 's/^# //')
    tmpfile=$(mktemp)
    echo "---" > "$tmpfile"
    echo "status: archived" >> "$tmpfile"
    echo "---" >> "$tmpfile"
    echo "" >> "$tmpfile"
    cat "$f" >> "$tmpfile"
    mv "$tmpfile" "$f"
  fi
done

# 一次性重建 INDEX + 单次 commit
SP_CONTEXT_REPO=~/sp-context bun run /path/to/sp-context-plugin/src/index-builder.ts
git add -A && git commit -m "archive: mark 35 stale Feb docs as archived"
git push
```

```bash
# 验证 Phase 1-3
sp doctor   # 预期: 0 errors, ≤5 warnings, info 降低
```

### Phase 4: Agent 并行分析 + 目录重整 + 链接建立 [优先级: 高]

> 原方案的 Phase 4（链接）和 Phase 5（重整）合并为一个原子操作。
> 核心约束：**links 的 target 必须是迁移后的新路径**。

#### 4.1 执行流程

```
Step 1: 生成完整 INDEX 摘要 (path + title + summary)
   ↓ 注入每个 Agent 的上下文
Step 2: 6 个 Agent 并行，每个读一批文档全文
   ↓ 输出 JSON 方案（分类 + frontmatter + links）
Step 3: 汇总 JSON，去冲突检查
   ↓ 人工 review
Step 4: bash 批量执行（迁移 + 写 frontmatter，单次 commit）
   ↓ sp doctor + sp schema 验证
```

#### 4.2 Agent 分组

| Agent | 负责区域 | 文档数 |
|-------|----------|--------|
| Agent 1 | `context/` + `experience/` + `people/` | ~18 |
| Agent 2 | `plans/lafe-2026-03-09-sp/` (最大目录) | ~64 |
| Agent 3 | `plans/lafe-2026-03-02-web/` + `plans/lafe-2026-03-23-sp/` | ~49 |
| Agent 4 | `plans/lafe-2026-03-18-sp/` + `plans/lafe-2026-03-19/` + `plans/lafe-2026-03-20~24-*` | ~42 |
| Agent 5 | `plans/lafe-2026-02-*` + `plans/2026-02-*` + `plans/2026-03/` + 其余 03-03~03-17 目录 | ~65 |
| Agent 6 | `product-analysis/` (全部) | ~37 |

#### 4.3 每个 Agent 的输入

1. **本区域文档全文** — 逐篇读取
2. **完整 INDEX 摘要** (全部 ~276 篇的 path + title + summary) — 用于跨区域链接匹配

> **Review 指出**: Agent 按区域分工但链接跨区域。注入 INDEX 摘要解决此问题——
> Agent 虽然只读本区域全文，但能匹配全知识库的文档标题和摘要。

#### 4.4 每个 Agent 的输出

对每篇文档输出一个 JSON 对象：

```json
{
  "source_path": "plans/lafe-2026-03-23-sp/05-OSS-RESEARCH.md",
  "analysis": {
    "actual_type": "reference",
    "evidence": "内容是开源项目选型调研报告，覆盖 Puck/Payload/Builder.io 等 8 个项目的横向对比",
    "target_dir": "context",
    "target_filename": "2026-03-23-oss-research.md",
    "project": "openstore",
    "tags": ["tech-research", "open-source", "puck", "payload"]
  },
  "frontmatter": {
    "title": "开源项目选型调研汇总",
    "type": "reference",
    "project": "openstore",
    "date": "2026-03-23",
    "tags": ["tech-research", "open-source", "puck", "payload"]
  },
  "links": [
    {
      "type": "based-on",
      "target": "context/feature-spec.md",
      "evidence": "文档第 3 节引用了 feature-spec 中的「可视化编辑器」模块需求"
    },
    {
      "type": "related",
      "target": "context/2026-03-23-building-blocks.md",
      "evidence": "两篇都分析了 Puck 编辑器，本文侧重选型，对方侧重集成架构"
    }
  ]
}
```

关键点:
- `target_dir` + `target_filename` = 迁移后的新路径
- `links.target` 使用**迁移后的路径**（Agent 可参考同批次其他文档的 target 来确定）
- 每条 link 必须有 `evidence` 说明事实依据

#### 4.5 链接判断标准

| 证据类型 | 示例 | 链接类型 |
|----------|------|----------|
| **直接引用** | "参见 company.md 中的定位" | based-on |
| **数据依赖** | 文档中的表格数据来自另一篇分析 | based-on |
| **概念传递** | A 文档定义的概念在 B 文档中被使用 | based-on |
| **结论驱动** | A 的分析结论成为 B 的输入前提 | A leads-to B |
| **主题重叠** | 两篇文档分析同一竞品的不同维度 | related |
| **时间演进** | B 是 A 的更新版或迭代版 | B based-on A |

**不建链的情况**：
- 仅因在同一目录 → 不够
- 仅因标题相似 → 不够
- 无法在内容中找到具体引用点 → 不建

#### 4.6 文件名冲突处理

> **Review 指出**: 多个 `lafe-*/` 下的 `00-prd.md` 迁移到 `plans/2026-03/` 时会冲突。

规则: `target_filename` 必须加日期+主题前缀去冲突：

```
plans/lafe-2026-03-09-sp/00-prd-init.md    → plans/2026-03/prd-2026-03-09-sp.md
plans/lafe-2026-03-23-sp/01-prd.md         → plans/2026-03/prd-2026-03-23-sp.md
plans/lafe-2026-03-03-huakai/00-prd.md     → plans/2026-03/prd-2026-03-03-huakai.md
```

Agent 生成 target_filename 时自动带上日期和主题段。汇总阶段做全局去冲突检查。

#### 4.7 product-analysis/ 迁移规则

合并到主目录结构，用 `project: meowant` 字段区分：

```
product-analysis/meowant/context/company.md     → context/meowant-company.md     (project: meowant)
product-analysis/meowant/context/arsenal.md     → context/meowant-arsenal.md     (project: meowant)
product-analysis/meowant/context/competitors/   → context/competitors/meowant-*  (project: meowant)
product-analysis/meowant/lafe-2026-03-03-huakai/* → 按内容分类到 decisions/ playbook/ plans/ (project: meowant)
product-analysis/meowant/plans/*                → plans/ 或 playbook/ (project: meowant)
```

#### 4.8 plans/ 目录结构规范化

迁移后 plans/ 恢复 `YYYY-MM/` 月度结构:

```
plans/
  ├── 2026-02/            # 2 月 status 文档 (大部分 archived)
  ├── 2026-03/            # 3 月 status 文档
  │   ├── version-plan.md
  │   ├── goals.md
  │   ├── prd-2026-03-09-sp.md
  │   ├── prd-2026-03-23-sp.md
  │   ├── prd-2026-03-03-huakai.md
  │   └── ...
  └── ...
```

#### 4.9 个人空间结构

people/ 按用途分子目录:

```
people/qiuyanxin/
  ├── research/     # 技术/工具调研 (当前 6 篇全在这)
  ├── drafts/       # 草稿，可能晋升到共享空间
  └── notes/        # 临时笔记 (配合 --ttl)
```

`sp push --type personal --category research` 已支持 (v1.1.0)。

#### 4.10 批量执行

Agent 输出汇总为 `migration-plan.json` 后：

```bash
cd ~/sp-context

# 1. 创建目标目录
mkdir -p decisions meetings/2026/03 playbook

# 2. 批量迁移文件 + 写入 frontmatter (从 migration-plan.json 驱动)
# 用脚本读取 JSON，对每篇文档:
#   a. 如果需要迁移 → mv source target
#   b. 写入/替换 frontmatter (title, type, project, date, tags, links)

# 3. 一次性重建 INDEX
SP_CONTEXT_REPO=~/sp-context bun run /path/to/sp-context-plugin/src/index-builder.ts

# 4. 单次 commit
git add -A && git commit -m "restructure: reorganize 275 docs by type, add frontmatter and links"
git push
```

#### 4.11 预期迁移分布

| 目标目录 | 预计数量 | 来源 |
|----------|---------|------|
| plans/ (YYYY-MM/) | ~80 | 原 plans/ 中真正的 PRD/计划/任务 |
| context/ | ~60 | 原 plans/ 调研 + product-analysis/context/ |
| decisions/ | ~15 | 原 plans/ 技术方案 |
| playbook/ | ~20 | 原 plans/ SOP + product-analysis/ playbook |
| meetings/ | ~5 | 原 plans/ 会议纪要 |
| experience/ | ~5 | 原 plans/ 踩坑记录 |
| people/ | ~6 | 不变 |
| 归档/已删 | ~85 | Phase 1 删除 + Phase 3 归档 |

---

## 需要新增的 Plugin 能力

> Review 指出当前 plugin 缺少批量操作和 frontmatter 更新能力。

### 已确认需要的新命令/增强

| 能力 | 当前状态 | 需要 | 用途 |
|------|----------|------|------|
| Frontmatter 更新 | 无 `sp update/patch` | 新增 `sp patch` 命令 | Phase 2/3 批量改 frontmatter |
| 批量操作 | `sp delete/move` 每次 commit | 加 `--no-commit` flag | Phase 1/4 攒一批再 commit |
| Doctor 归档豁免 | BROKEN_LINK 不豁免 archived | 修复 | 归档文档的 link target 不报 BROKEN |
| 解归档 | 无 | `sp unarchive <path>` 或 `sp patch --status active` | 误归档恢复 |

---

## 预期质量指标

| 指标 | 当前 | Phase 1-3 后 | Phase 4 后 |
|------|------|-------------|-----------|
| 文档总数 | 298 | ~276 | ~276 |
| 重复组数 | 16 | 0 | 0 |
| 过期未归档 | 35 | 0 | 0 |
| Tag 不一致 | 1 | 0 | 0 |
| 有 frontmatter | 29 (9.7%) | ~64 | **~276 (100%)** |
| Type 准确率 | ~10% (全靠推断) | ~10% | **100% (Agent 验证)** |
| 文档在正确目录 | ~30% | ~30% | **~95%** |
| 有 links 的文档 | 0 | 0 | **~170-220 (60-80%)** |
| plans/ 文档数 | 237 | ~214 | **~80** |
| Doctor errors | 16 | 0 | 0 |
| Doctor warnings | 36 | 0 | 0 |
| 质量分 | ~6/10 | 8/10 | **9.5/10** |

---

## 执行方式总结

| Phase | 操作方式 | Git commits | 验证 |
|-------|----------|-------------|------|
| 1 | bash `rm` 批量删除 + 一次 writeIndex | **1 次** | `sp doctor` errors 归零 |
| 2 | bash `sed` 批量替换 tag | **1 次** | `sp schema` tags 无重复 |
| 3 | bash 批量加 `status: archived` | **1 次** | `sp doctor` warnings 降低 |
| 4 | 6 Agent 并行 → JSON → review → bash 批量迁移 | **1 次** | `sp doctor` + `sp schema` 全绿 |

总计 **4 次 git commit**，不污染 history。

```bash
# 最终验证
sp doctor          # 0 errors, 0 warnings
sp schema          # by_type: {status: ~80, reference: ~60, decision: ~15, playbook: ~20, ...}
                   # tags: 均匀分布，无大小写重复
                   # total: ~276
```
