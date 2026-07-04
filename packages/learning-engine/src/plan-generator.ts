import type {
  KnowledgePoint,
  LearningPlan,
  MasteryState,
  PlanDay,
  PlanTask,
  RoleType,
} from '@xuexi/shared'
import { KnowledgeGraph } from './knowledge-graph'
import { MasteryEngine } from './mastery-engine'

/**
 * 计划生成器 —— 引擎根据"薄弱点 + 即将遗忘的复习任务 + 知识图谱的依赖顺序"
 * 自动产出多日的学习计划。
 *
 * 关键约束：
 *  - 每一天的总时间不超过一个上限（默认 60 分钟）
 *  - 优先安排：复习将忘点 > 弱项补强 > 新内容前推
 *  - 不破坏拓扑序：没掌握前置时，新内容不会先于前置
 */
export interface PlanGeneratorOptions {
  graph: KnowledgeGraph
  role: RoleType
  /** 每天学习总时长上限（分钟） */
  dailyMinutes?: number
  /** 计划总天数 */
  totalDays?: number
  /** 一天最多安排几个任务 */
  maxTasksPerDay?: number
}

interface PlanInput {
  userId: string
  states: MasteryState[]
  /** 用户的总目标（自由文本），例如"两周内把分数章节搞定" */
  goal: string
  /** 起点：从哪个知识点开始往前推（默认从拓扑首节点开始） */
  startFromId?: string
  dailyMinutes?: number
  totalDays?: number
}

export class PlanGenerator {
  private opts: Required<PlanGeneratorOptions>

  constructor(opts: PlanGeneratorOptions) {
    this.opts = {
      graph: opts.graph,
      role: opts.role,
      dailyMinutes: opts.dailyMinutes ?? 60,
      totalDays: opts.totalDays ?? 14,
      maxTasksPerDay: opts.maxTasksPerDay ?? 4,
    }
  }

  /**
   * 生成计划 —— 主入口
   */
  generate(input: PlanInput): LearningPlan {
    if (input.dailyMinutes) this.opts.dailyMinutes = input.dailyMinutes
    if (input.totalDays) this.opts.totalDays = input.totalDays
    const statesById = new Map(input.states.map((s) => [s.knowledgePointId, s]))

    const tasks: Array<{ task: PlanTask; priority: number }> = []

    // 1) 复习：所有需要复习的点（按稳定性升序 = 最易遗忘优先）
    const dueReviews = input.states
      .map((s) => ({ s, due: MasteryEngine.nextReviewAt(s) }))
      .filter((x) => x.due.getTime() <= addDays(new Date(), 1).getTime())
      .sort((a, b) => a.due.getTime() - b.due.getTime())

    for (const { s } of dueReviews) {
      const kp = this.opts.graph.get(s.knowledgePointId)
      if (!kp) continue
      tasks.push({
        task: this.makeTask(kp, 'review', `复习《${kp.title}》`, `掌握度 ${(s.mastery * 100).toFixed(0)}%，建议快速回顾核心定义并做 3 道诊断题。`),
        priority: 100 - s.mastery * 50,
      })
    }

    // 2) 弱项补强：薄弱点（按掌握度升序）
    const weak = input.states
      .filter((s) => s.mastery < 0.7)
      .sort((a, b) => a.mastery - b.mastery)

    for (const s of weak) {
      const kp = this.opts.graph.get(s.knowledgePointId)
      if (!kp) continue
      tasks.push({
        task: this.makeTask(kp, 'practice', `强化《${kp.title}》`, `掌握度偏低（${(s.mastery * 100).toFixed(0)}%）。先复述概念，再做 5 道变式题。`),
        priority: 80 - s.mastery * 100,
      })
    }

    // 3) 新内容前推：从起点出发按拓扑序遍历尚未掌握的节点
    const order = this.opts.graph.topologicalOrder()
    const startIdx = input.startFromId
      ? Math.max(0, order.findIndex((k) => k.id === input.startFromId))
      : 0
    const upcoming = order.slice(startIdx)
    for (const kp of upcoming) {
      const s = statesById.get(kp.id)
      // 已经掌握的跳过
      if (s && s.mastery >= 0.85) continue
      // 前置没掌握？先标记为 explain 任务
      const prereqs = this.opts.graph.prerequisitesOf(kp.id)
      const prereqWeak = prereqs.some(
        (p) => (statesById.get(p.id)?.mastery ?? 0) < 0.6
      )
      tasks.push({
        task: this.makeTask(
          kp,
          prereqWeak ? 'explain' : 'learn',
          prereqWeak ? `先理解《${kp.title}》的前置依赖` : `学习《${kp.title}》`,
          prereqWeak
            ? '前置依赖尚薄弱，请先复习前置再进入本节。'
            : '先看核心定义，让 AI 用例题讲解，再做 5 道基础题。'
        ),
        priority: 30 - kp.difficulty * 10,
      })
    }

    // 4) 把任务按天切分
    const days = this.packIntoDays(tasks)

    return {
      id: crypto.randomUUID(),
      userId: input.userId,
      role: this.opts.role,
      title: this.titleFor(input.goal, input.states),
      createdAt: new Date().toISOString(),
      days,
      currentDayIndex: 0,
      goal: input.goal,
    }
  }

