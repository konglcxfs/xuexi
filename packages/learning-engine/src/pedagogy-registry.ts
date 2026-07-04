/**
 * PedagogyRegistry —— 学科教学方案注册表
 *
 * Pedagogy 描述"怎么教"某个学科的总纲领：
 *   - 用什么方法（methodStack）
 *   - 教学风格（苏格拉底 / 直接 / 渐进 / 考试驱动）
 *   - 阶段 Prompt 模板（intro / explain / practice / review / assessment）
 *
 * 调用方（如 AI 对话）拿到 Pedagogy 后，按阶段 + 方法包组合来引导用户。
 */

import type { Pedagogy } from '@xuexi/shared'

export class PedagogyRegistry {
  private pedagogies = new Map<string, Pedagogy>()

  register(p: Pedagogy): void {
    this.pedagogies.set(p.id, p)
  }

  get(id: string): Pedagogy | undefined {
    return this.pedagogies.get(id)
  }

  list(): Pedagogy[] {
    return Array.from(this.pedagogies.values())
  }
}

export const defaultPedagogyRegistry = new PedagogyRegistry()

// ----------------------------------------------------------------------------
// 内置 Pedagogy
// ----------------------------------------------------------------------------

defaultPedagogyRegistry.register({
  id: 'primary-scaffold',
  displayName: '小学渐进式教学法',
  domain: 'primary',
  style: 'scaffold',
  goals: [
    '用生活化语言解释概念',
    '通过具体例子建立直觉',
    '鼓励动手操作',
    '在安全环境里允许犯错',
  ],
  methodStack: [
    { methodId: 'feynman', phase: 'explain', weight: 0.3 },
    { methodId: 'active_recall', phase: 'practice', weight: 0.25 },
    { methodId: 'error_notebook', phase: 'review', weight: 0.2 },
    { methodId: 'mindmap', phase: 'intro', weight: 0.15 },
    { methodId: 'interleaving', phase: 'practice', weight: 0.1 },
  ],
  promptTemplates: {
    intro: '小朋友好！今天我们来认识 {{kp.title}}。先告诉我你觉得 {{kp.title}} 是什么？如果不知道也没关系，我们一起探索。',
    explain: '我们一步一步来。{{kp.title}} 就像 {{analogy}}。第一步...第二步...',
    practice: '现在做个小练习：{{exercise.stem}}。不需要着急，写下你想到的。',
    review: '上次我们学的 {{kp.title}}，你还记得吗？我们来回顾一下。',
    assessment: '今天学了 {{kp.title}}，我觉得你已经很棒了！我们用一个小测验看看掌握得怎么样。',
  },
  motivation: { style: 'praise', pacingDaysPerWeek: 5 },
  defaultParameters: { dailyMinutes: 30, sessionMinutes: 15, reviewIntervalDays: 3 },
})

defaultPedagogyRegistry.register({
  id: 'ruankao-exam-driven',
  displayName: '软考应试教学法',
  domain: 'ruankao',
  style: 'exam_driven',
  goals: [
    '覆盖考试大纲每个知识点',
    '真题导向，重点突破高频考点',
    '建立错题档案，定期回访',
    '考前模拟，限时训练',
  ],
  methodStack: [
    { methodId: 'active_recall', phase: 'explain', weight: 0.25 },
    { methodId: 'spaced_repetition', phase: 'review', weight: 0.3 },
    { methodId: 'error_notebook', phase: 'review', weight: 0.25 },
    { methodId: 'interleaving', phase: 'practice', weight: 0.1 },
    { methodId: 'project_based', phase: 'assessment', weight: 0.1 },
  ],
  promptTemplates: {
    intro: '{{kp.title}} 在软考 {{examLevel}} 中的权重约 {{weight}}%。我们从真题切入。',
    explain: '本节核心概念：{{kp.title}}。考试常见提问方式：{{typicalQuestions}}。关键陷阱：{{commonPitfalls}}。',
    practice: '真题：{{exercise.stem}}。请限时 2 分钟做完。',
    review: '错题回顾：{{errorStems}}。我们看看这类题型的通用解法。',
    assessment: '本轮测评：{{examSummary}}。',
  },
  motivation: { style: 'progress', pacingDaysPerWeek: 6 },
  defaultParameters: { dailyMinutes: 60, sessionMinutes: 45, reviewIntervalDays: 2 },
})