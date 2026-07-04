# docs/architecture/

> **范围：** 组件级架构。
> 凡是讲 **"各个部分是怎么拼起来的"** 的文档，都放这里。

## 这里放什么

描述以下任一内容的文件：

- 某个具体组件（`apps/api`、`apps/web`、`apps/desktop`、`packages/ai-adapter`、`packages/learning-engine`、`packages/knowledge-base`、`packages/shared`）
- 跨组件数据流（时序图、请求生命周期）
- 数据库 schema（`prisma/schema.prisma` 速查）
- 公开 REST API 表面（`/api/users`、`/api/plans` 等所有端点）
- 进程与线程模型（`apps/desktop/main.ts` 的生命周期、IPC 通道）
- Provider 抽象（`LocalStub` vs. 真实的 `OpenAI` 兼容协议）

文件命名建议：

- `apps-api.md`
- `apps-web.md`
- `apps-desktop.md`
- `packages-learning-engine.md`
- `data-flow.md`（数据流）
- `rest-api.md`（REST 接口）
- `ai-provider.md`（AI 提供方）

## 这里**不**放什么

- 项目身份 / 命名规则 → `docs/foundation/`
- 开发者日常操作 → `docs/workflows/`
- "为什么选 A 不选 B" 的选择 → `docs/decisions/`
- 教学法模型本身 → `docs/domain/`
- 部署 / 监控 / 扩容 → `docs/operations/`

## 交叉链接

- ↔ `docs/foundation/README.md` —— 这些组件在哪儿被清点
- ↔ `docs/operations/README.md` —— 这些组件是怎么部署的
- ↔ `docs/decisions/` —— 产生这个架构的那些选择