  private makeTask(
    kp: KnowledgePoint,
    kind: PlanTask['kind'],
    title: string,
    description: string
  ): PlanTask {
    return {
      id: crypto.randomUUID(),
      knowledgePointId: kp.id,
      kind,
      title,
      description,
      estimateMinutes:
        kind === 'review' ? 8 : kind === 'explain' ? 12 : kind === 'practice' ? 18 : 20,
      status: 'pending',
    }
  }

  /**
   * 把任务数组按天切片，控制每天的总分钟数和任务数。
   */
  private packIntoDays(items: Array<{ task: PlanTask; priority: number }>): PlanDay[] {
    const sorted = items.sort((a, b) => b.priority - a.priority)
    const days: PlanDay[] = []
    let bufferMin = 0
    let dayIdx = 0
    let date = new Date()
    let dayTasks: PlanTask[] = []
    const pushDay = () => {
      if (dayTasks.length === 0) return
      const total = dayTasks.reduce((a, t) => a + t.estimateMinutes, 0)
      const theme = deriveTheme(dayTasks, this.opts.graph)
      days.push({
        index: days.length + 1,
        date: date.toISOString().slice(0, 10),
        theme,
        estimatedMinutes: total,
        tasks: dayTasks,
        rationale: `按"${theme}"组织：优先处理即将遗忘和掌握度低的知识点。`,
      })
    }
    for (const { task } of sorted) {
      if (dayTasks.length >= this.opts.maxTasksPerDay || bufferMin + task.estimateMinutes > this.opts.dailyMinutes) {
        pushDay()
        dayTasks = []
        bufferMin = 0
        dayIdx++
        date = addDays(new Date(), dayIdx)
      }
      dayTasks.push(task)
      bufferMin += task.estimateMinutes
    }
    pushDay()
    return days.slice(0, this.opts.totalDays)
  }

  private titleFor(goal: string, states: MasteryState[]): string {
    const weak = states.filter((s) => s.mastery < 0.6).length
    return goal || (weak > 0 ? `薄弱点补强计划（${weak} 项）` : '持续提升学习计划')
  }
}

function deriveTheme(tasks: PlanTask[], graph: KnowledgeGraph): string {
  if (tasks.length === 0) return '休息日'
  const titles = tasks.map((t) => graph.get(t.knowledgePointId)?.title).filter(Boolean) as string[]
  if (titles.length === 1) return titles[0]!
  if (titles.length <= 3) return titles.join(' / ')
  return `${titles[0]} / ${titles[1]} / 等共 ${titles.length} 个主题`
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}
