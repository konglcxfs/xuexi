/**
 * DailyPlanEngine —— 每日计划块生成器（Phase 1 升级版）。
 *
 * 5 源调度（按优先级插队，每个 30 分钟桶）：
 *   1. Goal 紧迫      (kind=practice, 来自 ParentGoal.metric 展开的 KP)
 *   2. Curriculum      (kind=learn,   来自 ParentCurriculum.scope 展开的 KP)
 *   3. Review 到期     (kind=review,  来自 MasteryForest.schedule, projected < 0.6)
 *   4. 薄弱 KP         (kind=learn,   来自 WeaknessDiagnostics.topWeak)
 *   5. 预习下一个      (kind=preview, 来自知识图谱 prerequisites 已学完但 KP 未学的 KP)
 *
 * 设计原则：
 *   - 不破坏旧 PlanGenerator —— 这是独立的 DailyPlanBlock 生成器
 *   - 输入是纯数据 + 函数引用，方便单测
 *   - 输出 DailyPlanBlock[]（不含 done / doneAt，由调用方落库后再回填）
 *
 * 调用方式：
 *   const blocks = engine.generate({
 *     userId, today, dailyBudgetMinutes, subjectId,
 *     knowledgePoints, masteryStates, weakness,
 *     resolved: { curriculums, goals, kpPool }
 *   })
 */

import type {
  KnowledgePoint,
  DailyPlanBlock,
  DailyPlanBlockKind,
  DailyPlanBlockSourceRef,
  MasteryState,
} from '@xuexi/shared'
import { predictForgetting } from './mastery-forest'
import type { ResolvedCurriculum, ResolvedGoal } from './curriculum-goal-resolver'

export interface DailyPlanInput {
  userId: string
  subjectId: string
  today: string                          // YYYY-MM-DD
  dailyBudgetMinutes: number            // 用户今日总预算
  knowledgePoints: KnowledgePoint[]
  masteryStates: MasteryState[]         // 用户的 MasteryState 列表
  weakness?: { topWeak: Array<{ knowledgePointId: string; mastery: number; reason: string }> }
  resolved: {
    curriculums: ResolvedCurriculum[]
    goals: ResolvedGoal[]
  }
}

interface BlockDraft {
  kind: DailyPlanBlockKind
  title: string
  knowledgePointIds: string[]
  minutes: number
  reason: string
  sourceRef: DailyPlanBlockSourceRef
}

/** 一个 30 分钟桶 */
const BLOCK_MINUTES = 30

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 5 源调度。
 * 返回 N 个 DailyPlanBlock，按优先级填满 dailyBudgetMinutes。
 */
