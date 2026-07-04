import type {
  ChatMessage,
  ChatSession,
  KnowledgePoint,
  MemoryEntry,
  RoleType,
  WeaknessReport,
} from '@xuexi/shared'

/**
 * AIProvider —— 抽象不同的 LLM 接入。
 * - 同一个 Provider 接口兼容 OpenAI / DeepSeek / 通义千问 / Ollama (OpenAI 兼容) / Anthropic 封装。
 * - 默认实现走 OpenAI 兼容协议，最容易切。
 */
export interface ChatRequest {
  messages: ChatMessage[]
  systemPrompt: string
  temperature?: number
  maxTokens?: number
  /** JSON 模式（用于让 AI 输出结构化诊断结果） */
  jsonMode?: boolean
}

export interface ChatResponse {
  content: string
  /** 估算的 token 用量，便于统计 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIProvider {
  readonly name: string
  chat(req: ChatRequest): Promise<ChatResponse>
}

/**
 * RoleStyle —— 不同角色对 AI 的输出要求完全不同。
 *  - 小学生: 必须生动、口语化、有比喻、避免超纲词、最多 2-3 句
 *  - 软考:   精准、专业、用专业术语、可以引用教材定义
 */
export interface RoleStyle {
  systemPrompt: string
  explanationGranularity: 'shallow' | 'medium' | 'deep'
  tone: 'playful' | 'patient' | 'professional' | 'concise'
  /** 鼓励/激励的话术风格 */
  encouragement: 'praise_emoji' | 'concise_progress' | 'none'
  /** 讲解的最大长度（字符） */
  maxChars: number
  /** 是否使用表情/比喻 */
  useMetaphors: boolean
}

export const ROLE_STYLES: Record<RoleType, RoleStyle> = {
  primary_school: {
    systemPrompt:
      '你是一位耐心、有趣的小学老师，正在辅导一位小学四年级的学生。' +
      '请用简单、生动的语言解释，必要时用生活化比喻，每次回答不超过 3 句话。' +
      '不要使用超过小学范围的术语。鼓励学生多动手、多思考。',
    explanationGranularity: 'shallow',
    tone: 'playful',
    encouragement: 'praise_emoji',
    maxChars: 400,
    useMetaphors: true,
  },
  ruankao: {
    systemPrompt:
      '你是一位软考辅导老师，正在帮助一位备考软考（中级/高级）的成年人。' +
      '回答要精准、专业，可以引用教材定义、考纲要点。' +
      '能用表格/要点就不要用长段落。如有疑问请直接追问。',
    explanationGranularity: 'deep',
    tone: 'concise',
    encouragement: 'concise_progress',
    maxChars: 2000,
    useMetaphors: false,
  },
}

/**
 * PromptBuilder —— 把学习引擎的上下文组装成最终给 LLM 的 prompt。
 * 这是"角色适配"的关键：同一个知识点，同样的 Mastery，同样的弱项诊断，
 * 不同的角色会拼出完全不同的 prompt。
 */
export class PromptBuilder {
  /**
   * 构建常规对话的 system prompt。
   */
  buildChatSystemPrompt(args: {
    role: RoleType
    knowledgePoint?: KnowledgePoint
    recentMemory?: MemoryEntry[]
    weaknessSummary?: string
    sessionState?: ChatSession['state']
  }): string {
    const style = ROLE_STYLES[args.role]
    const sections: string[] = [style.systemPrompt]

    if (args.knowledgePoint) {
      sections.push(this.formatKnowledgePoint(args.knowledgePoint, args.role))
    }
    if (args.weaknessSummary) {
      sections.push(`【关于学生的薄弱点】\n${args.weaknessSummary}`)
    }
    if (args.recentMemory && args.recentMemory.length > 0) {
      const memLines = args.recentMemory
        .slice(0, 8)
        .map((m) => `- (${m.kind}) ${m.content}`)
        .join('\n')
      sections.push(`【关于这个学生的记忆】\n${memLines}`)
    }
    if (args.sessionState) {
      sections.push(`【当前状态】用户正在${this.describeState(args.sessionState)}。`)
    }

    // 风格摘要，作为兜底约束
    sections.push(
      `【回复风格约束】` +
        `解释粒度:${style.explanationGranularity};` +
        `语气:${style.tone};` +
        `回复不超过${style.maxChars}字;` +
        (style.useMetaphors ? '可以使用比喻。' : '请避免使用比喻。')
    )
    return sections.join('\n\n')
  }

