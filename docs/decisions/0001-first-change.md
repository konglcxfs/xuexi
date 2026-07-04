# 0001 —— 第一个 Comet change 没有"历史证据"

**状态：** 已接受 · **日期：** 2026-07-04 · **决策者：** konglcxfs

## 背景

`.bamboo/project.yaml` 里声明了五条硬约束：

```yaml
policies:
  canonical_docs_required: true
  change_requires_manifest: true
  change_requires_output_map: true
  decision_required_before_build: true
  evidence_required_before_archive: true
```

但这些约束在项目第零天根本无法满足：

1. 仓库**没有任何先前的归档 change** 可以照抄结构。
2. **没有约定**说"什么算证据"——文档类变更、代码类变更、基础设施类变更的证据应该不一样。
3. `docs/` 被初始化的**全空**——6 个必备子目录（`foundation`、`architecture`、`workflows`、`decisions`、`domain`、`operations`）一个 README 都没有。

若没有东西可以归档，整个 `comet` 工作流就卡死了：`foundation` 板停在 0 个 change，`index.yaml` 没有历史，`evidence_required_before_archive` 无从满足。

## 决策

**第一个** Comet change 是 `foundation-hygiene`。它被**明确豁免**于"历史证据"标准，规则如下：

- 它的 `evidence/` 目录**存在**（政策"形式上被满足"）。
- `evidence/tests.md` 声明"不适用 —— 仅文档变更"，并引用本 ADR（使豁免可审计）。
- `evidence/git-ls-files.txt` 提供**一次性快照**，证明 14 项交付物都被 git 追踪。

此后**每一个** change 都必须产出真实的、不可自证的证据（类型检查、lint、冒烟测试、截图 等），**不再享受引导期豁免**。

## 影响

**正面。**

- 引导期的死锁被打破；后续贡献者有完整的模板可复制。
- `foundation` 板从 `counts.total: 0` 变成 1，所有 `comet status` 查询能用。

**负面。**

- 审计时必须**显式阅读**本 ADR 才能理解"为什么第一个 change 的证据很敷衍"。新加入的评审者可能误以为"门槛就这么低"——代码评审里要主动反驳这种解读。

**中性。**

- 豁免消耗了 1/N 个"引导期免费额度"。没有更多剩余。

## 备选方案

1. **临时关闭 `evidence_required_before_archive`，等后续 change 出现。**—— 否决：违背这条政策的本意，鼓励"下次我会小心"。
2. **把策略改成 `evidence_required_before_archive: "soft"`，并默认豁免。**—— 否决：降低所有 change 的统一门槛。
3. **把引导写成一次手动 commit，不走 Comet。**—— 否决：Comet 的全部意义就在于第一个 change 也走它；否则工作流就是死在起跑线。