# foundation-v2-docs-deepen —— 决策记录

2 条新决策；另有 2 条决策**复用**自 `foundation-hygiene`，此处仅引用。

---

## ADR-0005：补 `docs/foundation/` 在前，5 个其它 domain 在后

**状态：** 已接受 · **日期：** 2026-07-05

**背景。** `docs/` 6 个目录里 5 个（`architecture`、`workflows`、
`decisions`、`domain`、`operations`）都是"目标"。哪个先动？

**决策。** 先动 `docs/foundation/`，理由：

- `foundation` 定义术语表——`architecture` 写组件时直接可用。
- `foundation` 定义命名约定——`architecture` 写代码示例时不必再发明。
- `foundation` 定义 stack——`operations` 写部署时不必再列举。
- `foundation` 定义 versioning——`workflows` 写发布时不必再论证。

**影响。** 后续 5 个 domain 的 change 会**更小、更快**。`foundation`
是其它 5 个的"前置依赖"。

**备选方案。**

1. **_按字母顺序补。_** —— 否决：`architecture` 早于 `foundation` 是
   字母序巧合，没语义。
2. **_按"用户最容易搜到"补。_** —— 否决：新用户搜的是"怎么开发"（→
   `workflows`），但 `workflows` 自身依赖 `foundation` 的术语表。
3. **_6 个 domain 一起补。_** —— 否决：一次 change 太大，违反"一次
   change 一次 commit"原则；reviewer 看 6 份文件 vs 1 份 review 难度
   不是线性增长。

---

## ADR-0006：单 commit（不是 5 个文件 5 个 commit）

**状态：** 已接受 · **日期：** 2026-07-05

**背景。** 本次 change 新增 5 份 markdown。是不是 1 文件 1 commit？

**决策。** 仍是单 commit。**理由**与 `foundation-hygiene` ADR-0004
完全一致：

- 5 份文件**互相引用**（README 指向 5 份；5 份之间交叉引用少但都有）。
- 单 commit 的 diff 评审**比 5 个 commit 更省力**。
- 撤销粒度反向有效：若未来某 1 份文件需要换，那是一次新 change。

**与 ADR-0004 的不同：** 此次 5 份文件可以**在物理上分多个 commit**而
**不损失**原子性。**选择单 commit**只是为了一致性；并非物理上必须。

**影响。** 未来若有人提"为什么不分 5 个 commit"——指 ADR-0006 看。

**备选方案。**

1. _5 个 commit。_ —— 否决：与 ADR-0004 不一致；reviewer 心智成本加倍。
2. _5 份文件先 PR 进一个 branch，再 squash merge。_ —— 否决：本仓库
   工作流不强制 PR（单人项目）；squash 会丢失"先写哪份"的顺序信息。

---

## 复用的旧决策

- **ADR-0002**（archive/active 边界）—— `.gitignore` 已经设好，
  本 change 自动受益。
- **ADR-0003**（6 个 domain 分类法）—— 本 change 落在 `foundation/`
  之下，不动分类法。