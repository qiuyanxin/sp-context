# CLI vs MCP：sp-context-plugin 项目架构评估

> 调研时间：2026-03-14
> 背景：2026 Q1 行业出现 "CLI 替代 MCP" 趋势，本文结合行业动态与 sp-context-plugin 实际架构，进行多维度对比评估。

---

## 一、行业趋势概述

### 1.1 关键信号

| 事件 | 时间 | 影响 |
|------|------|------|
| Perplexity CTO Denis Yarats 宣布内部弃用 MCP，转向 API + CLI | 2026-02 | 头部 AI 公司公开质疑 MCP |
| Y Combinator CEO Garry Tan 自建 CLI 替代 MCP | 2026-02 | "可靠性和速度是决定因素" |
| "CLI is the New MCP" 登上 Hacker News 头条 (85 points, 66 comments) | 2026-02 | 开发者社区广泛讨论 |
| Scalekit 发布 MCP vs CLI 基准测试 (开源) | 2026-03 | 数据驱动的对比首次公开 |
| Claude Code / Cowork 采用混合架构 (CLI + MCP + Skills) | 持续 | 头部产品验证混合路线 |
| MCP SDK 月下载量达 9700 万+ | 持续 | 企业级采用仍在增长 |

### 1.2 核心论点

**CLI 派（"回归 Unix 哲学"）：**
- LLM 训练数据中包含数十亿条终端交互，模型天然理解 CLI
- MCP 的 Schema 注入是 "context hog"（上下文吞噬者）
- 已有成熟 CLI 工具覆盖主流服务（gh, aws, kubectl, docker...）
- 管道组合（pipe composition）比结构化协议更灵活

**MCP 派（"企业级治理"）：**
- 动态工具发现（runtime tool discovery）是 CLI 无法替代的
- OAuth 2.1 + PKCE 多租户认证是刚需
- 结构化审计日志满足合规要求
- 非技术用户友好

**共识（混合派）：**
> "最聪明的团队在 2026 年不是选边站，而是构建利用 CLI 效率处理开发工作流、用 MCP 处理客户面向和合规功能的架构。" — Manveer Choudhary

---

## 二、基准数据对比

### 2.1 Token 消耗（Scalekit 基准，GitHub 任务）

| 任务 | CLI | MCP | MCP/CLI 倍数 |
|------|-----|-----|-------------|
| 查询仓库语言和许可证 | 1,365 | 44,026 | **32x** |
| 获取 PR 详情和审查状态 | 1,648 | 32,279 | **20x** |
| 仓库元数据和安装方式 | 9,386 | 82,835 | **9x** |
| 按贡献者统计合并的 PR | 5,010 | 33,712 | **7x** |
| 最新发布和依赖 | 8,750 | 37,402 | **4x** |

**根本原因：** MCP 在每次会话初始化时注入全部 43 个工具的 Schema 定义，无论实际使用多少。GitHub MCP Server 的 93 个工具消耗约 **55,000 tokens**（GPT-4o 上下文窗口的一半）。

### 2.2 可靠性

| 指标 | CLI | MCP |
|------|-----|-----|
| 成功率 | **100%** (25/25) | **72%** (18/25) |
| 失败原因 | — | TCP 超时（远程 MCP 服务器未响应） |

### 2.3 月度成本估算（10,000 次操作，Claude Sonnet 4 定价）

| 方案 | 月成本 | 倍数 |
|------|--------|------|
| CLI | ~$3.20 | 1x |
| MCP (直连) | ~$55.20 | **17x** |
| MCP (网关过滤) | ~$5.00 | 1.6x |

### 2.4 Intune 合规任务实测（Jannik Reinhard）

| 方案 | Token 消耗 | 剩余推理空间 (128K) |
|------|-----------|-------------------|
| CLI | ~4,150 | **121,300** (95%) |
| MCP | ~145,000 | 82,300 (64%) |
| 效率差距 | — | **35x** |

---

## 三、sp-context-plugin 现状分析

### 3.1 当前架构

sp-context-plugin 是一个 **MCP-first** 的团队知识库管理系统：

