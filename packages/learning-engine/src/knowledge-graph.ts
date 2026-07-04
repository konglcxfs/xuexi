import type { KnowledgeConnection, KnowledgePoint } from '@xuexi/shared'

/**
 * 知识图谱 —— 一个有向无环图，节点是 KnowledgePoint，边是 prerequisite。
 * 提供：前驱补全、依赖展开、跨图谱串联。
 */
export class KnowledgeGraph {
  private byId = new Map<string, KnowledgePoint>()
  /** 出边：node -> 它依赖的节点 */
  private prerequisites = new Map<string, string[]>()
  /** 入边：node -> 哪些节点依赖它（反向依赖，便于"学完 A 后下一步该学什么"） */
  private dependents = new Map<string, string[]>()

  load(points: KnowledgePoint[]): void {
    this.byId.clear()
    this.prerequisites.clear()
    this.dependents.clear()
    for (const p of points) {
      this.byId.set(p.id, p)
    }
    for (const p of points) {
      const pre = p.prerequisites.filter((id) => this.byId.has(id))
      this.prerequisites.set(p.id, pre)
      for (const preId of pre) {
        const arr = this.dependents.get(preId) ?? []
        arr.push(p.id)
        this.dependents.set(preId, arr)
      }
    }
  }

  get(id: string): KnowledgePoint | undefined {
    return this.byId.get(id)
  }

  all(): KnowledgePoint[] {
    return Array.from(this.byId.values())
  }

  prerequisitesOf(id: string): KnowledgePoint[] {
    return (this.prerequisites.get(id) ?? [])
      .map((pid) => this.byId.get(pid))
      .filter((p): p is KnowledgePoint => Boolean(p))
  }

  dependentsOf(id: string): KnowledgePoint[] {
    return (this.dependents.get(id) ?? [])
      .map((pid) => this.byId.get(pid))
      .filter((p): p is KnowledgePoint => Boolean(p))
  }

  /**
   * 拓扑排序，按依赖顺序返回所有节点。
   * 这是"按顺序讲解"的依据。
   */
  topologicalOrder(): KnowledgePoint[] {
    const inDeg = new Map<string, number>()
    for (const id of this.byId.keys()) inDeg.set(id, 0)
    for (const [, deps] of this.prerequisites) {
      for (const d of deps) inDeg.set(d, (inDeg.get(d) ?? 0) + 1)
    }
    const queue: string[] = []
    for (const [id, deg] of inDeg) if (deg === 0) queue.push(id)

    const out: KnowledgePoint[] = []
    const visited = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const node = this.byId.get(id)
      if (node) out.push(node)
      for (const dep of this.dependents.get(id) ?? []) {
        const newDeg = (inDeg.get(dep) ?? 1) - 1
        inDeg.set(dep, newDeg)
        if (newDeg === 0) queue.push(dep)
      }
    }
    return out
  }

  /**
   * 检测环 —— prerequisite 之间应避免成环。
   */
  detectCycles(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const stack = new Set<string>()
    const dfs = (id: string, path: string[]): void => {
      if (stack.has(id)) {
        cycles.push([...path.slice(path.indexOf(id)), id])
        return
      }
      if (visited.has(id)) return
      visited.add(id)
      stack.add(id)
      for (const pre of this.prerequisites.get(id) ?? []) {
        dfs(pre, [...path, id])
      }
      stack.delete(id)
    }
    for (const id of this.byId.keys()) dfs(id, [])
    return cycles
  }

  /**
   * 自动生成"知识串联"建议 —— 基于共享标签、共同前置节点。
   * 这是引擎帮助学生看到"这一步和那一步是怎么连着的"。
   */
  inferConnections(role: string): KnowledgeConnection[] {
    const conns: KnowledgeConnection[] = []
    const points = this.all()
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j]!
        const sharedTags = a.tags.filter((t) => b.tags.includes(t))
        const sharedPres = a.prerequisites.filter((p) => b.prerequisites.includes(p))
        if (sharedTags.length > 0) {
          conns.push({
            fromKnowledgePointId: a.id,
            toKnowledgePointId: b.id,
            kind: 'analogy',
            weight: Math.min(1, sharedTags.length * 0.3),
            description: `共同标签：${sharedTags.join('、')}`,
          })
        }
        if (sharedPres.length > 1) {
          conns.push({
            fromKnowledgePointId: a.id,
            toKnowledgePointId: b.id,
            kind: 'extension',
            weight: Math.min(1, sharedPres.length * 0.4),
            description: `共享前置：${sharedPres.length} 个`,
          })
        }
      }
    }
    return conns
  }

  /**
   * 当一个点薄弱时，找它所有的前置依赖（这些可能是薄弱根因）。
   */
  findPrereqGap(id: string): KnowledgePoint[] {
    return this.prerequisitesOf(id)
  }
}