  /**
   * 诊断薄弱点的 prompt —— 让 AI 帮我们解释"为什么薄弱 / 怎么补"。
   */
  buildWeaknessDiagnosisPrompt(args: {
    role: RoleType
    knowledgePoint: KnowledgePoint
    mastery: number
    evidences: { at: string; correct: boolean; score: number; feedback?: string }[]
  }): string {
    return [
      ROLE_STYLES[args.role].systemPrompt,
      '',
      `你是一位教学诊断专家。下面是一个学生在「${args.knowledgePoint.title}」上的练习记录，请你诊断薄弱根因。`,
      '',
      '【知识点】',
      `${args.knowledgePoint.title}`,
      args.knowledgePoint.description,
      `难度:${args.knowledgePoint.difficulty}`,
      `前置依赖:${args.knowledgePoint.prerequisites.join(', ') || '无'}`,
      '',
      `【掌握度】${(args.mastery * 100).toFixed(0)}%`,
      '【最近的练习】',
      ...args.evidences.slice(-15).map((e) => {
        const ok = e.correct ? '✓' : '✗'
        return `  ${ok} score=${e.score.toFixed(2)} ${e.feedback ? '- ' + e.feedback : ''}`
      }),
      '',
      '请用 JSON 输出：',
      '{',
      '  "rootCause": "prerequisite_gap | concept_unclear | practice_lack | forgetting",',
      '  "explanation": "为什么薄弱（一段话，面向学生本人）",',
      '  "remedy": ["补救步骤 1", "补救步骤 2", "补救步骤 3"]',
      '}',
    ].join('\n')
  }

  /**
   * 出题的 prompt —— AI 根据知识点出一组题来考核掌握度。
   */
  buildPracticePrompt(args: { role: RoleType; knowledgePoint: KnowledgePoint; count: number }): string {
    return [
      ROLE_STYLES[args.role].systemPrompt,
      '',
      `请围绕知识点「${args.knowledgePoint.title}」出 ${args.count} 道练习题。`,
      `知识点的核心描述：${args.knowledgePoint.description}`,
      `难度等级：${args.knowledgePoint.difficulty}`,
      '',
      '请用 JSON 数组输出：',
      '[',
      '  {',
      '    "id": "q1",',
      '    "dimension": "explain | apply | extend",',
      '    "question": "...",',
      '    "expectedAnswer": "...",',
      '    "hint": "..."',
      '  }',
      ']',
    ].join('\n')
  }

  /**
   * 让孩子"讲一遍"的评估 prompt —— 费曼学习法。
   */
  buildFeynmanEvaluationPrompt(args: {
    role: RoleType
    knowledgePoint: KnowledgePoint
    userExplanation: string
  }): string {
    return [
      ROLE_STYLES[args.role].systemPrompt,
      '',
      `学生刚刚尝试用自己的话解释「${args.knowledgePoint.title}」。`,
      `知识点核心：${args.knowledgePoint.description}`,
      '',
      `学生的解释：`,
      `"""${args.userExplanation}"""`,
      '',
      '请评估，并输出 JSON：',
      '{',
      '  "score": 0.0,                          // 0-1',
      '  "missing": ["漏掉的关键点 ..."],      // 学生没说到的关键点',
      '  "misconceptions": ["错误理解 ..."],   // 学生说错的',
      '  "good": ["讲得好的部分 ..."],         // 值得肯定的',
      '  "nextQuestion": "下一个引导问题",     // 引导学生继续深入的追问',
      '  "feedback": "面向学生的鼓励性反馈",  ',
      '}',
    ].join('\n')
  }

  /**
   * 把学习计划里的某一天，转化成发给学生的"今日导读"。
   */
  buildDailyBriefingPrompt(args: {
    role: RoleType
    planTitle: string
    theme: string
    tasks: { kind: string; title: string; description: string }[]
    weakPoints: string[]
  }): string {
    return [
      ROLE_STYLES[args.role].systemPrompt,
      '',
      `今天的学习计划主题是：「${args.theme}」（来自计划「${args.planTitle}」）`,
      '',
      '今天的任务：',
      ...args.tasks.map((t, i) => `  ${i + 1}. [${t.kind}] ${t.title} - ${t.description}`),
      '',
      '学生最近的薄弱点：',
      ...args.weakPoints.map((w) => `  - ${w}`),
      '',
      '请生成一段 100-200 字的"今日导读"，说明今天为什么安排这些、预期收获。',
    ].join('\n')
  }

  /**
   * 知识串联 —— 让学生看到"这一步和那一步其实是连着的"。
   */
  buildKnowledgeConnectionPrompt(args: {
    role: RoleType
    fromPoint: KnowledgePoint
    toPoint: KnowledgePoint
  }): string {
    return [
      ROLE_STYLES[args.role].systemPrompt,
      '',
      '下面两个知识点其实有内在联系。请用一句话给学生讲清"它们是怎么连起来的"，让学生顿悟。',
      '',
      `【A】${args.fromPoint.title}：${args.fromPoint.description}`,
      `【B】${args.toPoint.title}：${args.toPoint.description}`,
    ].join('\n')
  }

  private formatKnowledgePoint(kp: KnowledgePoint, role: RoleType): string {
    const audience = role === 'primary_school' ? '小学生' : '成人软考考生'
    return (
      `【当前知识点（${audience}视角）】` +
      `\n标题：${kp.title}` +
      `\n描述：${kp.description}` +
      `\n难度：${kp.difficulty}` +
      (kp.prerequisites.length > 0 ? `\n前置依赖：${kp.prerequisites.join(', ')}` : '')
    )
  }

  private describeState(s: ChatSession['state']): string {
    switch (s) {
      case 'explaining':
        return '解释一个概念'
      case 'practicing':
        return '做练习题'
      case 'reviewing':
        return '复习已学内容'
      case 'planning':
        return '讨论学习计划'
      default:
        return '自由提问'
    }
  }
}
