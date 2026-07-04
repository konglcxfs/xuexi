# 📚 xuexi 学习引擎

> **一个为小学生和软考生统一设计的自适应学习平台**
>
> 这不是一个简单的题库或对话机器人，它是一个"统一学习引擎"：底层一致，
> 上面承载不同的角色知识库、不同的 AI 风格、不同的学习目标。

## 🎯 解决了什么问题？

| 你已经踩过的坑 | xuexi 怎么解 |
|---|---|
| 制定学习计划总是半途而废 | **计划生成器**根据知识图谱依赖 + 遗忘曲线 + 薄弱点自动产多日计划，按天切片、可执行 |
| 找不到自己的薄弱点 | **薄弱点诊断器**跑规则层 + AI 二轮诊断，告诉你"为什么薄弱 + 怎么补"，还能识别跨知识点共同根因 |
| 学过的知识容易忘 | **Mastery Engine**（简化 SuperMemo/EB 遗忘曲线）记录每次练习的掌握度，自动计算下次最佳复习时间 |
| 知识点之间断片、看不出联系 | **知识串联模块**+ **交互式图谱可视化**把知识点之间的"前置 / 类比 / 延伸"画清楚 |
| AI 不会针对孩子 / 不会针对大人 | **角色适配层**根据 `primary_school` / `ruankao` 切换 prompt 风格、深度、激励语 |

## 🏗 架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                          学习引擎（核心）                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │  知识图谱     │ │  Mastery     │ │  薄弱点诊断   │ │  计划生成器   │ │
│  │  + 拓扑序    │ │  遗忘曲线    │ │  规则 + LLM   │ │  依赖 + 复习 │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
│  ┌──────────────┐ ┌──────────────┐                                    │
│  │  知识串联     │ │  长期记忆     │                                    │
│  │  桥接推荐    │ │  提炼 + 召回  │                                    │
│  └──────────────┘ └──────────────┘                                    │
└────────────────────────────────────────────────────────────────────────┘
                                  ↑
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  小学生知识库   │         │  软考知识库     │         │  其他角色      │
│  四年级数学     │         │  软件设计师     │         │  （待扩展）    │
└───────────────┘         └───────────────┘         └───────────────┘
                                  ↑
┌────────────────────────────────────────────────────────────────────┐
│                       AI 适配层                                     │
│   - PromptBuilder：按角色 / 知识点 / 记忆 / 薄弱点动态拼装 prompt    │
│   - Provider：OpenAI 兼容协议 → DeepSeek/通义/Ollama/OpenAI/Anthropic│
│   - LocalStub：无 API key 时也能完整跑通                            │
└────────────────────────────────────────────────────────────────────┘
                                  ↑
┌────────────────────────────────────────────────────────────────────┐
│          Fastify API                 │    React + Vite Web        │
│  /api/users, /api/graph, ...         │  仪表盘/薄弱点/计划/对话/图谱  │
└────────────────────────────────────────────────────────────────────┘
                                  ↑
┌────────────────────────────────────────────────────────────────────┐
│      SQLite（node:sqlite 内置，零依赖）或 Postgres (docker)        │
└────────────────────────────────────────────────────────────────────┘
```

## 📁 目录结构

```
xuexi/
├── apps/
│   ├── api/                  # Fastify 后端
│   │   ├── src/
│   │   │   ├── db/           # SQLite schema + repo
│   │   │   ├── routes.ts     # REST endpoints
│   │   │   ├── engine.ts     # 引擎运行时（graph/diagnostics/plan/linker/ai）
│   │   │   ├── smoke.ts      # 后端端到端冒烟脚本
│   │   │   └── index.ts      # bootstrap
│   │   └── data/xuexi.sqlite
│   └── web/                  # React + Vite 前端
│       ├── src/
│       │   ├── api.ts        # API 客户端
│       │   ├── auth.tsx      # 上下文
│       │   ├── App.tsx       # 路由 + Layout
│       │   └── pages/
│       │       ├── LoginPage.tsx       # 角色选择 / 登录
│       │       ├── DashboardPage.tsx   # 仪表盘
│       │       ├── WeaknessPage.tsx    # 薄弱点报告
│       │       ├── PlanPage.tsx        # 计划视图 + 今日任务
│       │       ├── ChatPage.tsx        # AI 对话
│       │       └── GraphPage.tsx       # 知识图谱可视化
│       └── scripts/ui-smoke.ts          # Chrome DevTools Protocol UI 测试
├── packages/
│   ├── shared/               # TypeScript 类型契约
│   ├── learning-engine/      # 5 个核心引擎
│   │   ├── knowledge-graph.ts
│   │   ├── mastery-engine.ts
│   │   ├── weakness-diagnostics.ts
│   │   ├── plan-generator.ts
│   │   └── knowledge-linker.ts
│   ├── ai-adapter/           # PromptBuilder + Provider 抽象
│   │   ├── prompt-builder.ts
│   │   ├── types.ts
│   │   └── index.ts          # OpenAI 兼容 / LocalStub
│   └── knowledge-base/       # 角色知识库
│       ├── primary-math-grade4.ts
│       ├── ruankao-softmid.ts
│       └── index.ts
├── docker-compose.yml        # 可选 Postgres
└── package.json              # pnpm workspace
```

## 🚀 本地启动（30 秒）

### 1. 准备

- Node ≥ 20（建议 22+，自带 `node:sqlite`）
- pnpm ≥ 9：`npm i -g pnpm`

### 2. 安装

```bash
cd xuexi
pnpm install
```

### 3. 起 API（自动建表 + 灌知识库）

```bash
# 一次性建表 + 灌知识库（默认 SQLite 文件在 apps/api/data/xuexi.sqlite）
pnpm --filter @xuexi/api run db:migrate

