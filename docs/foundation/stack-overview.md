# 技术栈总览（stack-overview）

> 1 张表 + 1 段叙述。**新增组件时**：先加表行，再写代码。

## 一、组件表

| 组件 | 路径 | 语言 | 运行时 | 包管理器 | 构建工具 | 测试 | 类型 |
|---|---|---|---|---|---|---|---|
| `api` | `apps/api` | TypeScript 5.x | Node.js ≥ 20 LTS | pnpm | `tsc` + `tsx` | `vitest` | 强类型 |
| `web` | `apps/web` | TypeScript 5.x | 浏览器 | pnpm | Vite 5 | `vitest` + `playwright` | 强类型 |
| `desktop` | `apps/desktop` | TypeScript 5.x | Electron 30+ | pnpm | `electron-builder` | `vitest` + 自定义 | 强类型 |
| `ai-adapter` | `packages/ai-adapter` | TypeScript 5.x | Node + 浏览器 | pnpm | `tsup` | `vitest` | 强类型 |
| `knowledge-base` | `packages/knowledge-base` | TypeScript 5.x | Node + 浏览器 | pnpm | `tsup` | `vitest` | 强类型 |
| `learning-engine` | `packages/learning-engine` | TypeScript 5.x | Node + 浏览器 | pnpm | `tsup` | `vitest` | 强类型 |
| `shared` | `packages/shared` | TypeScript 5.x | Node + 浏览器 | pnpm | `tsup` | `vitest` | 强类型 |

## 二、横切工具

| 工具 | 路径 | 用途 |
|---|---|---|
| `codegraph` | 仓库根 | 代码知识图谱（`.codegraph/` 索引 SQLite） |
| `comet` | 全局 CLI | 变更管理（`comet init/status/...`） |
| `prisma` | `apps/api` | SQLite schema 管理 |
| `better-sqlite3` | `apps/api` | SQLite 客户端 |
| `eslint` | 仓库根 | lint |
| `prettier` | 仓库根 | 格式化 |
| `madge` | 仓库根（仅 CI） | 检测环依赖 |

## 三、为什么这么选

### 统一 TypeScript 5.x

- **理由 1：原则 8（依赖方向单向）**。TypeScript 在编译期就能拦截环依赖
  / 拼写错误，省下一半 review 成本。
- **理由 2：Electron 主进程也是 TS**。如果桌面端用另一种语言，主进程与
  渲染进程的 IPC 类型就不可共享。
- **理由 3：AI 生成的代码**。Codex / Cursor / Claude 对 TS 的接受度最高；
  任意一种新语言都会拖慢 AI 辅助开发的节奏。

### 统一 pnpm

- **理由 1：磁盘与安装速度**。硬链接复用 `node_modules`，一份 11 个
  component 的仓库首次 install < 60s。
- **理由 2：workspace 协议**。`@xuexi/shared` 在所有 app 里都是同一份
  软链——本地改一处，所有 app 立即生效。
- **理由 3：`.npmrc` 锁定**。`node-linker=hoisted` 关掉、`auto-install-peers=true` 开。
  防止某个 app 误装一份 duplicate。

### Electron 30+（不是 Tauri）

- **理由 1：TS 主进程共享**。Electron 主进程就是 Node，没有 Rust 边界。
- **理由 2：本地 SQLite 可执行**。`better-sqlite3` 在 Electron 主进程能
  跑；Tauri 需要单独的 Rust 命令——增加 1 个 IPC 层。
- **理由 3：教学法模型仍以 web 为主**。桌面只是 web 的壳（BrowserView
  加载 `http://localhost:5173`），所以 Electron 的"重"被摊薄了。

### SQLite（不是 Postgres）

- **理由 1：单机优先**。MVP 阶段只有"本地 1 用户 1 数据库" 的需求。
- **理由 2：零运维**。备份 = 拷一个文件。schema migration = 1 个
  `migrate.ts`。
- **理由 3：可演进**。一旦并发用户上 10+ 个，可平滑迁移到 Postgres（Prisma
  支持），领域模型不变（原则 1）。

### Vite 5（不是 webpack / Next.js）

- **理由 1：ESM 原生**。`tsconfig.json` 配 `"module": "ESNext"`，不再
  编译出 CJS。
- **理由 2：HMR 极快**。冷启动 < 1s，HMR < 100ms——开发节奏能维持。
- **理由 3：SSR 不需要**。教学类应用是 SPA，所有路由都是 client-side。

### Vitest（不是 Jest）

- **理由 1：与 Vite 共享配置**。一份 `vite.config.ts`，test 复用。
- **理由 2：ESM 友好**。Jest 的 ESM 模式在 2026 年仍是"能跑但麻烦"。
- **理由 3：原生 TS 支持**。不用 `babel-jest` 那种间接层。

## 四、当前 stack 不包含的东西

| 没用 | 原因 |
|---|---|
| React Native | 桌面是 Electron；移动端是"以后再说"，本仓库当前不规划 |
| GraphQL | 当前 11 个端点 REST 就够；GraphQL 的复杂度换不到收益 |
| Docker（开发） | `pnpm install` 直接跑；Docker 留给生产 |
| Kubernetes | 单机部署；K8s 留给日活 10k+ |
| TypeORM / Drizzle | 选 Prisma 是因为它支持 SQLite + schema 迁移的双语法 |
| Webpack | 已被 Vite 替代 |
| Yarn / npm | 已被 pnpm 替代 |

## 五、未来栈演进（待 ADR）

- **计划 1：把 `learning-engine` 重写到 Rust**。理由：稳定性算法和
  KP 关系图遍历是 CPU 密集。**前置**：写 1 份 perf benchmark 证明
  Node 实现是瓶颈。**当**：`apps/web` 在 1000+ KP 时主线程卡 > 200ms。
- **计划 2：换 SQLite → Postgres**。理由：日活 100+ 后，写锁竞争明显。
  **前置**：监控写锁等待时间。
- **计划 3：加 tRPC**。理由：当前 11 个端点手写 client 类型太啰嗦。
  **前置**：端点 > 30 个。
