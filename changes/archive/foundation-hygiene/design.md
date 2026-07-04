# foundation-hygiene —— 设计

## 范围边界

本 change 是一个**文档 / 元工件 change**，不是代码 change。
`changes/archive/`（历史，已 git 追踪）和 `changes/active/`
（每个 worktree 私有，已 gitignore）的严格分离，是承担负载的设计决定。
理由详见 `decisions.md`。

### 各路径住在哪里

| 路径 | git 追踪？ | 由谁写入 | 用途 |
|---|---|---|---|
| `changes/archive/<id>/` | **是** | 通过 PR 合并 | 每次变更的历史记录 |
| `changes/active/<id>/` | **否**（已 gitignore） | 每个 worktree 私有 | 一次 change 期间的 WIP 工件 |
| `.bamboo/boards/<name>.yaml` | **是** | 通过 PR 合并 | 板状态 —— 哪个 change 在哪一列 |
| `.bamboo/index.yaml` | **是** | 通过 PR 合并 | 跨所有 change 的全局聚合索引 |
| `.bamboo/active.yaml` | **是** | 本地 + 提交 | 在**本次提交**里"活动"的是哪个 change |
| `docs/**` | **是** | 通过 PR 合并 | 权威的人类可读文档 |

### 为什么 .bamboo 有两份状态文件（`index.yaml` + `boards/<name>.yaml`）

- `index.yaml` 等价于项目级的 `git log` —— 所有变更的总览。
- `boards/<name>.yaml` 是按板反范式化：今天每个 change 处于哪一列
  （open / design / build / verify / archive）。

板文件是 `comet status` 渲染仪表盘时要读的；索引文件是 `comet log --all`
要读的。两者并存是因为它们服务于不同的查询形态。

## 文档分类法

`docs/` 镜像 Bamboo `project.yaml` 的 `structure.docs.*` 字段。一共 6
个目录，各有各的职责：

```
docs/
├── foundation/    # 项目级不变式（清单、术语、命名、原则、版本）
├── architecture/  # 组件、数据流、schema、API 表面、进程模型、Provider 抽象
├── workflows/     # 怎么干：bootstrap、开发、打包、迁移、发布
├── decisions/     # 编号 ADR / TDR —— 解释"为什么"
├── domain/        # 教学法模型：知识点、掌握度、计划、薄弱点、串联
└── operations/    # 部署、可观测、扩容、灾备、密钥管理
```

每个 `docs/<area>/README.md` 都声明三件事：(a) 这里**放什么**、(b) 这里**不**
放什么、(c) 与邻居的交叉链接。这个分类法本身是本次 change 的主要交付物之一。

## 本次 change 的磁盘布局

```
changes/archive/foundation-hygiene/
├── manifest.yaml          ← Bamboo 第一个读；身份卡
├── proposal.md            ← 为什么要做（人类语言）
├── design.md              ← 怎么设计布局（本文件）
├── tasks.md               ← 作者本人的分步清单
├── decisions.md           ← 编号选择日志（ADR）
├── output-map.yaml        ← 文件级映射：哪个输出对应哪个目标
└── evidence/
    ├── tests.md           ← 空模板 —— 文档类 change 无测试
    └── git-ls-files.txt   ← 快照：证明全部文件已追踪
```

## 提交什么、忽略什么

为使本次 change 自包含，**`changes/archive/foundation-hygiene/` 下所有内容**
都进 git——`evidence/` 也包括。（`evidence/` 一般是每次运行的临时目录，但
对于一份"已归档、已冻结"的 change，我们保留一份快照以便日后核查。）

`docs/` 整体加入——6 个子目录 + 各自一个 README。