# 启动 API
pnpm --filter @xuexi/api run dev
# 看到 🚀 xuexi api listening on http://localhost:4310
```

### 4. 起前端

```bash
pnpm --filter @xuexi/web run dev
# 打开 http://localhost:5173
```

### 5. (可选) 接入 AI

环境变量（不需要的话，AI 会用本地 stub，也能完整测试全链路）：

```bash
export XUEXI_AI_API_KEY="sk-..."                       # 必需
export XUEXI_AI_BASE_URL="https://api.deepseek.com/v1"  # 兼容 OpenAI 的都可
export XUEXI_AI_MODEL="deepseek-chat"
```

支持的国内大模型（任选其一）：
- DeepSeek：`https://api.deepseek.com/v1`，`deepseek-chat`
- 通义千问：`https://dashscope.aliyuncs.com/compatible-mode/v1`，`qwen-plus`
- Ollama（本地）：`http://localhost:11434/v1`，`qwen2.5:7b`、`deepseek-r1:7b` 等
- Moonshot：`https://api.moonshot.cn/v1`，`moonshot-v1-8k`

### 6. (可选) Postgres

如果想用 Postgres 而非 SQLite：

```bash
docker compose up -d postgres
# 改 apps/api/src/db/index.ts 的连接方式
```

docker-compose 仅提供 Postgres，**不是启动 API 必须的**。

## 🧪 验证全链路

```bash
# 后端冒烟（不需要浏览器）
pnpm --filter @xuexi/api run smoke

# 前端 UI 测试（需 Chrome，会在 apps/web/artifacts/ 产截图）
pnpm --filter @xuexi/web run ui:smoke
```

## 🛣 API 速查

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/users` | 创建用户（角色 / 昵称） |
| `GET`  | `/api/users/:id` | 获取用户 |
| `GET`  | `/api/graph/:role` | 知识图谱（primary_school / ruankao） |
| `GET`  | `/api/graph/:role/topological` | 拓扑序 |
| `GET`  | `/api/mastery/:userId` | 所有掌握度 |
| `POST` | `/api/evidence` | 提交一条练习结果（更新掌握度） |
| `GET`  | `/api/weakness/:userId/latest` | 最近一次诊断报告 |
| `POST` | `/api/weakness/run/:userId` | 触发一次新诊断 |
| `POST` | `/api/plans` | 生成学习计划 |
| `GET`  | `/api/plans/:userId` | 列出用户所有计划 |
| `POST` | `/api/chat` | 发送一条 AI 对话 |
| `GET`  | `/api/chat/sessions/:userId` | 列出历史会话 |
| `GET`  | `/api/links/:userId/:kpId` | 该知识点上的串联推荐 |
| `GET`  | `/api/memory/:userId` | 该用户长期记忆 |
| `GET`  | `/api/dashboard/:userId` | 仪表盘汇总 |

## 🧬 核心算法速查

### Mastery Engine
简化版 SuperMemo-2 + Ebbinghaus 衰减。每次新 evidence 调整 mastery ∈ [0,1]、stability ∈ [0.5, ∞) 天；
距离上次复习越久，掌握度按 `0.7^(elapsedDays/stability)` 衰减。

### Weakness Diagnostics
两层：
- **规则层**：根据最近 10 题的对错 + 不同维度得分 + 知识依赖关系，推断 4 类根因（前置缺失 / 概念不清 / 练习不够 / 已遗忘）。
- **AI 层**：把 evidence 喂给 AI，让它给出更精细的"为什么薄弱 + 怎么补"。

### Plan Generator
三优先级叠加：复习（按稳定性升序）> 弱项补强（按掌握度升序）> 新内容（按拓扑序）。
把任务按"每天 ≤ 用户设定分钟、≤ N 个任务"切片。绝不破坏前置依赖。

### Knowledge Linker
三类连接：直接前置（覆盖全图）/ 反向依赖（下一步该学什么）/ 共享前置的类比题（同思路可迁移）。

## ⚙ 配置

环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `XUEXI_DB_FILE` | `apps/api/data/xuexi.sqlite` | SQLite 路径 |
| `XUEXI_API_PORT` | `4310` | API 端口 |
| `XUEXI_AI_API_KEY` | _(unset → local stub)_ | AI key |
| `XUEXI_AI_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容 base URL |
| `XUEXI_AI_MODEL` | `deepseek-chat` | 模型名 |

## 🧱 扩展自己的知识库

```typescript
// packages/knowledge-base/src/primary-chinese-grade4.ts
import type { KnowledgePoint } from '@xuexi/shared'

const GRAPH = 'primary-chinese-grade4-up'

function kp(args: {
  code: string; title: string; description: string
  prerequisites?: string[]; tags?: string[]
}): KnowledgePoint {
  return {
    id: `primary_school:${GRAPH}:${args.code}`,
    role: 'primary_school', graph: GRAPH, code: args.code,
    title: args.title, description: args.description,
    prerequisites: (args.prerequisites ?? []).map((c) => `primary_school:${GRAPH}:${c}`),
    difficulty: 0.5, tags: args.tags ?? [],
    mastery: { explain: 0.7, apply: 0.65, extend: 0.4 },
  }
}

export const PRIMARY_CHINESE_GRADE4_UP: KnowledgePoint[] = [
  kp({ code: 'pinyin', title: '拼音' }),
  // ...
]
```

然后在 `index.ts` 里挂进去，再重启 API 即可。

## 🪪 License

MIT
