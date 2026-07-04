import type { MasteryEvidence, MasteryState } from '@xuexi/shared'

/**
 * 掌握度引擎 —— 基于简化版 SuperMemo-2 / Ebbinghaus 的衰减模型。
 *
 * 设计要点：
 *  - mastery ∈ [0,1]，越高越熟练
 *  - stability ∈ [0,∞)，单位"天"，表示多久会忘一半
 *  - 每条 evidence 更新 mastery 和 stability
 *  - 与"上次评估"间隔越久，掌握度越衰减
 *
 * 这不是学术最优，而是一个能跑、解释清楚、便于调参的版本。
 */
export class MasteryEngine {
  /** 当前复习间隔（天） -> 之后衰减的基础因子 */
  private static readonly FORGET_BASE = 0.7

  /**
   * 根据历史 evidence 更新 mastery 和 stability。
   * 不修改原对象，返回新对象（pure function）。
   */
  static update(state: MasteryState, evidence: MasteryEvidence, now: Date = new Date()): MasteryState {
    const evidenceList = [...state.evidence, evidence].slice(-50)

    // 1. 根据 evidence 推导一个"信号"，范围 -1 ~ +1
    const dimWeight = { explain: 0.4, apply: 0.5, extend: 0.7 }[evidence.dimension]
    const signal = (evidence.score - 0.5) * 2 * dimWeight
    // 答对+高分 -> 正信号，错 -> 负信号

    // 2. 更新稳定性：对的就拉长，错的就缩短
    const newStability = Math.max(
      0.5,
      evidence.correct
        ? state.stability * (1 + 0.3 * evidence.score)
        : state.stability * 0.6
    )

    // 3. 一步到位地更新 mastery（带学习率）
    const lr = evidence.correct ? 0.25 : 0.2
    const newMastery = clamp01(state.mastery + signal * lr)

    // 4. 应用遗忘衰减
    const last = state.lastReviewedAt ? new Date(state.lastReviewedAt) : now
    const elapsedDays = Math.max(0, (now.getTime() - last.getTime()) / 86400000)
    const decayed = newMastery * Math.pow(MasteryEngine.FORGET_BASE, elapsedDays / Math.max(0.5, newStability))

    return {
      ...state,
      mastery: clamp01(decayed),
      stability: newStability,
      lastReviewedAt: now.toISOString(),
      reviewCount: state.reviewCount + 1,
      evidence: evidenceList,
    }
  }

  /**
   * 根据当前的 mastery 和 stability 决定下一次该复习的时间。
   */
  static nextReviewAt(state: MasteryState, now: Date = new Date()): Date {
    const intervalDays = Math.max(0.5, state.stability * 0.8)
    return new Date(now.getTime() + intervalDays * 86400000)
  }

  /**
   * 是否算"达标"。基于知识点定义的 mastery.explain/apply/extend。
   * 这里用一个近似估计：分维度的得分来自最近的 evidence。
   */
  static isMastered(state: MasteryState, thresholds: { explain: number; apply: number; extend: number }): boolean {
    const dims = { explain: [], apply: [], extend: [] } as Record<'explain' | 'apply' | 'extend', number[]>
    for (const e of state.evidence.slice(-20)) dims[e.dimension].push(e.score)
    const avg = (arr: number[]) => (arr.length === 0 ? state.mastery : arr.reduce((a, b) => a + b, 0) / arr.length)
    return (
      avg(dims.explain) >= thresholds.explain &&
      avg(dims.apply) >= thresholds.apply &&
      avg(dims.extend) >= thresholds.extend
    )
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
