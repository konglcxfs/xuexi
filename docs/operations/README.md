# docs/operations/

> **范围：** 生产侧 —— **代码发布之后**的事。
> 开发者侧的操作步骤，归 `docs/workflows/`。

## 这里放什么

- **部署（Deploy）。** 发布 `@xuexi/api` 容器、打包 Electron 桌面安装包、发布 `@xuexi/*` 包到包仓库。
- **可观测（Observe）。** 该记什么日志、该采什么链路、必备的仪表盘。
- **扩容（Scale）。** 何时把 SQLite 拆到 Postgres、何时增加第二个 `apps/api` 实例、何时把引擎拆成独立 worker。
- **灾难恢复（Disaster recovery）。** 怎么从备份恢复 `apps/api/data/*.sqlite`、怎么从源码重建知识库。
- **密钥管理（Secret management）。** `XUEXI_AI_API_KEY` 在不同环境里怎么下发。

## 建议文件（占位，待补）

- `deploy.md`
- `logging.md`
- `metrics.md`
- `scaling.md`
- `disaster-recovery.md`
- `secrets.md`

## 这里**不**放什么

- 本地开发步骤 → `docs/workflows/`
- 组件架构 → `docs/architecture/`
- 教学法模型 → `docs/domain/`
- 决策理由 → `docs/decisions/`

## 交叉链接

- ↔ `docs/architecture/` —— 被运维的那些组件
- ↔ `docs/workflows/` —— 开发者侧的对偶步骤（例如：`db-migrate.md` 是开发者侧，`disaster-recovery.md` 是运维侧）