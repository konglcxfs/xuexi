# 命名约定（naming-conventions）

> 4 类命名：文件名 / 包名 / 变量 / 数据库字段。**单条违反的代价** = 一次
> code review round-trip + 一次 grep 重命名。

## 一、文件名

### TypeScript 源码

- **kebab-case**：`learning-engine.ts`、`weakness-diagnostics.ts`
- 单文件 ≤ 200 行。超过则拆。
- **不**用下划线：`learning_engine.ts` ❌
- **不**用驼峰：`learningEngine.ts` ❌

### 目录

- **kebab-case**：`apps/knowledge-base/`、`packages/learning-engine/`
- **不**用驼峰：`learningEngine/` ❌
- **不**用下划线：`learning_engine/` ❌

### 测试文件

- 与被测文件同名 + `.test.ts` 后缀：`learning-engine.test.ts`
- E2E：`*.e2e.test.ts`（如 `plan-generator.e2e.test.ts`）

### 文档

- 全小写 + kebab-case：`project-glossary.md`、`cut-a-change.md`
- 序号文档（ADR 等）：`NNNN-short-title.md`：`0001-first-change.md`

## 二、包名

### 公开包（发布到 npm）

- **带 scope + kebab-case**：`@xuexi/shared`、`@xuexi/learning-engine`
- 内部使用 `@xuexi/`，外部 npm 用法保持一致
- **不**用驼峰：`@xuexi/LearningEngine` ❌
- **不**用下划线：`@xuexi/learning_engine` ❌

### 内部导入路径

- 与目录名严格一致：`import {...} from '@xuexi/learning-engine'`
- 不用相对路径跨 package：`import {...} from '../../../shared'` ❌

## 三、变量

### TypeScript 变量

| 类型 | 规则 | 正例 | 反例 |
|---|---|---|---|
| 普通变量 | camelCase | `userId`, `kpStability` | `user_id`, `kpstability` |
| 常量 | UPPER_SNAKE | `MAX_PLAN_DAYS`, `EBBINGHAUS_BASE` | `maxPlanDays` |
| 类 | PascalCase | `LearningEngine`, `PlanGenerator` | `learningEngine`（作为类名） |
| 接口 | PascalCase（无 `I` 前缀） | `KnowledgePoint`, `Plan` | `IKnowledgePoint` ❌ |
| 类型别名 | PascalCase | `MasteryLevel`, `UserId` | `masteryLevel` |
| 枚举 | PascalCase（成员也 PascalCase） | `Role.PrimarySchool` | `Role.PRIMARY_SCHOOL` |
| 泛型 | 单大写字母或 PascalCase | `T`, `TResult` | `t`, `result` |
| 布尔 | `is` / `has` / `can` 前缀 | `isMastered`, `hasPlan` | `mastered`（歧义） |
| React 组件 | PascalCase | `PlanPage`, `KpGraph` | `planPage`（作为组件名） |
| React Hook | `use` 前缀 | `usePlan`, `useMastery` | `getPlan`（不叫 hook） |
| 私有字段 | 前置下划线 | `_internalCache` | `internalCache`（无标识） |

### 函数

- camelCase 动词开头：`getUser`、`generatePlan`、`calculateStability`
- 不用 `getXxx` 当中有副作用：要用 `fetchUser`（从外部）或 `loadUser`（从缓存）

## 四、数据库字段

### SQLite / Prisma（`apps/api/prisma/schema.prisma`）

- **snake_case**：`user_id`、`kp_id`、`created_at`、`mastery_score`
- 表名**复数**：`users`、`knowledge_points`、`plans`、`exercises`
- 主键：`id`（不要带表名前缀）
- 外键：`<table_singular>_id`：`user_id`、`kp_id`
- 时间戳：`created_at` / `updated_at` / `deleted_at`（软删）
- 布尔：`is_<adj>` / `has_<noun>`：`is_active`、`has_plan`

### JSON 字段（DB 内部存的 JSON blob）

- 字段名 snake_case：`meta_data`、`plan_payload`
- JSON 内**也**用 snake_case：`{"stability_score": 0.7}`

## 五、API 路由

- **复数资源 + kebab-case**：`/api/users`、`/api/knowledge-points`、
  `/api/learning-plans`
- 单数资源**仅在子资源**场景：`/api/users/:userId/profile`
- 动词**仅在动作端点**：`/api/plans/:id/recompute` ✅
  `/api/computePlan` ❌

## 六、Commit 信息

格式：

```text
<type>(<scope>): <subject>

<body>

<footer>
```

- type：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf`
- scope：组件名或目录名：`feat(api)` / `docs(foundation)`
- subject：**中文** ≤ 50 字；首字**不**大写；末尾**不**加句号
- body：解释**为什么**，每行 ≤ 72 字
- footer：BREAKING CHANGE / Refs / Closes

正例：

```text
feat(learning-engine): 加稳定性重算调度

之前稳定性只在用户主动复习时更新。
本次新增每日凌晨批跑，确保长时间未活跃用户的稳定性也及时衰减。

Refs: docs/foundation/principles.md#原则-3
```

反例：

```text
update code              ❌ type 不规范
feat: add new feature    ❌ scope 缺失
feat(learning-engine): Add new feature.  ❌ 英文 + 句号
```

## 七、违背命名约定的处理

1. **lint 阶段拦截**：`eslint-plugin-import` 验证包名
2. **CI 阶段拦截**：`tsc --noEmit` 验证类型命名
3. **Review 阶段拦截**：违反上述 4 类的 PR 标记 `request-changes`
4. **历史命名**：通过 `git mv` + 一次专门 PR 改；不混在 feature PR 里
