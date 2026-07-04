# docs/decisions/

> **范围：** 决策记录 —— 一切 **"为什么"** 的归宿。
> `xuexi` 里所有非平凡的选择，都应该在这里能查到。

## ADR 格式

每份决策文件遵循 **MADR**（Markdown ADR）形态：

```markdown
# NNNN-简短标题

**状态：** 已接受 · 已替代 · 已废弃 · 提议中
**日期：** YYYY-MM-DD
**决策者：** <姓名，或 konglcxfs>

## 背景
这次决策背后有哪些压力？有什么矛盾？

## 决策
我们最终选了什么？

## 影响
- 正面：……
- 负面：……
- 中性：……

## 备选方案
1. …… —— 因为 …… 否决
2. …… —— 因为 …… 否决
```

文件名约定：`NNNN-kebab-case-title.md`。序号单调递增，永不复用。
新取号方法：

```bash
ls docs/decisions/ | grep -oE '^[0-9]+' | sort -n | tail -1 | awk '{print $1+1}'
```

## 维护规则

1. **绝不删除** ADR。若已被新决策替代，写"已替代"并链接到新文件。
2. **绝不修改**已归档决策的"决策"那一节。若当时选错了，写一份新 ADR 替代它。
3. **标题用英文**，正文用中文（本仓库惯例：技术名词用英文，叙述用中文）。
4. **必须交叉链接**：从相关的 `docs/architecture/` 页面指过来。

## 索引

| # | 标题 | 状态 | 日期 |
|---|---|---|---|
| 0001 | [first-change —— 第一个 change 没有"历史证据"](0001-first-change.md) | 已接受 | 2026-07-04 |

## 这里**不**放什么

- 代码文档 → `docs/architecture/` 或代码注释里
- 操作步骤 → `docs/workflows/`
- 教学法模型 → `docs/domain/`
- 生产运维 → `docs/operations/`

## 交叉链接

- ↔ `docs/foundation/README.md` —— 这些决策产生的不变式
- ↔ `docs/architecture/README.md` —— 这些决策塑造的组件