import type {
  KnowledgeConnection,
  KnowledgePoint,
  MasteryState,
  MemoryEntry,
  RoleType,
} from '@xuexi/shared'
import { KnowledgeGraph } from './knowledge-graph'

/**
 * 知识串联 + 记忆系统。
 *
 * - KnowledgeLinker：发现"看似无关的两点其实连着"，给出 reasoning。
 * - MemoryStore：短期上下文 + 长期用户偏好 + 知识点掌握历史。
 *
 * 这是平台大脑的另一半 —— 让 AI 不止于"答问题"，还能帮助学生看到自己的成长。
 */
export class KnowledgeLinker {
  private graph: KnowledgeGraph
  private role: RoleType

  constructor(opts: { graph: KnowledgeGraph; role: RoleType }) {
    this.graph = opts.graph
    this.role = opts.role
  }

  /**
   * 基于已掌握 + 即将学习 的节点，发现"跨知识点桥接"。
   * 比如学生刚学完"分数加法"，推荐"分数乘法"作为衔接。
   */
  bridge(opts: {
    known: MasteryState[]
    focusId: string
  }): KnowledgeConnection[] {
    const focus = this.graph.get(opts.focusId)
    if (!focus) return []

    const knownIds = new Set(opts.known.filter((s) => s.mastery >= 0.6).map((s) => s.knowledgePointId))
    const out: KnowledgeConnection[] = []

    // 1) 直接依赖：focus 还未掌握的前置
    for (const pre of this.graph.prerequisitesOf(focus.id)) {
      if (!knownIds.has(pre.id)) {
        out.push({
          fromKnowledgePointId: pre.id,
          toKnowledgePointId: focus.id,
          kind: 'prerequisite',
          weight: 1 - (knownIds.has(pre.id) ? 0 : 0.3),
          description: `《${pre.title}》是《${focus.title}》的前置，掌握后才能更好理解。`,
        })
      }
    }

    // 2) 反向依赖：学完 focus 后，自然应该学的下一步
    for (const dep of this.graph.dependentsOf(focus.id)) {
      out.push({
        fromKnowledgePointId: focus.id,
        toKnowledgePointId: dep.id,
        kind: 'extension',
        weight: 0.6,
        description: `学完《${focus.title}》后，下一步推荐《${dep.title}》。`,
      })
    }

    // 3) 共享前置 -> 类似题型
    const focusPres = new Set(this.graph.prerequisitesOf(focus.id).map((p) => p.id))
    for (const other of this.graph.all()) {
      if (other.id === focus.id) continue
      const otherPres = this.graph.prerequisitesOf(other.id).map((p) => p.id)
      const shared = otherPres.filter((p) => focusPres.has(p))
      if (shared.length >= 2) {
        out.push({
          fromKnowledgePointId: focus.id,
          toKnowledgePointId: other.id,
          kind: 'analogy',
          weight: shared.length / 5,
          description: `与《${other.title}》有 ${shared.length} 个共同前置，做题思路可以互相迁移。`,
        })
      }
    }

    return out.sort((a, b) => b.weight - a.weight).slice(0, 8)
  }
}

/**
 * 记忆存储 —— 一个进程内的内存实现。
 * 真实部署时会换成 Postgres + 向量检索（pgvector）。
 */
export class MemoryStore {
  private entries: MemoryEntry[] = []

  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'weight'>): MemoryEntry {
    const e: MemoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      weight: 1,
    }
    this.entries.push(e)
    return e
  }

  list(userId: string, opts: { kinds?: MemoryEntry['kind'][]; kpIds?: string[]; limit?: number } = {}): MemoryEntry[] {
    let r = this.entries.filter((e) => e.userId === userId)
    if (opts.kinds) r = r.filter((e) => opts.kinds!.includes(e.kind))
    if (opts.kpIds && opts.kpIds.length > 0)
      r = r.filter((e) => e.knowledgePointIds.some((id) => opts.kpIds!.includes(id)))
    return r
      .sort((a, b) => b.weight - a.weight)
      .slice(0, opts.limit ?? 20)
  }

  /** 命中（被召回）+1 */
  hit(id: string): void {
    const e = this.entries.find((x) => x.id === id)
    if (e) e.weight = Math.min(10, e.weight + 1)
  }

  /** 把"今天学了什么"提炼成长期记忆 */
  distill(args: {
    userId: string
    role: RoleType
    recentStates: MasteryState[]
    feedback?: string
  }): MemoryEntry[] {
    const out: MemoryEntry[] = []
    // 里程碑式：掌握度突破
    for (const s of args.recentStates) {
      if (s.mastery >= 0.85) {
        out.push(
          this.add({
            userId: args.userId,
            kind: 'milestone',
            content: `掌握了《${args.role}》图谱中的某个知识点（掌握度 ${(s.mastery * 100).toFixed(0)}%）。`,
            knowledgePointIds: [s.knowledgePointId],
          })
        )
      }
    }
    if (args.feedback) {
      out.push(
        this.add({
          userId: args.userId,
          kind: 'feedback',
          content: args.feedback,
          knowledgePointIds: [],
        })
      )
    }
    return out
  }
}