export function planDay(input: DailyPlanInput): DailyPlanBlock[] {
  const { userId: _userId, subjectId, today, dailyBudgetMinutes, knowledgePoints, masteryStates, weakness, resolved } = input
  const kpById = new Map(knowledgePoints.map(k => [k.id, k]))

  const blocks: BlockDraft[] = []
  const usedKpIds = new Set<string>()
  let remaining = dailyBudgetMinutes

  // 已用分钟数跟踪 —— 每个 BlockDraft 是 30 分钟块
  const pushBlock = (draft: BlockDraft) => {
    blocks.push(draft)
    for (const id of draft.knowledgePointIds) usedKpIds.add(id)
    remaining -= BLOCK_MINUTES
  }

  // ====== 1. Goal 紧迫（按 urgency 倒序）======
  const goalsByUrgency = [...resolved.goals].sort((a, b) => b.urgency - a.urgency)
  for (const g of goalsByUrgency) {
    if (remaining < BLOCK_MINUTES) break
    const ids = g.knowledgePointIds.filter(id => kpById.has(id) && !usedKpIds.has(id))
    if (ids.length === 0) continue
    pushBlock({
      kind: 'practice',
      title: `目标冲刺：${g.goal.title}`,
      knowledgePointIds: ids.slice(0, 1),
      minutes: BLOCK_MINUTES,
      reason: `距 deadline ${g.goal.deadline.slice(0, 10)}，紧迫度 ${(g.urgency * 100).toFixed(0)}%`,
      sourceRef: { kind: 'goal', refId: g.goal.id, label: g.goal.title },
    })
  }

  // ====== 2. Curriculum（按 priority 倒序）======
  const curByPriority = [...resolved.curriculums].sort((a, b) => b.priority - a.priority)
  for (const c of curByPriority) {
    if (remaining < BLOCK_MINUTES) break
    const ids = c.knowledgePointIds.filter(id => kpById.has(id) && !usedKpIds.has(id))
    if (ids.length === 0) continue
    // 课程今日只出 1 个新 KP（深度学习优先）
    const kp = kpById.get(ids[0]!)
    pushBlock({
      kind: 'learn',
      title: `课程：${c.curriculum.title} · ${kp?.title ?? ids[0]}`,
      knowledgePointIds: [ids[0]!],
      minutes: BLOCK_MINUTES,
      reason: `家长指定课程，今日 priority=${c.priority.toFixed(2)}`,
      sourceRef: { kind: 'curriculum', refId: c.curriculum.id, label: c.curriculum.title },
    })
  }

  // ====== 3. Review 到期（间隔重复，projected < 0.6）======
  const reviewNeeded = masteryStates
    .filter(s => {
      const days = (Date.parse(today + 'T00:00:00') - Date.parse(s.lastReviewedAt)) / 86_400_000
      const projected = predictForgetting(s.mastery, s.stability, days)
      return projected < 0.6 && !usedKpIds.has(s.knowledgePointId)
    })
    .sort((a, b) => {
      const da = (Date.parse(today + 'T00:00:00') - Date.parse(a.lastReviewedAt)) / 86_400_000
      const db = (Date.parse(today + 'T00:00:00') - Date.parse(b.lastReviewedAt)) / 86_400_000
      const pa = predictForgetting(a.mastery, a.stability, da)
      const pb = predictForgetting(b.mastery, b.stability, db)
      return pa - pb
    })

  // 复习：每 2 个 KP 合成一个 block
  for (let i = 0; i < reviewNeeded.length && remaining >= BLOCK_MINUTES; i += 2) {
    const pair = reviewNeeded.slice(i, i + 2)
    const ids = pair.map(s => s.knowledgePointId)
    const titles = ids.map(id => kpById.get(id)?.title ?? id).join(' / ')
    pushBlock({
      kind: 'review',
      title: `复习：${titles}`,
      knowledgePointIds: ids,
      minutes: BLOCK_MINUTES,
      reason: '按遗忘曲线到期，建议今日巩固',
      sourceRef: { kind: 'review', refId: 'forest', label: '间隔重复' },
    })
  }

  // ====== 4. 薄弱 KP（来自 WeaknessDiagnostics）======
  if (weakness) {
    const weak = weakness.topWeak
      .filter(w => !usedKpIds.has(w.knowledgePointId))
      .sort((a, b) => a.mastery - b.mastery)
    for (const w of weak) {
      if (remaining < BLOCK_MINUTES) break
      const kp = kpById.get(w.knowledgePointId)
      if (!kp) continue
      pushBlock({
        kind: 'learn',
        title: `突破薄弱：${kp.title}`,
        knowledgePointIds: [w.knowledgePointId],
        minutes: BLOCK_MINUTES,
        reason: w.reason || `掌握度 ${(w.mastery * 100).toFixed(0)}% 偏低`,
        sourceRef: { kind: 'weakness', refId: w.knowledgePointId, label: kp.title },
      })
    }
  }

  // ====== 5. 预习下一个（predecessors 已学但本身未学的 KP）======
  if (remaining >= BLOCK_MINUTES) {
    const previewKp = pickPreviewKp(knowledgePoints, masteryStates, usedKpIds)
    if (previewKp) {
      pushBlock({
        kind: 'preview',
        title: `预习：${previewKp.title}`,
        knowledgePointIds: [previewKp.id],
        minutes: BLOCK_MINUTES,
        reason: '前置知识已掌握，先预习再深入',
        sourceRef: { kind: 'preview', refId: previewKp.id, label: previewKp.title },
      })
    }
  }

  // ====== 输出（把 Draft 转成 DailyPlanBlock）======
  const now = new Date().toISOString()
  const result: DailyPlanBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    result.push({
      id: genId(`block-${today}-${i}`),
      date: today,
      userId: input.userId,
      subjectId,
      kind: b.kind,
      title: b.title,
      knowledgePointIds: b.knowledgePointIds,
      estimatedMinutes: b.minutes,
      reason: b.reason,
      sourceRef: b.sourceRef,
      done: false,
      resourceRefs: [],
      createdAt: now,
    })
  }
  return result
}

/**
 * 挑一个预习 KP：
 *   - 自身 mastery 低（说明没学过）
 *   - 所有 prerequisites 的 mastery ≥ 0.6（说明能学）
 *   - 不在 usedKpIds 里
 *   - 优先选 prerequisites 多的（说明是"进阶内容"）
 */
function pickPreviewKp(
  kps: KnowledgePoint[],
  states: MasteryState[],
  used: Set<string>
): KnowledgePoint | null {
  const masteryByKp = new Map<string, number>()
  for (const s of states) masteryByKp.set(s.knowledgePointId, s.mastery)
  const candidates = kps
    .filter(k => !used.has(k.id) && (masteryByKp.get(k.id) ?? 0) < 0.4)
    .filter(k => k.prerequisites.every(p => (masteryByKp.get(p) ?? 0) >= 0.6))
    .sort((a, b) => b.prerequisites.length - a.prerequisites.length)
  return candidates[0] ?? null
}

export class DailyPlanEngine {
  /**
   * 生成今日计划块（直接返回 DailyPlanBlock[]）。
   * 持久化由调用方负责（落库到 daily_plan_blocks 表）。
   */
  generate(input: DailyPlanInput): DailyPlanBlock[] {
    return planDay(input)
  }
}

export const defaultDailyPlanEngine = new DailyPlanEngine()