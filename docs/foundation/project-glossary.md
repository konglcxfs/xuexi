# 项目术语表（project-glossary）

> 跨组件使用的核心术语。**单组件内部**术语不进此表；放各组件
> 的 `docs/architecture/*.md` 即可。

## 一、领域对象（5 个核心名词）

| 中文 | 英文 | 定义 | 常见反例 |
|---|---|---|---|
| 知识点 | Knowledge Point（KP） | 学习图谱的一个最小单元；有唯一 ID；可能有前置依赖 | 把"整章"当 KP（粒度太粗） |
| 掌握度 | Mastery | 学习者对某 KP 的稳定程度；三维度（讲解 / 应用 / 拓展）| 把"看了几遍"当掌握度 |
| 练习 | Exercise | 验证某 KP 掌握度的一道题；与 KP 是 N:1 | 把"阅读"当练习 |
| 证据 | Evidence | 任何能反映掌握度变化的可追溯记录 | 不可重放的"我学会了" |
| 计划 | Plan | 一段时间内要完成的 KP 序列，按日切片 | 把"每天学 10 个 KP"当计划 |

## 二、状态与算法（6 个）

| 中文 | 英文 | 定义 | 常见反例 |
|---|---|---|---|
| 遗忘曲线 | Ebbinghaus Curve | 掌握度随时间衰减的函数；`M(t) = M₀ × 0.7^(elapsedDays / stability)` | 改成指数衰减（参数难调） |
| 稳定性 | Stability | 某 KP 在学习者记忆中的半衰期，单位：天 | 把"学得熟不熟"当 stability |
| 薄弱点 | Weakness | 诊断出"近期错"或"长时间未巩固"的 KP 集合 | 把"不喜欢"当薄弱点 |
| 类比题 | Analog Exercise | 与原题思路相同但场景不同的题；用于跨场景迁移 | 仅换数字的"假类比" |
| 串联 | Knowledge Linker | 在 2 个 KP 之间识别"前置 / 反向 / 共享前置"的关系 | 把"主题相似"当串联 |
| 长期记忆 | Long-Term Memory (LTM) | 把短期对话中被反复引用的事实蒸馏到 KP 系统 | 把每次对话都"记下来" |

## 三、系统与组件（8 个）

| 中文 | 英文 | 定义 | 常见反例 |
|---|---|---|---|
| AI Provider | AI Provider | 抽象大模型调用；本地 stub / 远程 OpenAI-兼容协议 | 把模型名硬编码到业务代码 |
| 角色模型 | Role Model | 限定 AI 行为的人设（如 `primary_school` / `ruankao`）| 把"system prompt"和"角色模型"混用 |
| Prompt 风格轴 | Prompt Style Axis | 角色模型的多维参数：语气 / 详略 / 引导式 vs. 直答 | 把"是否骂人"当轴 |
| 学习引擎 | Learning Engine | 产出 plan / 诊断 weakness / 计算 stability 的纯函数包 | 把数据库读写塞进引擎 |
| 知识库 | Knowledge Base | 某角色（小学 / 软考）的 KP 集合 + 关系 + 题目 | 把所有角色的 KP 混在一起 |
| 共享包 | Shared Package | `@xuexi/shared`，被多个 app 引用的小工具 / 类型 | 跨 app 的业务逻辑 |
| 工作区 | Workspace | 当前用户登录后的全部学习数据 | 跨用户共享的数据 |
| 仪表盘 | Dashboard | 用户首次登录看到的主面板 | "课程列表页" |

## 四、工作流（4 个）

| 中文 | 英文 | 定义 | 常见反例 |
|---|---|---|---|
| 引导期 | Bootstrap | 仓库从空到有 1 个归档 change 之间的状态 | 把"功能没做完"叫引导期 |
| Change | Change | 一次完整的开发周期：open → design → build → verify → archive | 把"一次 commit"叫 change |
| 归档 | Archive | change 走完 verify 后被移到 `changes/archive/` | 把"删 commit"叫归档 |
| 工作树 | Worktree | 多 worktree 仓库中，每个分支对应一个独立目录 | 把"git branch"叫 worktree |

## 五、质量用语（5 个）

| 中文 | 英文 | 定义 | 常见反例 |
|---|---|---|---|
| 冒烟测试 | Smoke Test | 不验证深度，只验证"能跑起来"的最小测试 | 把单元测试叫冒烟测试 |
| 类型检查 | Typecheck | `tsc --noEmit`，验证类型 | 把"build 通过"当类型检查 |
| 评估证据 | Evaluation Evidence | change 归档前必须留存的"我做了这件事"的工件 | 写"我觉得做了" |
| 不变式 | Invariant | 任何时候都必须成立的属性 | 把"现在的状态"当不变式 |
| 阻断 | Blocking | 测试 / lint / typecheck 失败，禁止合并 | "可以等下次再修" |

## 六、本仓库专有（2 个）

| 中文 | 英文 | 定义 |
|---|---|---|
| Comet 变更 | Comet Change | Comet 工作流管理的单次开发周期；本文档体系就是为它服务的 |
| Bamboo 控制面 | Bamboo Control Plane | `.bamboo/` 目录下的所有 yaml；定义 boards / policies / index |

---

## 维护规则

- 新术语加入：**先写文档，再写代码**。`docs/foundation/project-glossary.md`
  没收录的词不应出现在代码命名里。
- 删除术语：把"已删除"作为状态保留一年，再物理删除。
- 改名：用 git rename + 一条 ADR 说明为什么改。
- 翻译：中英文名**双向**有效。代码内用英文、UI 字符串用中文。
