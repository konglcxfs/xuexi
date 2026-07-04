import type {
  KnowledgePoint,
  MasteryState,
  RoleType,
  WeaknessReport,
} from '@xuexi/shared'
import { PromptBuilder, createProviderFromEnv } from '@xuexi/ai-adapter'
import { KnowledgeGraph } from './knowledge-graph'

type RootCause = 'prerequisite_gap' | 'concept_unclear' | 'practice_lack' | 'forgetting'

/**
 * 薄弱点诊断器 —— 把你过去答错的证据、当前掌握度、知识图谱的依赖关系
 * 一起拿来，输出可解释的薄弱点报告。
 *
 * 双轨：rule-based 先筛（避免 AI 漏掉明显情况） + LLM 二轮细化。
 */
export class WeaknessDiagnostics {
  private graph: KnowledgeGraph
  private role: RoleType
  private prompts: PromptBuilder

  constructor(opts: { graph: KnowledgeGraph; role: RoleType; prompts?: PromptBuilder }) {
    this.graph = opts.graph
    this.role = opts.role
    this.prompts = opts.prompts ?? new PromptBuilder()
  }

  /**
   * 规则层：先用本地规则把所有"明显薄弱"的点筛出来。
   */
  private ruleBasedWeakPoints(opts: {
    userId: string
    states: MasteryState[]
    threshold?: number
  }): Array<{
    kp: KnowledgePoint
    state: MasteryState
    rootCause: RootCause
    reason: string
  }> {
    const threshold = opts.threshold ?? 0.7
    const out: Array<{
      kp: KnowledgePoint
      state: MasteryState
      rootCause: RootCause
      reason: string
    }> = []
    for (const s of opts.states) {
      if (s.mastery >= threshold) continue
      const kp = this.graph.get(s.knowledgePointId)
      if (!kp) continue
      const root = this.inferRootCause(s, kp)
      out.push({ kp, state: s, rootCause: root.root, reason: root.reason })
    }
    return out.sort((a, b) => a.state.mastery - b.state.mastery)
  }

  /**
   * 推断薄弱"根因" —— 这是一个经验规则集合。
   */
  private inferRootCause(s: MasteryState, kp: KnowledgePoint): { root: RootCause; reason: string } {
    const recent = s.evidence.slice(-10)
    const wrongRate = recent.length === 0 ? 0 : recent.filter((e) => !e.correct).length / recent.length
    const explainAvg = avgScore(recent.filter((e) => e.dimension === 'explain'))
    const applyAvg = avgScore(recent.filter((e) => e.dimension === 'apply'))

    // 1) 前置依赖薄弱 -> prerequisite_gap
    const prereqs = this.graph.prerequisitesOf(kp.id)
    if (prereqs.some((p) => (s.evidence.find((e) => e.refId === p.id) ?? null) === null && p.difficulty <= kp.difficulty)) {
      // 仅当从未尝试过前置点的时候判定为前置薄弱
      const prereqState = prereqs.map((p) => p.id)
      const allEmpty = prereqState.every((pid) => !s.evidence.find((e) => e.refId === pid))
      if (allEmpty) return { root: 'prerequisite_gap', reason: '从未练习过前置知识点' }
    }

    // 2) 答得多但错得多 -> practice_lack
    if (s.reviewCount > 5 && wrongRate > 0.5) {
      return { root: 'practice_lack', reason: `最近 10 次中错了 ${Math.round(wrongRate * 100)}%` }
    }

    // 3) "讲不清" -> concept_unclear
    if (explainAvg !== null && explainAvg < 0.5 && applyAvg !== null && applyAvg > 0.6) {
      return { root: 'concept_unclear', reason: '能做对题但讲不清原理' }
    }

    // 4) 默认 forgetting
    if (!s.lastReviewedAt) return { root: 'practice_lack', reason: '尚未开始练习' }
    const days = (Date.now() - new Date(s.lastReviewedAt).getTime()) / 86400000
    if (days > 7) {
      return { root: 'forgetting', reason: `上次复习距今 ${days.toFixed(0)} 天，已遗忘` }
    }

    return { root: 'practice_lack', reason: '掌握度低于阈值，建议加强练习' }
  }

