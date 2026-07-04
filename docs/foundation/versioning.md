# 版本与发布（versioning）

> 两件事：**Semver 政策** + **`@xuexi/*` 包发布流程**。

## 一、Semver 政策

本仓库所有公开 npm 包（`@xuexi/shared`、`@xuexi/learning-engine` 等）
严格遵循 [SemVer 2.0.0](https://semver.org/)。本节是**应用层规则**。

### 何时 bump major（`X.0.0`）

- 删除**任何**公开导出的符号（类型、函数、类）
- 修改公开类型签名（参数类型不兼容 / 返回类型不兼容）
- 改变公开 API 的**语义**（同样的输入产生不同的输出）
- 移除 / 改名 React 组件的 prop

正例：

```text
// 之前
export function calculateStability(kp: KnowledgePoint): number

// 之后
export function calculateStability(
  kp: KnowledgePoint,
  options: { now?: Date } = {},
): number     // ← 新增可选参数不算 major

// 但如果改成这样 → major
export function calculateStability(
  kpId: string,    // ← 改参数类型，从 KP 对象改成字符串 ID
): number
```

### 何时 bump minor（`0.X.0`）

- **新增**公开导出的符号
- **新增** React 组件的 prop
- **新增**可选参数（带默认值）
- **新增** 端点
- **新增** KP / Exercise / 角色

### 何时 bump patch（`0.0.X`）

- bug 修复
- 内部重构（不改公开 API）
- 文档更新
- 性能优化（不改行为）
- 依赖升级（不引入新 API）

### Pre-release 标签

- `1.0.0-alpha.1` / `1.0.0-beta.2` / `1.0.0-rc.1`
- Pre-release **不**进 `latest` tag——用户必须显式 `pnpm add @xuexi/shared@next`

## 二、`@xuexi/*` 包发布 5 步流程

### 步骤 1：本地 prep

```bash
# 在 package 目录下
cd packages/shared

# 1.1 跑测试
pnpm test

# 1.2 跑 lint
pnpm lint

# 1.3 跑 typecheck
pnpm typecheck
```

### 步骤 2：决定 bump 类型

参照上一节。**不**确定时：

- 改了 `src/index.ts` 的 export？→ 看 major/minor 判定
- 只改 `src/internal/`？→ patch
- 不确定？→ patch + 写 ADR 解释

### 步骤 3：改 `package.json` + 改 CHANGELOG

```bash
# 用 pnpm 自带工具
pnpm version <major|minor|patch>

# 这会自动：
# - 改 package.json 的 version
# - 创建一个 git tag (vX.Y.Z)
# - 跑 `pnpm install` 刷新 lockfile
```

**手动**改 `CHANGELOG.md`，加一段：

```markdown
## X.Y.Z (YYYY-MM-DD)

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

### 步骤 4：commit + push

```bash
git add packages/shared/package.json packages/shared/CHANGELOG.md
git commit -m "chore(release): @xuexi/shared vX.Y.Z"
git push origin main --follow-tags
```

### 步骤 5：发包

```bash
# 在 package 目录下
cd packages/shared
pnpm publish --access public --no-git-checks
```

发布后检查：

- [npmjs.com/@xuexi/shared](https://www.npmjs.com/package/@xuexi/shared) 显示新版本
- GitHub release 自动创建（若配了 release-drafter）
- 下游 app 的 `pnpm install` 拉得到新版本

## 三、不发布的内部包

- `apps/api`、`apps/web`、`apps/desktop` **不**发到 npm。它们是部署
  单元（容器 / 安装包），不是库。
- `apps/api` 的 Prisma schema：作为 `apps/api` 的一部分随仓库发布；
  不单独发包。
- `docs/` 下任何 markdown：随仓库发布；不打包成文档站点发布。

## 四、版本号与 Git 提交的关系

- **每次发版 = 1 个 commit**。commit 信息固定为
  `chore(release): <package-name> vX.Y.Z`。
- **commit hash 写入 CHANGELOG** 的 footer：

  ```markdown
  ## 1.2.0 (2026-07-15)

  ...

  Refs: a1b2c3d
  ```

- 任何非 release 的 feature commit **不**带版本号。

## 五、回滚

- npm 不允许**删除**已发布版本（只能 unpublish 24h 内的新包，且有
  限制）。**回滚**用 2 种方式：

  1. **发 patch**：发现 bug → 立即 fix → 发 `X.Y.Z+1.patch`
  2. **deprecate**：在 npm 控制台标 `X.Y.Z` 为 deprecated，提示用户
     升到 `X.Y.Z+1`

```bash
npm deprecate @xuexi/shared@1.2.0 "请升级到 1.2.1；该版本存在 X bug"
```

## 六、变更日志（CHANGELOG）维护

- **每包独立**：`packages/shared/CHANGELOG.md`、
  `packages/learning-engine/CHANGELOG.md`。
- **不**写"根 CHANGELOG"——那会是 6 份文件重复内容。
- **格式**：Keep a Changelog（`Added / Changed / Fixed / Removed`）。
- **不**写 emoji；不写"🎉"；不写"各种感谢"。

## 七、发布前自检清单（CI 自动跑）

| 检查 | 命令 | 失败后果 |
|---|---|---|
| 测试 | `pnpm -r test` | 阻断发布 |
| 类型 | `pnpm -r typecheck` | 阻断发布 |
| Lint | `pnpm -r lint` | 阻断发布 |
| 构建 | `pnpm -r build` | 阻断发布 |
| 环依赖 | `madge --circular packages/` | 阻断发布 |
| 公开 API diff | `api-extractor compare` | 警告，不阻断 |
| 锁文件一致 | `pnpm install --frozen-lockfile` | 阻断发布 |