```
┌─────────────────────────────────────────────────┐
│              sp-context-plugin                   │
├──────────────┬──────────────────────────────────-┤
│  传输层       │  stdio (本地) + HTTP (远程)        │
│  协议        │  MCP (Model Context Protocol)      │
│  工具数量     │  8 个 (search/get/list/push/sync..) │
│  运行时      │  Bun + TypeScript                   │
│  数据存储     │  Git 仓库 (markdown + INDEX.json)   │
└──────────────┴────────────────────────────────────┘
```

### 3.2 已暴露的 8 个 MCP 工具

| 工具 | 功能 | 估算 Schema Token 数 |
|------|------|---------------------|
| `sp_search` | BM25 + CJK 全文搜索 | ~800 |
| `sp_get` | 读取文档全文 | ~200 |
| `sp_list` | 按目录浏览 | ~300 |
| `sp_push` | 写入文档 + 去重 + git push | ~600 |
| `sp_sync` | 拉取远程 + 重建索引 | ~150 |
| `sp_import` | 从 claude-mem 导入 | ~400 |
| `sp_init` | 初始化 sp-context 仓库 | ~300 |
| `sp_config_repos` | 多仓库管理 | ~400 |
| **合计** | | **~3,150 tokens** |

### 3.3 已有的 CLI 元素

项目并非纯 MCP，已存在部分 CLI 模式：

- **`index-builder.ts`** — 可独立执行的索引重建脚本
- **`session-start.sh`** — SessionStart Hook，注入轻量目录（~114 tokens）
- **`session-stop.sh`** — 会话结束提醒
- 但**没有用户可直接调用的 CLI 命令行工具**

---

## 四、多维度对比评估

### 4.1 Token 效率

| 维度 | MCP (当前) | CLI (假设) | 评估 |
|------|-----------|-----------|------|
| Schema 注入成本 | ~3,150 tokens（8 工具） | ~0（LLM 已知 CLI 模式） | **CLI 优** |
| 单次调用成本 | 结构化请求 + 响应 | 命令 + stdout | 基本持平 |
| 渐进加载 (Tier 0/1/2) | 已实现，效果好 | 可通过 --help 实现 | MCP 略优（更精细控制） |

**评价：** sp-context-plugin 的 8 个工具仅消耗 ~3,150 tokens，远低于 GitHub MCP 的 55,000。渐进加载设计已有效缓解了 MCP 的 "context hog" 问题。**MCP 的 token 劣势在本项目中不显著。**

### 4.2 可靠性

| 维度 | MCP (当前) | CLI (假设) | 评估 |
|------|-----------|-----------|------|
| stdio 本地连接 | 进程间通信，高可靠 | 同样本地执行 | 持平 |
| HTTP 远程连接 | TCP 超时风险 | 无网络依赖 (本地 git) | **CLI 优** |
| 错误处理 | 结构化错误码 | exit code + stderr | MCP 略优 |
| 状态管理 | 会话级管理 | 无状态（每次独立） | 场景依赖 |

**评价：** stdio 模式下两者可靠性相当。HTTP 远程模式下 MCP 确实存在 TCP 超时风险，但这正是项目提供双传输层的原因。

### 4.3 开发与维护成本

| 维度 | MCP (当前) | CLI (假设) | 评估 |
|------|-----------|-----------|------|
| 新工具开发 | 需定义 Schema + Handler | 实现命令 + --help | **CLI 更简单** |
| SDK 依赖 | @modelcontextprotocol/sdk | 无额外依赖 | **CLI 优** |
| 协议版本兼容 | 需跟进 MCP 规范变化 | 自定义，无外部依赖 | **CLI 优** |
| 跨平台兼容 | SDK 处理 | 需自行处理 shell 差异 | **MCP 优** |
| 类型安全 | Schema 强类型 | 需额外解析和验证 | **MCP 优** |

### 4.4 团队协作与多租户

| 维度 | MCP (当前) | CLI (假设) | 评估 |
|------|-----------|-----------|------|
| 远程共享服务 | HTTP 传输 + API Key 认证 | 需自建 HTTP 服务 | **MCP 优** |
| 多用户认证 | MCP 协议原生支持 | 需手动实现 | **MCP 优** |
| GitHub Webhook 集成 | 已实现（Express 服务） | 需额外实现 | MCP 架构更自然 |
| 审计日志 | JSON-RPC 结构便于记录 | 需手动添加 | **MCP 优** |

### 4.5 AI Agent 集成

