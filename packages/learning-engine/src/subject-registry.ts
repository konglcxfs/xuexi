/**
 * SubjectRegistry —— 学科注册表（学科无关架构的核心）
 *
 * 设计原则：
 *   - 学科不硬编码在代码里。所有学科通过 register() 注入。
 *   - 默认注册两份内置学科：primary-math-g4、ruankao-softdesigner-junior
 *   - 外部采集源（SourceAdapter）也可以注入新学科。
 *   - 注册表提供 query / list / resolve 接口，调用方不直接持有 subject 对象。
 */

import type { Subject, SubjectConfig, KnowledgeGraph, Pedagogy } from '@xuexi/shared'

export class SubjectRegistry {
  private subjects = new Map<string, Subject>()
  private graphs = new Map<string, KnowledgeGraph>()       // graphId -> graph
  private configs = new Map<string, SubjectConfig>()       // subjectId -> config

  /** 注册一个学科（输入可以是 Subject 或 SubjectConfig） */
  register(input: Subject | SubjectConfig): Subject {
    if (this.isSubject(input)) return this.store(input)
    const cfg = input
    const subject: Subject = {
      id: cfg.id,
      displayName: cfg.displayName,
      shortName: cfg.displayName,
      domain: cfg.domain,
      graphId: cfg.graphId,
      pedagogyId: cfg.pedagogyId,
      preferredMethods: cfg.preferredMethods,
      meta: cfg.meta ?? {},
      sourceBindings: cfg.sourceBindings,
      icon: cfg.icon,
      color: cfg.color,
      createdAt: new Date().toISOString(),
      source: 'builtin',
    }
    return this.store(subject)
  }

  private isSubject(x: Subject | SubjectConfig): x is Subject {
    return 'sourceBindings' in x && Array.isArray((x as Subject).sourceBindings)
  }

  private store(subject: Subject): Subject {
    this.subjects.set(subject.id, subject)
    this.configs.set(subject.id, {
      id: subject.id,
      displayName: subject.displayName,
      domain: subject.domain,
      graphId: subject.graphId,
      pedagogyId: subject.pedagogyId,
      preferredMethods: subject.preferredMethods,
      meta: subject.meta,
      icon: subject.icon,
      color: subject.color,
      sourceBindings: subject.sourceBindings,
    })
    return subject
  }

  /** 绑定 / 替换某个学科的知识图谱 */
  bindGraph(graph: KnowledgeGraph): void {
    this.graphs.set(graph.id, graph)
  }

  get(subjectId: string): Subject | undefined {
    return this.subjects.get(subjectId)
  }

  getGraph(subjectId: string): KnowledgeGraph | undefined {
    const subject = this.subjects.get(subjectId)
    if (!subject) return undefined
    return this.graphs.get(subject.graphId)
  }

  list(): Subject[] {
    return Array.from(this.subjects.values())
  }

  byDomain(domain: Subject['domain']): Subject[] {
    return this.list().filter(s => s.domain === domain)
  }
}

/** 全局默认注册表（单例，便于跨模块共享） */
export const defaultSubjectRegistry = new SubjectRegistry()

/** 内置两个种子学科，引擎启动时加载 */
defaultSubjectRegistry.register({
  id: 'primary-math-g4',
  displayName: '小学数学 · 四年级',
  shortName: '数学四年级',
  domain: 'primary',
  graphId: 'primary-math-g4-upper',
  pedagogyId: 'primary-scaffold',
  preferredMethods: ['feynman', 'spaced_repetition', 'active_recall', 'error_notebook', 'mindmap'],
  meta: { grade: 4 },
  icon: 'calculator',
  color: '#3b82f6',
  sourceBindings: [
    { kind: 'textbook', adapterId: 'pep-digital-textbook', locator: 'primary/math/g4' },
    { kind: 'question_bank', adapterId: 'pep-digital-textbook', locator: 'primary/math/g4/exercises' },
  ],
  source: 'builtin',
  createdAt: new Date().toISOString(),
})

defaultSubjectRegistry.register({
  id: 'ruankao-softdesigner-junior',
  displayName: '软考 · 软件设计师（中级）',
  shortName: '软设中级',
  domain: 'ruankao',
  graphId: 'ruankao-softdesigner-junior',
  pedagogyId: 'ruankao-exam-driven',
  preferredMethods: ['active_recall', 'spaced_repetition', 'error_notebook', 'project_based'],
  meta: { examLevel: 'junior', subject: 'softdesigner' },
  icon: 'code',
  color: '#10b981',
  sourceBindings: [
    { kind: 'textbook', adapterId: 'ruankao-official-pdf', locator: 'ruankao/softdesigner/junior' },
    { kind: 'question_bank', adapterId: 'ruankao-official-pdf', locator: 'ruankao/softdesigner/junior/past-papers' },
  ],
  source: 'builtin',
  createdAt: new Date().toISOString(),
})