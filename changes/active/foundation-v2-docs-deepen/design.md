# foundation-v2-docs-deepen —— 设计

## 为什么是 `docs/foundation/` 不是其它

按 **对项目"广度 / 影响力"** 排序 docs/ 的 6 个子目录：

```
foundation   ← 全项目不变式；其它 5 个目录的"前置定义"
  ↑
architecture / domain / workflows / operations / decisions
```

补 `docs/foundation/` 等于先**定义词汇与原则**，后续 5 个目录写起来会
有共同语言。**先 foundation，再其它**。

## 5 份文件的内容边界

### `project-glossary.md`

只收录**跨组件**使用的术语——即任何写 `apps/api` 或 `apps/web` 的人都
会用到的词。**不**收录：

- 仅 `apps/desktop` 用的内部术语 → 放 `docs/architecture/apps-desktop.md`
- 仅 `packages/learning-engine` 用的算法术语 → 放 `docs/architecture/packages-learning-engine.md`

每个术语有四列：**中文名 / 英文名 / 简短定义 / 常见反例**。

### `naming-conventions.md`

按四类分节：**文件名 / 包名 / 变量 / 数据库字段**。每节给出 3-5 条规则
+ 一个正例 + 一个反例。

### `principles.md`

**最多 8 条**——超过 8 条没人能记住。每条结构：

```markdown
## 原则 N：<一句话>

**为什么。** 一段话解释这条原则在挡什么样的失败。
**怎么落地。** 一段话解释日常怎么遵守。
**违反的代价。** 一段话举一个真实案例。
```

### `stack-overview.md`

**一张表 + 一段叙述**。表是主要载体（11 行：1 行表头 + 7 个 component
+ 3 个横切工具）。叙述解释"为什么是 pnpm"和"为什么 TypeScript
统一"。

### `versioning.md`

两节：**semver 政策**（哪些是 public package、major/minor/patch 何时
用）+ **`@xuexi/*` 发布流程**（手把手 5 步）。

## 跟 `foundation-hygiene` 的关系

`foundation-hygiene` 已经做了两件事：

1. 确立了 6 个 `docs/<area>/` 分类法。
2. 立了一个 ADR-0001，说明"为什么第一个 change 证据门槛低"。

本 change **不重写**那 6 份 README——它们依然有效。本 change 是**在
`docs/foundation/` 之下**新增 5 份文件。

## 工作流分阶段

- **设计（本文件 + 决策）** —— 已经做完
- **构建（C-2：写 5 份 markdown）** —— 当前阶段
- **验证（C-3：更新 Bamboo 状态 + 跑 ls 验证）** —— 下一阶段
- **归档（C-4：commit + push + 把 `changes/active/` 移到 `changes/archive/`）** —— 末段

## 反范式化考虑

- 这 5 份文件互相交叉链接少（互相**几乎不**引用），仅 1 份 README 指向
  全部 5 份。
- 5 份文件全部独立可读。**没有"必须按顺序读"**的要求。
- 这意味着：可以**分多个 commit**提交（每个文件一个 commit）以减小 diff
  粒度——但本次按"单 commit"提交，与 `foundation-hygiene` 一致，理由见
  `decisions.md` ADR-4。