| 维度 | MCP (当前) | CLI (假设) | 评估 |
|------|-----------|-----------|------|
| Claude Code 集成 | 原生 .mcp.json 配置 | Bash 工具调用 | **MCP 原生更优** |
| 其他 LLM 支持 | MCP 已被 OpenAI/Google/MS 采纳 | 所有 LLM 都能调 CLI | **CLI 更通用** |
| 工具发现 | 动态 Schema 暴露 | 依赖 --help 或文档 | **MCP 优** |
| 参数验证 | Schema 验证 + 结构化错误 | 运行时才发现错误 | **MCP 优** |
| 组合能力 | 单工具调用 | 管道组合 (pipe) | **CLI 优** |

### 4.6 安全性

| 维度 | MCP (当前) | CLI (假设) | 评估 |
|------|-----------|-----------|------|
| 权限边界 | 工具级别显式声明 | 环境变量 / 文件系统权限 | **MCP 优** |
| 凭证管理 | 服务端管理 | 依赖本地环境配置 | **MCP 优（远程）** |
| 注入风险 | 结构化输入降低风险 | 命令注入是已知威胁 | **MCP 优** |
| 审计追踪 | JSON-RPC 天然可记录 | 需封装 wrapper | **MCP 优** |

### 4.7 生态与未来

| 维度 | MCP | CLI | 评估 |
|------|-----|-----|------|
| 行业采纳 | Anthropic/OpenAI/Google/MS 支持 | 50+ 年 Unix 传统 | 各有基础 |
| 月下载量 | 9700 万+ (SDK) | 不可计量 | MCP 增长快 |
| 社区情绪 | 分化（生产环境质疑声增加） | 回归呼声高涨 | 观望 |
| 长期趋势 | 可能走向网关过滤 + 按需加载 | 可能标准化工具协议 | 融合 |

---

## 五、sp-context-plugin 特殊考量

### 5.1 本项目为何 MCP 痛点不明显

1. **工具数少（8个 vs GitHub 的 93 个）**—Schema 注入仅 ~3,150 tokens，远低于行业痛点阈值
2. **渐进加载已实现**—Tier 0/1/2 机制从 114 tokens 起步，按需扩展
3. **双传输已实现**—stdio (无网络开销) + HTTP (团队共享)，可靠性已对冲
4. **Git 为数据源**—不依赖第三方 API，不存在 OAuth 复杂度

### 5.2 本项目假设转 CLI 的改造评估

如果将 8 个 MCP 工具改为 CLI 命令：

```bash
# 假设 CLI 版本
sp search "支付 Stripe" --type decision --limit 10
sp get context/arsenal.md
sp list plans/
sp push --title "Tech Decision" --type decision --tags "arch,db"
sp sync
sp import --query "auth" --limit 5
sp init ~/new-sp-context
sp config repos list
```

**改造成本估算：**

| 项目 | 工作量 | 难度 |
|------|--------|------|
| CLI 框架搭建（commander.js / yargs） | 1-2 天 | 低 |
| 8 个命令实现（复用现有 tools/） | 2-3 天 | 低 |
| JSON 输出格式设计 | 0.5 天 | 低 |
| 远程共享方案重建（替代 HTTP 传输） | 3-5 天 | 中 |
| 认证与权限管理 | 2-3 天 | 中 |
| 测试与文档 | 1-2 天 | 低 |
| **合计** | **10-16 天** | — |

**收益分析：**

| 收益 | 量化 | 值得吗？ |
|------|------|----------|
| Token 节省 | ~3,150 → ~0（省约 3K tokens） | 收益微小 |
| 去除 MCP SDK 依赖 | 减少 1 个依赖 | 边际收益 |
| 组合能力增强 | `sp search "x" \| sp get` | 有价值但非刚需 |
| 其他 LLM 兼容性 | 任何能调 Bash 的 Agent 都可用 | **有价值** |

### 5.3 推荐策略：混合渐进方案

不建议全面弃 MCP，也不建议维持纯 MCP。推荐 **CLI + MCP 并存，渐进增强**：

