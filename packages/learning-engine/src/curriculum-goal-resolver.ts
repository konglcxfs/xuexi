/**
 * CurriculumGoalResolver —— 把"家长课程 / 目标"展开成可调度的 KP 范围。
 *
 * 引擎和数据库解耦：
 *   - 入参是 repo 函数（任意数据源，本地 / 远程 / 内存 mock 都能跑）
 *   - 出参是"今日候选 KP 池" + 调度元数据
 *
 * 这是 DailyPlanEngine 的前置：先解析、再调度。
 */

import type {
  KnowledgePoint,
  ParentCurriculum,
  ParentCurriculumScope,
  ParentGoal,
} from '@xuexi/shared'

export interface ResolvedCurriculum {
  curriculum: ParentCurriculum
  /** 此课程今日涉及的目标 KP（已展开 scope） */
  knowledgePointIds: string[]
  /** 课程在今日可用分钟数（来自 schedule.dailyMinutes） */
  dailyMinutes: number
  /** 优先级（0-1） */
  priority: number
}

export interface ResolvedGoal {
  goal: ParentGoal
  /** 目标涉及的 KP（展开 metric） */
  knowledgePointIds: string[]
  /** 紧迫度 0-1：1 = 今天 deadline；越远越小 */
  urgency: number
  /** 该目标要求"今日至少分配几分钟"（用于调度） */
  dailyMinutesHint: number
}

export interface ResolverInput {
  userId: string
  /** 用于展开 scope 的全量 KP 池 */
  knowledgePoints: KnowledgePoint[]
  /** 家长课程（已按 status + 时间窗过滤） */
  curriculums: ParentCurriculum[]
  /** 家长目标（已按 status 过滤） */
  goals: ParentGoal[]
  /** 当前日期（YYYY-MM-DD） */
  today: string
  /** 距离 deadline 剩余天数，会影响 urgency */
  now?: Date
}

export interface ResolverOutput {
  curriculums: ResolvedCurriculum[]
  goals: ResolvedGoal[]
  /**
   * 合并去重后所有"今日该学"的 KP id 池
   * （不含 review/weakness/preview 这些引擎已有来源）
   */
  kpPool: Set<string>
}

/**
 * 把 ParentCurriculum.scope 展开成具体 KP id 列表。
 */
export function expandScope(scope: ParentCurriculumScope, kps: KnowledgePoint[]): string[] {
  switch (scope.kind) {
    case 'full_subject':
      return kps.map(k => k.id)
    case 'kp_ids':
      return scope.knowledgePointIds.filter(id => kps.some(k => k.id === id))
    case 'kp_tags': {
      const wanted = new Set(scope.tags)
      return kps.filter(k => k.tags.some(t => wanted.has(t))).map(k => k.id)
    }
    case 'chapter': {
      // 约定：chapter = KP.code 的前缀，或者 KP.tags 里的 'chapter:xxx'
      // 这里用最宽松的策略：tags 含 chapter 名 或 code 以 chapter 开头
      const ch = scope.chapter
      return kps
        .filter(k => k.code.startsWith(ch) || k.tags.includes(`chapter:${ch}`))
        .map(k => k.id)
    }
  }
}

/**
 * 把 ParentGoal.metric 展开成具体 KP id 列表。
 */
export function expandGoalMetric(metric: ParentGoal['metric']): string[] {
  switch (metric.kind) {
    case 'mastery_threshold':
    case 'kp_coverage':
      return metric.knowledgePointIds
    case 'accuracy_threshold':
    case 'manual':
      return []
  }
}

/** 计算 urgency：1/(剩余天数+1) 上限，再归一化 */
export function computeUrgency(deadline: string, now: Date = new Date()): number {
  const ms = Date.parse(deadline) - now.getTime()
  const daysLeft = Math.max(0, ms / 86_400_000)
  // 1 天 = urgency 0.5；7 天 = 0.125；30 天 = 0.032
  // 过期（< 0）→ 1.0（强制插队）
  if (daysLeft <= 0) return 1.0
  return Math.min(1, 1 / (daysLeft + 1))
}

export function resolve(input: ResolverInput): ResolverOutput {
  const { curriculums, goals, knowledgePoints: kps } = input
  const today = input.today
  const now = input.now ?? new Date()

  const resolvedCurriculums: ResolvedCurriculum[] = []
  for (const c of curriculums) {
    // 时间窗 + weekday 过滤
    if (c.schedule.startDate > today || c.schedule.endDate < today) continue
    const weekday = new Date(today + 'T00:00:00').getDay()
    if (!c.schedule.weekdays.includes(weekday)) continue

    const ids = expandScope(c.scope, kps)
    if (ids.length === 0) continue

    resolvedCurriculums.push({
      curriculum: c,
      knowledgePointIds: ids,
      dailyMinutes: c.schedule.dailyMinutes,
      priority: c.priority,
    })
  }

  const resolvedGoals: ResolvedGoal[] = []
  for (const g of goals) {
    const ids = expandGoalMetric(g.metric)
    const urgency = computeUrgency(g.deadline, now)
    // 紧迫度高的目标 → 至少分配 15 分钟 / 天
    // 紧迫度低的 → 5 分钟 / 天（保持触达）
    const dailyMinutesHint = Math.round(5 + urgency * 20)
    resolvedGoals.push({
      goal: g,
      knowledgePointIds: ids,
      urgency,
      dailyMinutesHint,
    })
  }

  // 合并 KP 池
  const kpPool = new Set<string>()
  for (const c of resolvedCurriculums) {
    for (const id of c.knowledgePointIds) kpPool.add(id)
  }
  for (const g of resolvedGoals) {
    for (const id of g.knowledgePointIds) kpPool.add(id)
  }

  return {
    curriculums: resolvedCurriculums,
    goals: resolvedGoals,
    kpPool,
  }
}