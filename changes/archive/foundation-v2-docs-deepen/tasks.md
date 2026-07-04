# foundation-v2-docs-deepen —— 任务清单

5 个明确任务 + 2 个状态更新任务。

## 状态图例

- `[x]` 已完成
- `[~]` 正在进行
- `[ ]` 未开始

---

### T1. 写 `docs/foundation/project-glossary.md` `[x]`

**负责人：** konglcxfs
**交付物：** 30 个核心术语 + 反例
**验收：** 任意 5 个随机术语，问"中文 / 英文 / 反例"都能在 30 秒内答出。

### T2. 写 `docs/foundation/naming-conventions.md` `[x]`

**负责人：** konglcxfs
**交付物：** 文件 / 包 / 变量 / DB 字段 4 类命名规则
**验收：** 4 节齐全，每节有 ≥ 1 正例 + 1 反例。

### T3. 写 `docs/foundation/principles.md` `[x]`

**负责人：** konglcxfs
**交付物：** 8 条不可破坏的工程原则
**验收：** 每条都有"为什么 / 怎么落地 / 违反的代价"三段。

### T4. 写 `docs/foundation/stack-overview.md` `[x]`

**负责人：** konglcxfs
**交付物：** 1 张 11 行表 + 1 段叙述
**验收：** 表覆盖全部 7 个 component + 3 个横切工具。

### T5. 写 `docs/foundation/versioning.md` `[x]`

**负责人：** konglcxfs
**交付物：** Semver 政策 + `@xuexi/*` 发布 5 步流程
**验收：** 任意 commit 信息（fix:/feat:/BREAKING CHANGE:）可被套入规则。

### T6. 更新 `.bamboo/active.yaml` `[x]`

**负责人：** konglcxfs
**交付物：** `.bamboo/active.yaml` 设 `current: foundation-v2-docs-deepen`
**验收：** `grep current .bamboo/active.yaml` 返回
`current: foundation-v2-docs-deepen`。

### T7. 更新 `.bamboo/boards/foundation.yaml` + `.bamboo/index.yaml` `[x]`

**负责人：** konglcxfs
**交付物：** 两份文件追加本 change 的 `phase: verify` 行
**验收：** `grep foundation-v2-docs-deepen .bamboo/ -R` 返回 2 条命中。

---

## 任务级证据（保存在 `evidence/` 下）

- `evidence/git-ls-files.txt` —— `git ls-files` 对本 change 的新增 5 份 docs
  文件 + 1 份 `changes/archive/foundation-v2-docs-deepen/`（归档时刻）+ Bamboo
  状态更新的快照。
- `evidence/wordcount.txt` —— 5 份文件的 `wc -l` / `wc -w` 输出，证实文档
  不是空文件。
- `evidence/tests.md` —— 自证："仅文档类 change，跨文件 grep 验证术语
  表与代码命名一致性通过"。

## 归档前必须通过的验证

```bash
# 5 份新文件全部存在
ls docs/foundation/ | grep -E '^(project-glossary|naming-conventions|principles|stack-overview|versioning)\.md$' | wc -l
# 期望：5

# docs/foundation/ 总文件数（1 README + 5 新增 = 6）
ls docs/foundation/ | wc -l
# 期望：6

# 本 change 的 canonical 工件全部就位
ls changes/active/foundation-v2-docs-deepen/
# 期望：6 份文件 + 1 个 evidence/ 目录

# Bamboo 状态引用本 change
grep -r "foundation-v2-docs-deepen" .bamboo/ | wc -l
# 期望：3（active.yaml + foundation.yaml + index.yaml）

# 工作区干净
git status
# 期望：clean working tree
```

5 条断言全部通过 → 把 `changes/active/` 移到 `changes/archive/` → commit +
push → 归档完成。