```
Phase 1 (立即可做): 添加 CLI 入口
├── 复用 tools/ 已有逻辑
├── 添加 bin/sp CLI 入口
├── 支持 sp search / sp get / sp list / sp push
└── 保留 MCP 不变

Phase 2 (按需): 轻量 CLI Manifest
├── 创建 sp.md (~100 tokens) 供 Agent 参考
├── Claude Code 中通过 Bash 直接调用
└── 对比 Token 消耗实测

Phase 3 (视团队规模): 评估远程 CLI 方案
├── 如团队 > 5 人，保留 MCP HTTP
├── 如团队 < 5 人，考虑 SSH + CLI
└── 混合：MCP 做工具发现，CLI 做执行
```

---

## 六、决策矩阵

| 场景 | 推荐 | 理由 |
|------|------|------|
| 个人开发者本地使用 | **CLI 优先** | 零 Schema 开销，LLM 天然理解 |
| 2-5 人小团队 | **MCP stdio + CLI 并存** | MCP 低开销(8工具)，CLI 做管道组合 |
| 5+ 人团队远程协作 | **MCP HTTP** | 认证、审计、Webhook 是刚需 |
| 需要跨 LLM 平台兼容 | **CLI 优先** | 所有 Agent 都能调 Bash |
| 合规/审计要求 | **MCP** | JSON-RPC 结构化日志 |
| 追求最低 Token 消耗 | **CLI** | 零 Schema 注入 |

---

## 七、结论

### 本项目特殊性

sp-context-plugin **不是行业批评 MCP 的典型案例**。它的 8 个工具、~3,150 tokens Schema、渐进加载设计，已经规避了 MCP 最大的痛点（Schema 膨胀）。行业中被批评的主要是 GitHub MCP (93 工具/55K tokens) 这类重量级 Server。

### 建议

1. **短期（保持 MCP）**：当前架构设计良好，无需重构。8 个精简工具的 MCP 方案已接近 CLI 效率
2. **中期（添加 CLI 入口）**：为 `sp search`、`sp get` 等核心命令添加 CLI wrapper，提升跨平台兼容性和管道组合能力
3. **长期（关注行业走向）**：如果 MCP 协议走向网关过滤 + 按需加载（2026 Roadmap 已提及），本项目天然适配；如果 CLI 标准化工具协议出现，再评估迁移

### 一句话总结

> **对 sp-context-plugin 而言，MCP 的缺点（Schema 膨胀）已通过精简设计规避，MCP 的优点（类型安全、远程协作、工具发现）仍在发挥价值。最佳策略是在保留 MCP 的基础上，增加 CLI 入口作为补充，而非替代。**

---

## 参考来源

- [Why CLI Tools Are Beating MCP for AI Agents](https://jannikreinhard.com/2026/02/22/why-cli-tools-are-beating-mcp-for-ai-agents/) — Jannik Reinhard, 2026-02
- [MCP vs CLI: Benchmarking AI Agent Cost & Reliability](https://www.scalekit.com/blog/mcp-vs-cli-use) — Scalekit, 2026-03
- [MCP vs. CLI for AI agents: Decision Framework](https://manveerc.substack.com/p/mcp-vs-cli-ai-agents) — Manveer Choudhary, 2026
- [Why CLI is the New MCP for AI Agents](https://oneuptime.com/blog/post/2026-02-03-cli-is-the-new-mcp/view) — OneUptime, 2026-02
- [Perplexity CTO Moves Away from MCP](https://awesomeagents.ai/news/perplexity-agent-api-mcp-shift/) — Awesome Agents, 2026-02
- [Perplexity Is Ditching MCP for APIs and CLIs](https://www.junia.ai/blog/perplexity-mcp-vs-apis-ai-agents) — Junia AI, 2026
- [Why the MCP Standard Might Quietly Fade Away](https://medium.com/@denisuraev/why-the-mcp-standard-might-quietly-fade-away-012097caaa85) — Denis Urayev, 2026-01
- [CLI-Based Agents vs MCP: The 2026 Showdown](https://lalatenduswain.medium.com/cli-based-agents-vs-mcp-the-2026-showdown-that-every-ai-engineer-needs-to-understand-7dfbc9e3e1f9) — Lalatendu Swain, 2026-03
- [5 Key Trends Shaping Agentic Development in 2026](https://thenewstack.io/5-key-trends-shaping-agentic-development-in-2026/) — The New Stack
- [Claude Code vs OpenAI Codex: Architecture Guide 2026](https://dev.to/shehzan/claude-code-vs-openai-codex-architecture-guide-2026-l9c) — DEV Community
