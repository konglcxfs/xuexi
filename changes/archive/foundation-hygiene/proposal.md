# foundation-hygiene —— 提案

> **`xuexi` 的第一个归档 Comet change。**
> 这个 change 故意做得风险很低——它的全部意义是**确立变更管理的工作纪律**
> （manifest / proposal / design / tasks / decisions / output-map / evidence），
> 这样后续每一次代码变更都继承一套磨合好的工作流，而不是继承一个空的 `docs/`
> 和一个空的 `changes/` 目录。

---

## 为什么做这件事

`comet init` 引导仓库时，Bamboo 控制面（`.bamboo/`）生成得没问题——但文档树
（`docs/{foundation,architecture,workflows,decisions,domain,operations}`）和
变更树（`changes/{active,archive}`）被**留空**。`.bamboo/project.yaml` 里
Bamboo 策略声明了五条硬约束：

```yaml
policies:
  canonical_docs_required: true
  change_requires_manifest: true
  change_requires_output_map: true
  decision_required_before_build: true
  evidence_required_before_archive: true
```

如果仓库里**没有任何 change 范例**、**`docs/` 里没有内容**，这五条策略
都无法被满足。本次 change 就是来破这个引导期的局。

## 本次 change 交付什么

一次提交（或一小组提交），完成：

1. **为本次豁免立个决定** —— 写 `docs/decisions/0001-first-change.md`，
   解释为什么"第一个 change 不需要历史证据"是合理的（它本身就是**定义**
   "什么算证据"的那次 change）。
2. **确立文档分类法** —— 给 `docs/<area>/` 每个目录一个 `README.md`，
   写清楚"哪些内容放这里"，并互相交叉链接。
3. **确立变更规范布局** —— 完整产出 `changes/archive/foundation-hygiene/`
   目录树（即本次 change 本身），示范后续贡献者要交的全部产出。
4. **接通 Bamboo 状态** —— 把本次 change 的条目追加到
   `.bamboo/boards/foundation.yaml` 和 `.bamboo/index.yaml`，让下次
   `comet status` 能看到。
5. **保存证据** —— `evidence/` 下放一份快照，证明新增文件已被 git 追踪、
   `git ls-files` 与目标清单匹配、`.gitignore` 边界正确。

## 本次 change **不**做什么

- 不改 `apps/` 或 `packages/` 下的任何运行时代码。
- 不动 `.bamboo/policies:`。
- 不开新分支——直接落到 `main` 上，因为它是"chore: 文档 + 工作流样板"，影响面很小。

## 风险

- **低。** 只动 `docs/`、`changes/archive/`、`.bamboo/boards/` 和
  `.bamboo/index.yaml`。无代码路径受影响。
- **失败模式：**
  - 若后续作者漏写了 `decisions.md`，可参考本归档 change 的文件作为模板。
  - 若新贡献者分不清 `changes/active/`（已 gitignore，每个 worktree 私有）
    和 `changes/archive/`（已提交，公共历史），本 change 的 README 即
    唯一权威。

## 验证

```bash
# 期望输出 'clean working tree'（干净的工作区）
git status

# 期望包含全部 7 项产出已被追踪
git ls-files changes/archive/foundation-hygiene/

# 期望列出全部 6 个 docs/ 的 README（已被填充）
git ls-files docs/
```

以上三条必须在 change 从 `verify` 进入 `archive` 之前全部通过。