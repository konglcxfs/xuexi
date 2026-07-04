/**
 * MethodRegistry —— 学习方法注册表（学习法驱动架构的核心）
 *
 * 内置方法包（教学法理论的经典方法）：
 *   - feynman            费曼学习法：用最简单的语言讲给别人听
 *   - spaced_repetition  间隔重复：按遗忘曲线定时复习
 *   - active_recall      主动回忆：先回忆再翻书
 *   - error_notebook     纠错本：错题归档 + 周期性回访
 *   - mindmap            思维导图：结构化知识
 *   - socratic           苏格拉底式：通过提问引导
 *   - project_based      项目式学习：做中学
 *   - interleaving       交叉练习：混合不同类型题目
 *
 * 调用方通过 method.id 拿到一个 LearningMethod，按它的 steps 驱动 AI 对话。
 */

import type { LearningMethod } from '@xuexi/shared'

export class MethodRegistry {
  private methods = new Map<string, LearningMethod>()

  register(method: LearningMethod): void {
    if (this.methods.has(method.id) && this.methods.get(method.id)!.builtin) {
      throw new Error(`Cannot overwrite builtin method: ${method.id}`)
    }
    this.methods.set(method.id, method)
  }

  get(id: string): LearningMethod | undefined {
    return this.methods.get(id)
  }

  list(): LearningMethod[] {
    return Array.from(this.methods.values())
  }

  /** 根据认知目标和知识类型挑出适用的方法 */
  recommendFor(target: 'explain' | 'apply' | 'extend', knowledgeKind: string): LearningMethod[] {
    return this.list().filter(m =>
      m.applicableTo.some(a => a.target === target && a.knowledgeKind === knowledgeKind)
    )
  }
}

export const defaultMethodRegistry = new MethodRegistry()

// ----------------------------------------------------------------------------
// 内置方法包
// ----------------------------------------------------------------------------

