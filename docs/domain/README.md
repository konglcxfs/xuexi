# docs/domain/

> **范围：** `xuexi` 所承载的**教学法**模型。
> 系统"在讲什么"，而不是"怎么实现的"。

## 这里放什么

用**领域语言**（不是 TypeScript 语言）解释系统的**概念**的文件。

典型内容：

- `knowledge-point.md` —— 知识点（KP）是什么，ID 方案，前置依赖模型
- `mastery.md` —— 掌握度的含义，三个维度（讲解 / 应用 / 拓展）
- `ebbinghaus-curve.md` —— 为何选 `0.7^(elapsedDays/stability)` 作为衰减系数
- `plan-generator.md` —— 三优先级排序、分片算法、每日预算
- `weakness-diagnostics.md` —— 四类根因 + 两层诊断
- `knowledge-linker.md` —— 三种链接、何时各自动作
- `long-term-memory.md` —— 哪些内容被提炼、何时被召回
- `role-model.md` —— `primary_school` vs. `ruankao`，Prompt 风格轴

## 这里**不**放什么

- 代码实现 → `docs/architecture/`
- 怎么运行这些引擎 → `docs/workflows/`
- "为什么这条曲线不用那条" → `docs/decisions/`
- 部署 / 监控 / 扩容 → `docs/operations/`

## 交叉链接

- ↔ `docs/architecture/packages-learning-engine.md`（待补） —— 把领域模型落到代码的那个组件
- ↔ `docs/decisions/` —— 选定这些公式的那些选择

## 待回答的开放问题（在后续 change 中决定）

1. `mastery` 应当是 3 个独立标量，还是一个 3 维向量带距离度量？（当前实现：3 个独立标量）
2. 计划生成器是把"复习"和"新内容"放在同一优先级桶，还是复习永远优先？（当前实现：复习永远优先）
3. `knowledge-linker` 在每次对话回复时同步调用是否值得，还是改成异步？（当前实现：同步调用 + 懒缓存）