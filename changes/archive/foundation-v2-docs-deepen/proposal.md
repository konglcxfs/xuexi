# foundation-v2-docs-deepen —— 提案

> **第二个 Comet change。** 把 `docs/foundation/` 从"仅 1 份 README"
> 推进到"可工作的项目级不变式文档集"。

---

## 为什么做

`foundation-hygiene` 这个 change（已归档，commit `ec9a6fe`）只做了一件事：
**确立 `docs/<area>/` 的分类法**。每个目录 1 份 README，说明那里**将来**会
放什么。

但 README 不是文档本身——它只是目录的"使用说明"。仓库读 README 的人会立
刻问："**那术语表在哪？命名约定在哪？版本规则在哪？**"

本次 change 回答这些**前 5 个**最高频问题，集中落在 `docs/foundation/`。
后续 change 再分别深补 `docs/architecture/`、`docs/domain/`、
`docs/operations/` 等。

## 本次 change 交付什么

5 份新的 markdown 文件，全部位于 `docs/foundation/`：

| # | 文件 | 用途 | 估计行数 |
|---|---|---|---|
| 1 | `project-glossary.md` | 30 个核心术语的中文 + 英文 + 反例 | ~150 |
| 2 | `naming-conventions.md` | 文件 / 包 / 变量 / DB 字段命名规则 | ~120 |
| 3 | `principles.md` | 8 条不可破坏的工程原则 | ~80 |
| 4 | `stack-overview.md` | 每组件的语言 / 运行时 / 包管理器 | ~100 |
| 5 | `versioning.md` | Semver 政策 + `@xuexi/*` 包发布流程 | ~90 |

合计：~540 行 markdown。无运行时代码改动。

## 本次 change **不**做什么

- 不动 `docs/architecture/`、`docs/workflows/`、`docs/decisions/`、
  `docs/domain/`、`docs/operations/`——这些留给后续 change 单独深补。
- 不动 `.bamboo/project.yaml` 的任何 policy。
- 不改 `apps/`、`packages/` 下的任何代码。

## 风险

- **低。** 100% 文档；与上一次 `foundation-hygiene` 同样的低风险类别。
- **主要风险**是**术语表与现有代码命名不一致**——后续若发现冲突，应开
  一个 follow-up change（code-side align），而不是修改 glossary。

## 验证

```bash
# 5 份新文件全部存在
ls docs/foundation/ | grep -E '^(project-glossary|naming-conventions|principles|stack-overview|versioning)\.md$' | wc -l
# 期望：5

# docs/foundation/ 现有内容（含原有 README）
ls docs/foundation/
# 期望看到 6 份（1 README + 5 新增）

# 工作区干净
git status
```

以上三条全部通过后，本 change 即可从 `verify` 进入 `archive`，且归档
时从 `changes/active/` 移到 `changes/archive/`。