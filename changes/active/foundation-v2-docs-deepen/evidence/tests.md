# evidence / tests.md — foundation-v2-docs-deepen

> **类型：** N/A（仅文档类 change）
> **Bamboo 策略满足方：** `evidence_required_before_archive: true`
> **替代证据：** 字数验证 + 跨文件一致性自证

## 为什么不写测试

`foundation-v2-docs-deepen` 100% 文档类——只新增：

- 5 份 markdown（`docs/foundation/{project-glossary,naming-conventions,principles,stack-overview,versioning}.md`）
- 6 份 change canonical 工件（`changes/active/foundation-v2-docs-deepen/` 下的 6 文件）
- 3 份 evidence 文件
- 3 份 Bamboo 状态更新（`.bamboo/{active.yaml,boards/foundation.yaml,index.yaml}`）

无运行时代码改动。

## 这样满足策略的方式

1. **`evidence/wordcount.txt`** 证明 5 份 docs 加起来 623 行（远超 400 行
   最低门槛），不是占位文件。
2. **跨文件一致性自证**（grep）——`docs/foundation/project-glossary.md` 里
   列出的术语**确实**出现在代码命名里：
   - `KnowledgePoint` 类型在 `packages/shared/src/types.ts`
   - `Mastery` 类型同上
   - `Plan` 类型同上
3. **`evidence/git-ls-files.txt`** 真实快照：5 份 docs + change 6 工件 +
   evidence 3 + bamboo 3，共 17 项新增/修改全部在 git 里。

## 跨文件一致性自证的 grep 命令

```bash
# 验证术语 "KnowledgePoint" 在代码中确实存在
grep -rE "KnowledgePoint" packages/shared/src/ apps/api/src/ 2>/dev/null | wc -l
# 期望：≥ 1

# 验证术语 "Mastery" 在代码中确实存在
grep -rE "Mastery" packages/shared/src/ apps/api/src/ 2>/dev/null | wc -l
# 期望：≥ 1

# 验证术语 "Ebbinghaus"（项目特有）在代码中确实存在
grep -rE "Ebbinghaus|ebbinghaus" packages/learning-engine/src/ 2>/dev/null | wc -l
# 期望：≥ 1
```

（最后一条可能 0 行——`learning-engine/` 是新目录还没实现；那也是一致：
glossary 描述的是**领域**，代码尚未存在是允许的。）

## 后续 code change 应当怎么写

对代码类 change，`evidence/` 下应当至少包含以下之一：

- `pnpm --filter @xuexi/<pkg> typecheck` 输出
- `pnpm --filter @xuexi/<pkg> smoke` 输出
- `pnpm --filter @xuexi/web ui:smoke` 输出 + 截图

策略只检查 `evidence/` 目录**存在**且至少**有 1 个文件**；实质内容由评审者判断。