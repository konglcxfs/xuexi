# evidence / tests.md —— foundation-hygiene

> **类型：** N/A（仅文档类 change，无可执行测试）
> **Bamboo 策略满足方：** `evidence_required_before_archive: true`
> **替代证据：** 自证 + git ls-files 快照

## 为什么不写测试

`foundation-hygiene` 这个 change 是 **100% 文档类**——只新增：

- `changes/archive/foundation-hygiene/` 下的 7 个文件（change 本身的权威工件）
- `docs/<area>/` 下的 6 份 `README.md`
- `docs/decisions/0001-first-change.md`（一份 ADR）
- 2 份 Bamboo 状态更新（`.bamboo/boards/foundation.yaml`、`.bamboo/index.yaml`）

未修改 `apps/` 或 `packages/` 下的任何代码，也不调用 `pnpm`/Bamboo 的测试运行器。

## 这样满足策略的方式

Bamboo 策略 `evidence_required_before_archive: true` 的本意是：在一次 change
被标记 `archive` **之前**，要存在某种"工件"证明它确实完成了自己声称要做的事。
对本次 change 而言：

1. 该工件就是 `evidence/git-ls-files.txt`——一份 `git ls-files` 的字面快照，
   显示本次新增的 7 份 change 内文件 + 7 份 docs 文件全部已 git 追踪。
2. 本文件（`tests.md`）本身就是一份自证：声明本次仅文档类 change，策略被
   **凭借这一点**满足，并引用 ADR-0001（"第一个 change 定义'证据'的含义"）。

## 后续 change 应当怎么写（非文档类）

对于代码类 change（`apps/api`、`apps/web` 等），`evidence/` 下应当至少包含以下之一：

- `pnpm --filter @xuexi/<pkg> typecheck`（抓取输出）
- `pnpm --filter @xuexi/<pkg> smoke`（抓取输出）
- `pnpm --filter @xuexi/web ui:smoke`（抓取输出 + 截图）
- `gh run list` 显示 CI 绿色（抓取 URL）

策略只检查 `evidence/` 目录**存在**且至少**有 1 个文件**；实质内容由评审者判断。