defaultMethodRegistry.register({
  id: 'feynman',
  displayName: '费曼学习法',
  category: 'comprehension',
  summary: '用最简单的语言把概念讲给"完全不懂的人"听，直到对方听懂。',
  applicableTo: [
    { target: 'explain', knowledgeKind: 'concept' },
    { target: 'explain', knowledgeKind: 'reasoning' },
  ],
  steps: [
    { order: 1, promptTemplate: '请你假装面对一个完全不懂这个概念的人，准备一段不超过 100 字的讲解。', goal: '强迫自己用大白话表达', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 2, promptTemplate: '在上面的讲解里，你有没有用专业术语或定义还没解释的词？如果有，换成生活例子。', goal: '识别并替换术语', expectedResponseShape: 'free_text', aiAction: 'scaffold' },
    { order: 3, promptTemplate: '现在想象一个 8 岁小孩会怎么问你？请回答他。', goal: '检验覆盖度', expectedResponseShape: 'free_text', aiAction: 'feedback' },
  ],
  theoryTags: ['Feynman Technique', 'Elaboration'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'spaced_repetition',
  displayName: '间隔重复',
  category: 'recall',
  summary: '按遗忘曲线间隔 n 天复习同一知识点，错的多就缩短间隔。',
  applicableTo: [
    { target: 'apply', knowledgeKind: 'fact' },
    { target: 'apply', knowledgeKind: 'procedure' },
    { target: 'explain', knowledgeKind: 'fact' },
  ],
  steps: [
    { order: 1, promptTemplate: '不看资料，写下关于 {{kp.title}} 的核心要点。', goal: '主动回忆', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 2, promptTemplate: '对照资料，给这份回忆打分 0-10，并指出漏掉的细节。', goal: '自我评估', expectedResponseShape: 'free_text', aiAction: 'evaluate' },
    { order: 3, promptTemplate: '基于本次记忆强度，引擎调度下一次的复习时间。', goal: '调度下次复习', expectedResponseShape: 'mixed', aiAction: 'feedback' },
  ],
  theoryTags: ['Spaced Repetition', 'Forgetting Curve', 'Ebbinghaus'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'active_recall',
  displayName: '主动回忆',
  category: 'recall',
  summary: '不看任何资料，先回忆，再用题目检验。',
  applicableTo: [
    { target: 'apply', knowledgeKind: 'concept' },
    { target: 'apply', knowledgeKind: 'reasoning' },
  ],
  steps: [
    { order: 1, promptTemplate: '请先列出 {{kp.title}} 的 3-5 个关键点，再做下面的练习。', goal: '先回忆', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 2, promptTemplate: '现在给你一道相关题，请用你的回忆解题。', goal: '用回忆做对题', expectedResponseShape: 'step_solution', aiAction: 'evaluate' },
  ],
  theoryTags: ['Active Recall', 'Retrieval Practice'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'error_notebook',
  displayName: '纠错本',
  category: 'reflection',
  summary: '错题归档、分类、周期性回访。',
  applicableTo: [
    { target: 'apply', knowledgeKind: 'procedure' },
    { target: 'apply', knowledgeKind: 'word_problem' },
  ],
  steps: [
    { order: 1, promptTemplate: '把错的题目完整抄到纠错本，并写下当时怎么想的。', goal: '记录错题', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 2, promptTemplate: '错的根本原因属于哪一类：知识盲区 / 审题 / 计算 / 迁移误用？', goal: '诊断根因', expectedResponseShape: 'multiple_choice', aiAction: 'evaluate' },
    { order: 3, promptTemplate: '一周后请重新做一遍类似题。', goal: '回访', expectedResponseShape: 'step_solution', aiAction: 'evaluate' },
  ],
  theoryTags: ['Error Analysis', 'Deliberate Practice'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'mindmap',
  displayName: '思维导图',
  category: 'connection',
  summary: '把一个主题的分支结构画出来，建立结构化记忆。',
  applicableTo: [
    { target: 'extend', knowledgeKind: 'concept' },
    { target: 'explain', knowledgeKind: 'concept' },
  ],
  steps: [
    { order: 1, promptTemplate: '请用 mermaid / 文本描述画一份 {{kp.title}} 的思维导图。', goal: '结构化', expectedResponseShape: 'mixed', aiAction: 'ask' },
    { order: 2, promptTemplate: '在导图上加 3 个例子节点。', goal: '具体化', expectedResponseShape: 'mixed', aiAction: 'scaffold' },
  ],
  theoryTags: ['Mind Mapping', 'Visual Learning'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'socratic',
  displayName: '苏格拉底式提问',
  category: 'meta',
  summary: '通过一连串问题引导用户自己发现答案。',
  applicableTo: [
    { target: 'explain', knowledgeKind: 'reasoning' },
    { target: 'extend', knowledgeKind: 'concept' },
  ],
  steps: [
    { order: 1, promptTemplate: '你认为 {{kp.title}} 最核心的问题是什么？', goal: '聚焦', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 2, promptTemplate: '你能举一个反例吗？如果举不出，说明什么？', goal: '检验边界', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 3, promptTemplate: '把这个概念和另一个你熟的概念做类比。', goal: '迁移', expectedResponseShape: 'free_text', aiAction: 'scaffold' },
  ],
  theoryTags: ['Socratic Method', 'Inquiry Based Learning'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'project_based',
  displayName: '项目式学习',
  category: 'practice',
  summary: '围绕一个真实小项目，把相关知识点串起来用。',
  applicableTo: [
    { target: 'extend', knowledgeKind: 'procedure' },
    { target: 'extend', knowledgeKind: 'reasoning' },
  ],
  steps: [
    { order: 1, promptTemplate: '我们来做一个小项目：{{project}}。先列出它会用到哪些 {{kp.title}} 的部分。', goal: '建立关联', expectedResponseShape: 'free_text', aiAction: 'ask' },
    { order: 2, promptTemplate: '动手实现，遇到卡点就回到知识点。', goal: '做中学', expectedResponseShape: 'step_solution', aiAction: 'scaffold' },
    { order: 3, promptTemplate: '完成后来复盘：哪个知识点掌握得更牢了？', goal: '复盘', expectedResponseShape: 'free_text', aiAction: 'feedback' },
  ],
  theoryTags: ['Project Based Learning'],
  builtin: true,
})

defaultMethodRegistry.register({
  id: 'interleaving',
  displayName: '交叉练习',
  category: 'practice',
  summary: '在同一场练习里混合多个相关知识点，提升迁移能力。',
  applicableTo: [
    { target: 'extend', knowledgeKind: 'procedure' },
    { target: 'apply', knowledgeKind: 'word_problem' },
  ],
  steps: [
    { order: 1, promptTemplate: '本场练习混合了 {{kps}}，请逐题完成。', goal: '混合训练', expectedResponseShape: 'mixed', aiAction: 'ask' },
    { order: 2, promptTemplate: '做完之后给每题标记属于哪个知识点。', goal: '元认知', expectedResponseShape: 'multiple_choice', aiAction: 'evaluate' },
  ],
  theoryTags: ['Interleaved Practice', 'Desirable Difficulties'],
  builtin: true,
})