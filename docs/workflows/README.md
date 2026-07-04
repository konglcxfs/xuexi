# docs/workflows/

> **范围：** 可重复的开发者 / 运维 操作步骤。
> 凡是前面**带动词**的文档，都放这里。

## 这里放什么

写给开发者的"今天就能跑通一个真实任务"的逐步指南。建议格式：

```markdown
# 如何 <动作> <对象>

## 前置条件
- ……

## 步骤（端到端可验证）
1. ……
2. ……

## 预期输出
- ……

## 故障恢复
- 如果失败，参见 <链接>
```

建议文件：

- `bootstrap.md` —— clone → `pnpm install` → `comet init` → `codegraph init`
- `run-api-dev.md` —— 带热重载的本地 API
- `run-web-dev.md` —— Vite 本地前端
- `add-knowledge-base.md` —— 注册一个全新的角色知识库
- `build-desktop.md` —— 产出 Electron 安装包
- `db-migrate.md` —— 数据库 schema 迁移约定
- `publish-package.md` —— `@xuexi/*` 包的版本号与发布流程
- `cut-a-change.md` —— 一次完整的 Comet change 生命周期演练

## 这里**不**放什么

- 描述 `xuexi` 是什么 → `docs/foundation/`
- 架构设计 → `docs/architecture/`
- 选择（为什么选 X） → `docs/decisions/`
- 教学法模型 → `docs/domain/`
- 生产侧运维 → `docs/operations/`

## 交叉链接

- ↔ `docs/foundation/README.md` —— 这些指南涉及的不变式
- ↔ `docs/operations/README.md` —— 生产侧的对偶操作
- ↔ `docs/decisions/README.md` —— 塑造这些工作流的选择