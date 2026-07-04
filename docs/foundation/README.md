# docs/foundation/

> **范围：** 项目级的不变式（invariant）文档。
> 凡是描述 `xuexi` 这个项目**本身**的文档，都放这里。

## 这里放什么

本目录下的文件回答的是 **"xuexi 是什么？"**——是项目层面的问题，不是组件层面的。

典型内容：

- `project-glossary.md` —— 项目术语表（知识点、掌握度、练习证据 等）
- `naming-conventions.md` —— 单复数、命名大小写、前缀规则
- `principles.md` —— 5～10 条不能破坏的工程原则
- `stack-overview.md` —— 每个组件的语言、运行时、包管理器
- `versioning.md` —— Semver 政策、公开包（`@xuexi/*`）的发布规则

## 这里**不**放什么

- 组件级的设计 → `docs/architecture/`
- 开发者日常操作 → `docs/workflows/`
- "为什么选 A 不选 B" 的选择 → `docs/decisions/`
- 教学法模型（知识点图谱、遗忘曲线 等） → `docs/domain/`
- 部署、运维、监控 → `docs/operations/`

## 交叉链接

- ↔ `docs/architecture/README.md` —— 组件级设计
- ↔ `docs/decisions/README.md` —— 产生这些不变式的那些选择
- ↔ `docs/domain/README.md` —— 底层的教学法模型