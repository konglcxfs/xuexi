# foundation-hygiene —— 决策记录

本文件记录本次 change 中做出的 **4 条** 关键决定。后续贡献者若问"为什么
是这样的"，应来此查找。

---

## ADR-0001：第一个 change 不需要历史证据

**状态：** 已接受 · **日期：** 2026-07-04

**背景。** Bamboo 的 `.bamboo/project.yaml` 声明 `evidence_required_before_archive: true`。
但仓库里的第一个 change 本来就没有"先例"可以引用。

**决策。** 第一个 change 通过"是它**本身**定义'什么算证据'"的方式被豁免。
其 evidence 目录包含 `git-ls-files.txt`（一次性快照）和显式的 `tests.md`
（声明"不适用 —— 仅文档变更"），使该策略能被**形式上**满足。

**影响。**

- 后续**每一个** change 都必须产出实质性证据：类型检查输出、lint 输出、
  截图、冒烟测试运行 等。
- 第一个 change 定的是**底线**（最低自证标准），但**真正的期望**更高。
- 任何审计本仓库的人都能在 `docs/decisions/0001` 找到这次豁免的说明。

**备选方案。**

1. **_临时关闭 `evidence_required_before_archive`，等有先例再开。_** ——
   否决：这违背该策略的本意。更好是诚实豁免并明确记录。
2. **_把策略改为 `soft_required: false` 并默认豁免。_** —— 否决：会让所有
   后续 change 的门槛一起降低。

---

## ADR-0002：`changes/archive/` 进 git；`changes/active/` 不进

**状态：** 已接受 · **日期：** 2026-07-04

**背景。** Bamboo 工作流假设多 worktree 开发（一次 change = 一个 worktree
= 一个分支）。每个 worktree 的私有状态（`.bamboo/active.yaml`、
`changes/active/<id>/`）是局部状态。而归档历史
（`changes/archive/<id>/`）是项目级共享状态。

**决策。**

- `changes/active/` 进 `.gitignore`。
- `changes/archive/` 按文件级追踪。

**影响。**

- 贡献者不可能意外泄露 WIP——它根本不出现在 diff 里。
- 评审者无需切到特殊分支就能读已完成的 change 历史。
- `.gitignore` 的边界本身就把 Bamboo 策略文档化了。

**备选方案。**

1. **_两边都追踪。_** —— 否决：WIP 工件会导致频繁 rebase 噪音。
2. **_两边都不追踪。_** —— 否决：审计轨迹没了。

---

## ADR-0003：`docs/` 用 6 个目录镜像 `project.yaml`

**状态：** 已接受 · **日期：** 2026-07-04

**背景。** `.bamboo/project.yaml` 的 `structure.docs.*` 已经列出 6 类
（`foundation`、`architecture`、`workflows`、`decisions`、`domain`、
`operations`）。但这些目录之前全是空的。

**决策。** 这 6 个镜像目录**就是**权威分类法。每个目录恰好放一个
`README.md`，声明：(a) 这里放什么、(b) 这里**不**放什么、(c) 与邻居的
交叉链接。

**影响。**

- 新贡献者不用问就知道新文档该放哪。
- 未来的 `comet status --docs-coverage`（待开发）会报告"完全覆盖"当每
  个 README 至少有 1 节非平凡内容。
- 不再建第二个 `docs/CHANGELOG.md` 或 `docs/INDEX.md`——这个角色已经由
  `.bamboo/index.yaml` 承担。

**备选方案。**

1. **_扁平的 `docs/*.md` 用 frontmatter 标签。_** —— 否决：让
   `find docs -name "*.md"` 难用，链接要手写。
2. **_用 Docusaurus / VitePress 结构。_** —— 否决：太重；以后可以包一层
   文档站点，但不应作为"事实之源"。

---

## ADR-0004：基础工程 change 用单 commit（而不是一系列）

**状态：** 已接受 · **日期：** 2026-07-04

**背景。** "基础工程清扫"这个 change 要动约 14 个互不相关的文件
（6 份 docs + 6 份 change 工件 + 2 份 Bamboo 状态）。是一个 commit 还是
14 个？

**决策。** 单 commit。理由：

- 全部工件互相依赖（没有 `docs/decisions/0001`，change 归档就半残；没有
  `output-map.yaml`，manifest 就不可解析；以此类推）。
- 评审价值高，作为一份 diff（"看，一次完整 change 长这样"）而不是 14 份
  静默微改。
- 回滚粒度反向也成立：如果未来某份单独的 doc 要被撤销，那是一次新的、
  未来的 change；本次 change 的整体撤销也仍然是有意义的原子单元。

**影响。**

- commit 信息必须列出全部交付物。（已列。）
- 后续 change 不能说"我借了 foundation-hygiene 的一半"——必须显式引用
  它为依赖。

**备选方案。**

1. **_14 个 commit + 1 个 meta commit。_** —— 否决：评审者更累，无实质
   收益，原子性被打破。