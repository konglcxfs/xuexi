/**
 * MasteryForestEngine —— 用户知识体系（跨学科 MasteryForest + 巩固调度）
 *
 * 关键概念：
 *   - 一棵"学科树" = 一个学科 × 该学科知识图谱 × 该用户的所有 MasteryState
 *   - 巩固调度：按遗忘曲线自动算出"什么时候该复习哪个知识点"
 *   - 成长追踪：每隔一段时间打一个 growth snapshot
 *
 * 注意：和旧的 MasteryState / MasteryEvidence 兼容（不破坏现有 API）。
 */

import type {
  UserMasteryForest,
  SubjectMasteryTree,
  MasteryState,
  MasteryEvidence,
  GrowthSnapshot,
  ReviewScheduleItem,
  KnowledgePoint,
} from '@xuexi/shared'

export interface MasteryForestInput {
  userId: string
  subjectId: string
  graphId: string
  /** 该学科图谱的所有知识点 */
  knowledgePoints: KnowledgePoint[]
}

/**
 * Ebbinghaus 简化版：稳定性越强，遗忘时间越长。
 * stability = 1 天时，预计 24h 后掌握度下降到 ~0.4。
 */
export function predictForgetting(mastery: number, stabilityDays: number, daysSinceReview: number): number {
  const decay = Math.exp(-daysSinceReview / Math.max(stabilityDays, 0.1))
  return mastery * decay
}

/** 由一条 evidence 更新 mastery */
export function applyEvidence(state: MasteryState, ev: MasteryEvidence): MasteryState {
  // 1) 衰减：先把当前 mastery 衰减到"现在"
  const days = (Date.parse(ev.at) - Date.parse(state.lastReviewedAt)) / 86_400_000
  const current = predictForgetting(state.mastery, state.stability, days)

  // 2) 反馈：score 0-1，correct 二次加权
  const delta = (ev.score * (ev.correct ? 1 : 0.6) - 0.5) * 0.2
  const next = Math.max(0, Math.min(1, current + delta))

  // 3) 稳定性：答对 +0.2 天，答错 -0.3 天（保底 0.3）
  const stability = Math.max(0.3, state.stability + (ev.correct ? 0.2 : -0.3))

  return {
    ...state,
    mastery: next,
    stability,
    lastReviewedAt: ev.at,
    reviewCount: state.reviewCount + 1,
    evidence: [...state.evidence, ev].slice(-100), // 留最近 100 条
  }
}

export class MasteryForestEngine {
  private forests = new Map<string, UserMasteryForest>()

  ensureForest(input: MasteryForestInput): UserMasteryForest {
    let forest = this.forests.get(input.userId)
    if (!forest) {
      forest = { userId: input.userId, trees: [], updatedAt: new Date().toISOString() }
      this.forests.set(input.userId, forest)
    }
    let tree = forest.trees.find(t => t.subjectId === input.subjectId)
    if (!tree) {
      tree = {
        subjectId: input.subjectId,
        graphId: input.graphId,
        nodeStates: input.knowledgePoints.map(kp =>
          this.newState(input.userId, kp)
        ),
        growthHistory: [],
      }
      forest.trees.push(tree)
      forest.updatedAt = new Date().toISOString()
    }
    return forest
  }

  getForest(userId: string): UserMasteryForest | undefined {
    return this.forests.get(userId)
  }

  getTree(userId: string, subjectId: string): SubjectMasteryTree | undefined {
    return this.forests.get(userId)?.trees.find(t => t.subjectId === subjectId)
  }

  /** 用户答完一道题：更新对应学科树的对应节点 */
  ingestEvidence(userId: string, subjectId: string, knowledgePointId: string, ev: MasteryEvidence): MasteryState | undefined {
    const tree = this.getTree(userId, subjectId)
    if (!tree) return undefined
    const idx = tree.nodeStates.findIndex(n => n.knowledgePointId === knowledgePointId)
    if (idx < 0) return undefined
    const before = tree.nodeStates[idx]
    if (!before) return undefined
    tree.nodeStates[idx] = applyEvidence(before, ev)
    return tree.nodeStates[idx]
  }

  /** 拍一个成长快照 */
  snapshot(userId: string, subjectId: string): GrowthSnapshot | undefined {
    const tree = this.getTree(userId, subjectId)
    if (!tree) return undefined
    const total = tree.nodeStates.length
    const avg = total === 0 ? 0 : tree.nodeStates.reduce((s, n) => s + n.mastery, 0) / total
    const snap: GrowthSnapshot = {
      at: new Date().toISOString(),
      averageMastery: avg,
      masteredNodes: tree.nodeStates.filter(n => n.mastery >= 0.8).length,
      learningNodes: tree.nodeStates.filter(n => n.mastery >= 0.4 && n.mastery < 0.8).length,
      weakNodes: tree.nodeStates.filter(n => n.mastery < 0.4).length,
    }
    tree.growthHistory.push(snap)
    return snap
  }

  /** 巩固调度：找出"现在就该复习"的知识点 */
  schedule(userId: string, subjectId: string, now: Date = new Date()): ReviewScheduleItem[] {
    const tree = this.getTree(userId, subjectId)
    if (!tree) return []
    const items: ReviewScheduleItem[] = []
    for (const state of tree.nodeStates) {
      const days = (now.getTime() - Date.parse(state.lastReviewedAt)) / 86_400_000
      // 预计当前掌握度
      const projected = predictForgetting(state.mastery, state.stability, days)
      // 阈值 < 0.6 就要复习
      if (projected < 0.6) {
        items.push({
          userId,
          subjectId,
          knowledgePointId: state.knowledgePointId,
          scheduledFor: now.toISOString(),
          currentMastery: projected,
          suggestedMethodId: projected < 0.3 ? 'feynman' : 'active_recall',
          reason: 'forgetting',
        })
      }
    }
    return items.sort((a, b) => a.currentMastery - b.currentMastery)
  }

  private newState(userId: string, kp: KnowledgePoint): MasteryState {
    return {
      knowledgePointId: kp.id,
      userId,
      mastery: 0,
      stability: 1,
      lastReviewedAt: new Date(0).toISOString(),
      reviewCount: 0,
      evidence: [],
    }
  }
}

export const defaultMasteryForestEngine = new MasteryForestEngine()