# foundation-hygiene —— 任务清单

本次 change 的作者有 5 个明确任务。全部已完成；本文件是历史记录。

## 状态图例

- `[x]` 已完成
- `[~]` 归档瞬间正在进行
- `[ ]` 未开始（会阻塞归档）

---

### T1. 给元决策授权 `[x]`

写 `docs/decisions/0001-first-change.md`，让后续贡献者明白为什么第一个
change 不需要历史证据。

- 负责人：konglcxfs
- 交付物：`docs/decisions/0001-first-change.md`
- 验收：文件存在，并引用了 `.bamboo/project.yaml` 的四条硬约束。

### T2. 填充 `docs/` 分类法 `[x]`

在 `docs/` 下写 6 份 `README.md`（每个目录一份），声明各自放什么。

- 负责人：konglcxfs
- 交付物：
  - `docs/foundation/README.md`
  - `docs/architecture/README.md`
  - `docs/workflows/README.md`
  - `docs/decisions/README.md`
  - `docs/domain/README.md`
  - `docs/operations/README.md`
- 验收：每个目录都有 README，无空目录。

### T3. 把本次 change 立成完整范例 `[x]`

在 `changes/archive/foundation-hygiene/` 下写出 6 份权威 change 工件，
示范后续贡献者要交的全部文件形态。

- 负责人：konglcxfs
- 交付物：manifest.yaml / proposal.md / design.md / tasks.md /
  decisions.md / output-map.yaml + `evidence/git-ls-files.txt`。
- 验收：`ls changes/archive/foundation-hygiene/` 列出 7 项（6 个文件 +
  1 个 `evidence/` 目录），无缺失工件。

### T4. 接通 Bamboo 状态 `[x]`

更新 `.bamboo/boards/foundation.yaml` 和 `.bamboo/index.yaml`，使本次
change 出现在查询中。

- 负责人：konglcxfs
- 交付物：两份文件各自追加一行。
- 验收：`grep foundation-hygiene .bamboo/ -R` 返回 2 条命中（每份文件 1 条）。

### T5. 提交 & 推送 `[x]`

`main` 上一个 commit；HTTPS push。

- 负责人：konglcxfs
- 交付物：1 个 git commit，1 次 push。
- 提交主题：`chore(foundation): establish docs/ taxonomy + first archived change example`
- 验收：`git log origin/main --oneline | head -2` 显示两条提交（baseline + 本次）。

---

## 任务级证据（保存在 `evidence/` 下）

- `evidence/git-ls-files.txt` —— `git ls-files` 对
  `changes/archive/foundation-hygiene/` 和 `docs/` 的快照。
- `evidence/tests.md` —— 占位说明"不适用 —— 文档类 change"，并解释为何
  Bamboo 策略 `evidence_required_before_archive: true` 仍然被满足
  （本文件存在 + git-ls-files 快照存在）。

## 归档前必须通过的验证

```bash
# 健全性检查：工作区干净
git status

# 全部 6 份权威工件 + 1 份 evidence 文件已追踪
git ls-files | grep "^changes/archive/foundation-hygiene/" | wc -l    # → 7

# docs/ 6 个目录都有 README.md
find docs -mindepth 2 -name 'README.md' | wc -l                       # → 6

# Bamboo 状态引用了本次 change
grep -r "foundation-hygiene" .bamboo | wc -l                          # → 2
```

以上三条必须同时通过，change 才能从 `verify` 进入 `archive`。