# 工程原则（principles）

> 8 条不可破坏的工程原则。**违反任何一条必须有 ADR 解释。**

---

## 原则 1：领域模型优先于数据库 schema

**为什么。** SQLite 是"实现细节"——某天可能换 Postgres、换 KV。领域模型
（KP / Mastery / Plan / Exercise）是"产品定义"，不应被任何存储影响。

**怎么落地。** 在 `packages/shared/` 下定义 TypeScript 类型（`KnowledgePoint`
等）；`apps/api` 的 Prisma schema 负责"翻译"成表。任何字段名不一致都
由 schema 层解决，不外泄到领域。

**违反的代价。** 任何一次"加字段直接改 schema" 都会让前端被迫跟随 DB
变化。最终前后端会强烈耦合、迁移成本指数增长。

---

## 原则 2：AI 调用只走 `packages/ai-adapter`

**为什么。** 业务代码如果直接 `fetch("https://api.openai.com/...")`，会
出现：(a) 多个 prompt 拼接逻辑分散；(b) 测试时无法替换为 stub；
(c) 切换 provider 改 N 个文件。

**怎么落地。** 业务代码**只**写
`const text = await ai.complete(prompt, opts)`。`packages/ai-adapter`
负责"切本地 / 切远程 / 切 OpenAI 兼容协议 / 切 Anthropic"。

**违反的代价。** Provider 切换变成"全仓库 grep + 改 N 个文件"——一次
要一周。还会出现"同一个 prompt 在 3 个地方各写一遍"。

---

## 原则 3：纯函数包，副作用包

**为什么。** `packages/learning-engine` 和 `packages/knowledge-base`
必须是**纯函数包**——给定输入返回输出，不读 DB、不调网络。`apps/api`
是**副作用包**——读 DB、对外暴露 HTTP。

**怎么落地。** 纯函数包不能 `import` 任何带 IO 的库（`fs`、`fetch`、
`better-sqlite3`）。在 `package.json` 里用 `dependencies` vs
`peerDependencies` 区分；CI 跑"engine 引用 fs 即失败"的检查。

**违反的代价。** 引擎变得不可测、不可并行、不可在 Electron 端复用。
最终要么重写要么 fork。

---

## 原则 4：所有用户数据走 `apps/api`

**为什么。** SQLite 文件位于 `apps/api/data/*.sqlite`。前端（`apps/web`
和 `apps/desktop`）**永远不**直接打开 DB。所有读写都通过 `/api/*` JSON
接口。

**怎么落地。** 前端**禁止**安装 `better-sqlite3`、`prisma`、`@xuexi/learning-engine`
等任何"后端"依赖。`package.json` 的 `dependencies` 由 review 检查。

**违反的代价。** 数据访问路径分叉；权限模型被绕过；web 端能读到
desktop 端本不该看到的字段。

---

## 原则 5：一次 change 一次 commit

**为什么。** "1 个 PR 50 个 commit" 在评审时是负担——但"1 个 PR 200 个
commit 跨 5 个独立 change"是灾难：撤销一个 change 会拆散其他 4 个
change 的 commit。

**怎么落地。** 每个 change 在 `changes/<archive|active>/<id>/` 下放完整
6 文件（manifest/proposal/design/tasks/decisions/output-map）。reviewer
看 1 个 commit = 看 1 个 change = 看 1 份完整意图。

**违反的代价。** `git log` 失去"按 change 阅读"的能力；`git bisect` 会
因为一个混合 commit 跳错位置。

---

## 原则 6：测试金字塔不可压扁

**为什么。** 单元测试快但覆盖窄；e2e 测试慢但能验证真实流程。压扁
金字塔（"全写 e2e" 或 "全写单元"）都会失败。

**怎么落地。** 各层比例目标：

| 层 | 工具 | 比例目标 |
|---|---|---|
| 单元 | `vitest` | 70% |
| 集成 | `vitest` + 起临时 SQLite | 20% |
| E2E | `playwright` (web) / 自定义 (desktop) | 10% |

**违反的代价。** 全 e2e → CI 跑 30 分钟，PR 节奏崩溃。全单元 → 集成
bug 在生产才被发现。

---

## 原则 7：领域对象是"不可变值对象"

**为什么。** 掌握度更新 = 旧值 + 新值（新证据），不是"在旧值上 mutate"。
不可变让"撤销某条证据"成为可能（`mastery = reduce(evidence, init)`）。

**怎么落地。** 在 `packages/shared/types.ts` 里所有领域对象用 `readonly`
字段。修改通过 `{ ...old, changed: newValue }` 风格。

**违反的代价。** 撤销某条错误证据变成"考古 + 数据库手术"；并行 update
出现 lost update。

---

## 原则 8：依赖方向单向

**为什么。** `apps/*` 可以依赖 `packages/*`；`packages/*` 只能依赖更"基础"
的 `packages/*`（如 `learning-engine` 可依赖 `shared`，不可依赖 `web`）。
环依赖会让打包、HMR、tree-shaking 全部失败。

**怎么落地。** CI 跑 `madge --circular --extensions ts packages/` 和
`madge --circular --extensions ts apps/`。任何环依赖直接 fail。

**违反的代价。** 一次环依赖导致：`tsc` 编译顺序难调、tree-shaking
失效、bundler 死锁——"重构半天就为了让 build 通过"。

---

## 附：原则的元规则

- **不可多于 8 条**。多于 8 条没人能记住——原则沦为"好看的废话"。
- **新增原则**：开 PR 改本文件 + 写一份 ADR 解释"为什么加"。
- **删除原则**：把"已废弃"作为状态保留 1 年，再物理删除。
- **违反处理**：CI 自动拦截（lint / typecheck / circular / smoke）→
  不需人判断。