  /**
   * 顶层 API —— 跑诊断。
   *  - rule 层先出所有薄弱点
   *  - 选取 top N（默认 5）让 LLM 给出更精细的解释
   */
  async diagnose(opts: {
    userId: string
    states: MasteryState[]
    topN?: number
  }): Promise<WeaknessReport> {
    const ruleList = this.ruleBasedWeakPoints({ userId: opts.userId, states: opts.states })
    const top = ruleList.slice(0, opts.topN ?? 5)
    const provider = createProviderFromEnv()

      const weakPoints = await Promise.all(
      top.map(async (w) => {
        const ai = await this.aiDiagnose(w.kp, w.state, w.rootCause)
        return {
          knowledgePoint: w.kp,
          mastery: w.state.mastery,
          rootCause: ai?.rootCause ?? w.rootCause,
          remedy: ai?.remedy ?? this.fallbackRemedy(w.rootCause, w.kp),
        }
      })
    )

    const patterns = this.discoverPatterns(weakPoints)

    return {
      userId: opts.userId,
      role: this.role,
      generatedAt: new Date().toISOString(),
      weakPoints,
      patterns,
      summary: weakPoints.length === 0
        ? '本次诊断未发现明显薄弱点，继续保持复习节奏。'
        : `当前有 ${weakPoints.length} 个薄弱点，建议优先补强：${weakPoints.slice(0, 3).map((w) => w.knowledgePoint.title).join('、')}。`,
    }
  }

  private async aiDiagnose(
    kp: KnowledgePoint,
    s: MasteryState,
    fallbackRoot: RootCause
  ): Promise<{ rootCause?: RootCause; remedy?: string[] } | null> {
    if (process.env.XUEXI_AI_API_KEY === undefined) {
      // 本地模式直接走规则 fallback
      return null
    }
    try {
      const systemPrompt = this.prompts.buildWeaknessDiagnosisPrompt({
        role: this.role,
        knowledgePoint: kp,
        mastery: s.mastery,
        evidences: s.evidence.map((e) => ({
          at: e.at,
          correct: e.correct,
          score: e.score,
          feedback: e.feedback,
        })),
      })
      const provider = createProviderFromEnv()
      const resp = await provider.chat({
        messages: [
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: '请诊断',
            knowledgePointRefs: [kp.id],
            at: new Date().toISOString(),
          },
        ],
        systemPrompt,
        jsonMode: true,
      })
      const parsed = safeJson(resp.content) as { rootCause?: RootCause; remedy?: unknown } | null
      if (!parsed) return null
      return {
        rootCause: parsed.rootCause ?? fallbackRoot,
        remedy: Array.isArray(parsed.remedy) ? parsed.remedy.map(String) : undefined,
      }
    } catch {
      return { rootCause: fallbackRoot }
    }
  }

  private fallbackRemedy(root: RootCause, kp: KnowledgePoint): string[] {
    const prereqs = this.graph.prerequisitesOf(kp.id)
    switch (root) {
      case 'prerequisite_gap':
        return [
          `先复习前置：${prereqs.map((p) => p.title).join('、') || '(本知识点无前置)'}`,
          `用 5 分钟复述每个前置的核心概念`,
          `回来重做 ${kp.title} 的基础题 5 道`,
        ]
      case 'concept_unclear':
        return [
          `用你自己的话讲一遍 ${kp.title}，不超过 3 分钟`,
          `让 AI 追问 3 个"为什么"`,
          `重做错题并口述思路`,
        ]
      case 'practice_lack':
        return [
          `围绕 ${kp.title} 做 10 道变式题`,
          `总结错题模式`,
          `今日计划中再安排一组计时练习`,
        ]
      case 'forgetting':
        return [
          `快速回顾 ${kp.title} 的核心定义`,
          `做 3 道诊断题确认遗忘程度`,
          `把这次错题归档到复习队列`,
        ]
    }
  }

  /**
   * 发现"跨知识点的薄弱模式" —— 比如学生一直在"分数运算"+"单位换算"上栽跟头，
   * 这反映了"基础运算能力"这个共同根因。
   */
  private discoverPatterns(weakPoints: WeaknessReport['weakPoints']): WeaknessReport['patterns'] {
    if (weakPoints.length < 2) return []
    // 用 shared prerequisites 找共同根因
    const commonPres = new Map<string, number>()
    for (const w of weakPoints) {
      const pres = this.graph.prerequisitesOf(w.knowledgePoint.id).map((p) => p.id)
      for (const p of pres) commonPres.set(p, (commonPres.get(p) ?? 0) + 1)
    }
    const patterns: WeaknessReport['patterns'] = []
    for (const [pid, count] of commonPres) {
      if (count >= 2) {
        const kp = this.graph.get(pid)
        if (!kp) continue
        patterns.push({
          title: `共同根因：${kp.title}`,
          description: `你在 ${count} 个不同的薄弱点上都依赖 "${kp.title}"，建议先整体补强这一前置。`,
          knowledgePointIds: weakPoints.map((w) => w.knowledgePoint.id),
        })
      }
    }
    return patterns
  }
}

function avgScore(arr: { score: number }[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b.score, 0) / arr.length
}

function safeJson(s: string): unknown {
  try {
    // 容忍 ```json ... ``` 包裹
    const trimmed = s.trim().replace(/^```json\s*|\s*```$/g, '')
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}
