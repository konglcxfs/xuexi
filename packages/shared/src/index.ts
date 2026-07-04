/**
 * 角色类型 —— 同一个学习引擎为不同角色提供不同的体验。
 *  - primary_school: 四年级小学生
 *  - ruankao:        软考考生（中级/高级）
 * 角色决定了知识库内容、解释粒度、风格、激励方式。
 */
export type RoleType = 'primary_school' | 'ruankao'

export interface RoleProfile {
  type: RoleType
  displayName: string
  /** 该角色的元数据，如年级 / 软考级别 */
  meta: {
    grade?: number
    ruankaoLevel?: 'junior' | 'senior'
    targetExamDate?: string
  }
}

/**
 * 知识点（Knowledge Point）是整个学习引擎的最小单元。
 * 每个角色对应一套知识图谱（Knowledge Graph）。
 */
export interface KnowledgePoint {
  id: string                  // 全局唯一: "<role>:<graph>:<id>"
  role: RoleType
  graph: string               // e.g. "math-grade4-up" / "ruankao-softmid"
  code: string                // 在图内的可读编码
  title: string
  description: string
  /** 前置知识点 id 列表（掌握 prerequisite 才能更好掌握本节点） */
  prerequisites: string[]
  /** 难度 0-1，由知识库初始化时标注 */
  difficulty: number
  /** 知识点标签，用于横向串联 */
  tags: string[]
  /** 学习目标，掌握到什么程度算达标 */
  mastery: {
    explain: number           // 能用自己的话讲清楚 (0-1)
    apply: number             // 能解决典型题 (0-1)
    extend: number            // 能迁移到新情境 (0-1)
  }
}

/**
 * 掌握度（Mastery）是一个 0-1 的标量，越高代表越熟。
 * 引擎采用 Leitner 间隔重复 + 衰减模型来更新它。
 */
export interface MasteryState {
  knowledgePointId: string
  userId: string
  mastery: number                 // 当前掌握度 0-1
  stability: number               // 记忆稳定性，用于遗忘曲线 (天)
  lastReviewedAt: string          // ISO
  reviewCount: number
  /** 历史的练习/考试结果，用于推断薄弱维度 */
  evidence: MasteryEvidence[]
}

/**
 * 掌握度证据：每做完一道题或解释一次，都会留下一条。
 * 这是诊断"薄弱点"的原始数据。
 */
export interface MasteryEvidence {
  at: string                      // ISO
  /** 这条证据考察的是哪个维度 */
  dimension: 'explain' | 'apply' | 'extend'
  correct: boolean
  /** 0-1, AI 评分或自评，用于细粒度评估 */
  score: number
  /** 关联的题目或上下文 id */
  refId?: string
  /** AI 反馈 */
  feedback?: string
}

/**
 * 薄弱点（Weakness）是引擎诊断后的结论。
 */
export interface WeaknessReport {
  userId: string
  role: RoleType
  generatedAt: string
  /** 按严重度排好序的薄弱知识点 */
  weakPoints: Array<{
    knowledgePoint: KnowledgePoint
    mastery: number
    /** 这个薄弱点的根因诊断 */
    rootCause: 'prerequisite_gap' | 'concept_unclear' | 'practice_lack' | 'forgetting'
    /** 推荐补救路径 */
    remedy: string[]
  }>
  /** 跨知识点的薄弱模式（e.g. 多次错在"分数运算"+"单位换算"上） */
  patterns: Array<{
    title: string
    description: string
    knowledgePointIds: string[]
  }>
  /** 整体总结，给 AI 对话时使用 */
  summary: string
}

/**
 * 学习计划（Plan）：由计划生成器产出。
 */
export interface LearningPlan {
  id: string
  userId: string
  role: RoleType
  title: string
  createdAt: string
  /** 一个计划的每一天（按天迭代） */
  days: PlanDay[]
  /** 当前在执行第几天 */
  currentDayIndex: number
  /** 计划的总目标 */
  goal: string
}

export interface PlanDay {
  index: number                   // 第几天，从 1 开始
  date: string                    // ISO date
  theme: string                   // 当天的主题（e.g. "分数的加法"）
  estimatedMinutes: number
  tasks: PlanTask[]
  /** 计划生成时的解释 - 为什么安排这些 */
  rationale: string
}

export interface PlanTask {
  id: string
  knowledgePointId: string
  kind: 'review' | 'learn' | 'practice' | 'explain' | 'connect'
  title: string
  description: string
  estimateMinutes: number
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
  /** 用 AI 互动时，关联会话 id */
  sessionId?: string
}

/**
 * 记忆条目 —— 引擎对"谁是用户、用户到了什么程度"的长期记忆。
 */
export interface MemoryEntry {
  id: string
  userId: string
  kind: 'preference' | 'fact' | 'milestone' | 'feedback' | 'strategy'
  content: string
  /** 这条记忆涉及的知识点（如果有） */
  knowledgePointIds: string[]
  createdAt: string
  /** 召回权重，命中次数越多权重越高 */
  weight: number
}

/**
 * AI 对话会话 —— 用于上下文保持。
 */
export interface ChatSession {
  id: string
  userId: string
  role: RoleType
  knowledgePointId?: string
  planTaskId?: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  /** 会话级别的状态：当前用户在做什么 */
  state: 'idle' | 'explaining' | 'practicing' | 'reviewing' | 'planning'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 引用到的知识点，用于溯源 */
  knowledgePointRefs: string[]
  at: string
}

/**
 * 知识串联（Knowledge Connect）—— 引擎发现"这两块知识其实是相关的"。
 */
export interface KnowledgeConnection {
  fromKnowledgePointId: string
  toKnowledgePointId: string
  kind: 'prerequisite' | 'analogy' | 'extension' | 'common_misconception'
  weight: number                  // 0-1
  description: string
}

/**
 * 学习仪表盘汇总数据
 */
export interface DashboardSummary {
  user: { id: string; displayName: string; role: RoleType }
  todayPlan: PlanDay | null
  streakDays: number
  totalMinutes: number
  masteryAverage: number
  weakPointsCount: number
  upcomingReviews: number
}

// ============================================================================
// 下面是 8 大体系的扩展类型（学科无关 / 学习法驱动 / 采集注入式）
// 这些类型与上面"角色 + 知识点 + 掌握度"模型是兼容的：
//   - 旧字段保留（向后兼容）
//   - 新字段基于 Subject（学科）维度组织，而不是 RoleType
// ============================================================================

/**
 * 学科（Subject） —— 学科无关架构的核心维度。
 * 不再把 "小学数学 / 软考软设" 写死在代码里，而是作为可配置项。
 * 学科可以从采集源（教材 / 考纲）动态注入，也可以从 JSON 手工加载。
 */
export interface Subject {
  id: string                       // e.g. "primary-math-g4", "ruankao-softdesigner-junior"
  displayName: string              // e.g. "小学数学 · 四年级"
  shortName: string                // e.g. "数学", "软设中级"
  domain: 'primary' | 'ruankao' | 'language' | 'science' | 'other'
  /** 学科使用的知识图谱（一份学科 = 一份知识图谱） */
  graphId: string
  /** 学科使用的教学方法方案 */
  pedagogyId: string
  /** 学科元信息：年级 / 考季 / 目标人群 */
  meta: {
    grade?: number
    examLevel?: string
    targetAudience?: string
    [k: string]: unknown
  }
  /** 学科使用的教学法配置（学科可以指定多个方法包） */
  preferredMethods: string[]       // LearningMethod.id[]
  /** 学科图标 / 颜色，用于前端展示 */
  icon?: string
  color?: string
  /** 来源：由谁注入到这个系统里的 */
  source: 'builtin' | 'json' | 'adapter'
  /** 学科默认绑定的采集源（题库 / 教材 / 资料） */
  sourceBindings: Array<{
    kind: 'textbook' | 'question_bank' | 'material'
    adapterId: string
    locator: string
  }>
  createdAt: string
}

/**
 * 学科知识图谱（KnowledgeGraph）—— 把原来"每个角色一份图谱"泛化成"每个学科一份图谱"。
 * 节点结构与原有 KnowledgePoint 兼容，但 id 体系改为 "<subjectId>:<code>"。
 */
export interface KnowledgeGraph {
  id: string                       // e.g. "primary-math-g4-upper"
  subjectId: string
  displayName: string
  /** 节点列表 */
  nodes: KnowledgePoint[]
  /** 跨节点的连接（前置 / 类比 / 拓展 / 易错共通） */
  connections: KnowledgeConnection[]
  /** 图谱来源标记 */
  source: 'builtin' | 'json' | 'adapter-imported'
  /** 适配版本号，方便后续升级 */
  schemaVersion: number
}

// ----------------------------------------------------------------------------
// 2. 用户体系 / 身份画像 / AI 自动补全
// ----------------------------------------------------------------------------

/** 画像特征的类别（命名导出，便于 profile-engine 引用） */
export type ProfileTraitCategory =
  | 'cognitive_style'
  | 'emotion_pattern'
  | 'knowledge_gap'
  | 'pace_habit'
  | 'communication_pref'
  | 'motivation'
  | 'other'

/**
 * 用户身份画像 —— 不只是 RoleType，而是 AI 可以学习和补充的丰富特征。
 * AI 在和用户对话时，会根据证据（行为 / 对话 / 答题 / 反馈）自动追加 ProfileTrait。
 */
export interface UserIdentityProfile {
  userId: string
  /** 静态部分：注册时填或被采集源识别 */
  static_: {
    displayName: string
    subjects: string[]             // 关注的学科 id 列表
    grade?: number
    role: RoleType
    examTarget?: string
    locale: string
  }
  /** 动态部分：AI 自动学习并补充的特征 */
  traits: ProfileTrait[]
  /** 跨学科长期记忆摘要（由引擎自动生成，喂给对话） */
  crossSubjectMemories: string[]
  /** 用户偏好 / 学习节奏 */
  preferences: {
    dailyMinutes?: number
    preferredMethods?: string[]    // 偏爱的学习方法
    motivationStyle?: 'praise' | 'progress' | 'challenge' | 'achievement'
    feedbackTone?: 'gentle' | 'direct' | 'socratic'
  }
  /** 画像版本号 —— AI 每次补全后 +1 */
  version: number
  updatedAt: string
}

/**
 * 画像特征条目 —— 一条被 AI 学习到的、关于用户的事实。
 * 它有强弱信号区分，置信度高才会喂给对话，置信度低会再观察。
 */
export interface ProfileTrait {
  id: string
  /** 类别：认知风格 / 情绪模式 / 知识盲区 / 节奏习惯 / 沟通偏好 */
  category: ProfileTraitCategory
    | 'cognitive_style'
    | 'emotion_pattern'
    | 'knowledge_gap'
    | 'pace_habit'
    | 'communication_pref'
    | 'motivation'
    | 'other'
  content: string                  // 人类可读的描述
  /** 证据强度 0-1，多次佐证后会升高 */
  confidence: number
  /** 支撑这条 trait 的证据数 */
  evidenceCount: number
  /** 第一次观察到的时间 */
  firstSeenAt: string
  lastSeenAt: string
  /** 来源：对话 / 答题 / 反馈 / 采集 */
  source: 'chat' | 'exercise' | 'feedback' | 'inferred' | 'imported'
  /** 这条 trait 涉及哪些学科 / 知识点 */
  subjectIds?: string[]
  knowledgePointIds?: string[]
}

// ----------------------------------------------------------------------------
// 3. 学科体系 —— SubjectRegistry + 动态加载
// ----------------------------------------------------------------------------

/**
 * 学科注册表：描述系统如何动态加载学科。
 * 不在代码里硬编码学科，而是通过 SubjectConfig 注入。
 */
export interface SubjectConfig {
  id: string
  displayName: string
  domain: Subject['domain']
  graphId: string
  pedagogyId: string
  preferredMethods: string[]
  meta?: Record<string, unknown>
  icon?: string
  color?: string
  /**
   * 这个学科默认绑定的 SourceAdapter —— 用于采集题库 / 教材 / 资料。
   * 比如 primary-math-g4 会绑定"人教数字教材"题源。
   */
  sourceBindings: Array<{
    kind: 'textbook' | 'question_bank' | 'material'
    adapterId: string
    /** 在该 adapter 内的具体定位 */
    locator: string
  }>
}

// ----------------------------------------------------------------------------
// 4. 学习方法体系（MethodRegistry）
// ----------------------------------------------------------------------------

/**
 * 学习方法 —— 一段可被引擎调用的"如何学习这块知识"的过程。
 * 引擎不绑定具体学科，只调用方法本身。每个方法都有自己的步骤模板。
 */
export interface LearningMethod {
  id: string                       // e.g. "feynman", "spaced_repetition", "active_recall"
  displayName: string
  category: 'recall' | 'comprehension' | 'practice' | 'reflection' | 'connection' | 'meta'
  /** 一句话概述 */
  summary: string
  /** 该方法的适用场景（哪些认知目标 / 哪些知识类型） */
  applicableTo: Array<{
    /** 适合的目标：能讲清楚 / 能做对题 / 能迁移 */
    target: 'explain' | 'apply' | 'extend'
    /** 适合的知识类型：概念 / 流程 / 推理 / 应用题 / 记忆事实 */
    knowledgeKind: 'concept' | 'procedure' | 'reasoning' | 'word_problem' | 'fact'
  }>
  /** 方法的步骤（每一步可作为 AI 对话的一个阶段） */
  steps: LearningMethodStep[]
  /** 这个方法用了哪些经典学习理论的标签（费曼 / 间隔重复 / 主动回忆 / 项目式 等） */
  theoryTags: string[]
  /** 是否内置方法（不可删除） */
  builtin: boolean
}

export interface LearningMethodStep {
  order: number
  /** 步骤模板：给 AI 的 Prompt 片段或结构化指令 */
  promptTemplate: string
  /** 步骤的目标：让用户在这一步做什么 */
  goal: string
  /** 用户应答的期望形态 */
  expectedResponseShape: 'free_text' | 'step_solution' | 'multiple_choice' | 'voice' | 'mixed'
  /** 该步骤需要 AI 做什么：讲解 / 提问 / 评估 / 给反馈 */
  aiAction: 'explain' | 'ask' | 'evaluate' | 'feedback' | 'scaffold'
}

// ----------------------------------------------------------------------------
// 5. 用户知识体系 —— 跨学科 MasteryForest + 巩固调度
// ----------------------------------------------------------------------------

/**
 * 用户 × 学科的掌握度森林（MasteryForest）——
 * 一棵树代表一个学科的一棵知识图谱的掌握状态。
 * 引擎按学科组织，而不是按 RoleType。
 */
export interface UserMasteryForest {
  userId: string
  /** 多棵学科树 */
  trees: SubjectMasteryTree[]
  updatedAt: string
}

export interface SubjectMasteryTree {
  subjectId: string
  graphId: string
  /** 树上的每个节点 = 一条 MasteryState */
  nodeStates: MasteryState[]
  /** 这棵树的成长轨迹：每周 / 每月的平均掌握度 */
  growthHistory: GrowthSnapshot[]
}

export interface GrowthSnapshot {
  at: string
  averageMastery: number
  /** 已掌握节点数（>=0.8） */
  masteredNodes: number
  /** 在学节点数（0.4-0.8） */
  learningNodes: number
  /** 薄弱节点数（<0.4） */
  weakNodes: number
}

/**
 * 巩固调度项 —— 由遗忘曲线驱动，定时把快忘的知识点拉出来复习。
 */
export interface ReviewScheduleItem {
  userId: string
  subjectId: string
  knowledgePointId: string
  /** 预计遗忘时间（ISO），到了就会推送 */
  scheduledFor: string
  /** 当前掌握度 */
  currentMastery: number
  /** 用了什么方法去巩固 */
  suggestedMethodId: string
  /** 触发原因：遗忘 / 关联薄弱点 / 错题归档 */
  reason: 'forgetting' | 'related_weakness' | 'error_archive' | 'milestone'
}

// ----------------------------------------------------------------------------
// 6/7. 采集体系（SourceAdapter）
// ----------------------------------------------------------------------------

/**
 * 来源适配器 —— 任何一种数据源（题库 / 教材 / 资料）都实现这个接口。
 * 引擎通过 SourceRegistry 调度它们，把它们解析成 KnowledgePoint / Exercise / Material 节点。
 */
export interface SourceAdapter {
  id: string                       // e.g. "pep-digital-textbook", "ruankao-official-pdf"
  displayName: string
  kind: 'textbook' | 'question_bank' | 'material'
  /** 该 adapter 能产出什么类型的对象 */
  produces: Array<'KnowledgePoint' | 'Exercise' | 'Material' | 'KnowledgeConnection'>
  /** 该 adapter 是否需要鉴权 */
  requiresAuth: boolean
  /** 该 adapter 是否需要联网拉取（false = 纯本地 JSON / PDF） */
  network: boolean
  /** 拉取并解析某个 locator 下的内容 */
  fetch(args: {
    locator: string
    /** 适配器自定义参数，如 pdf 页码 / API key */
    params?: Record<string, unknown>
  }): Promise<SourceFetchResult>
}

export interface SourceFetchResult {
  knowledgePoints?: KnowledgePoint[]
  exercises?: Exercise[]
  materials?: LearningMaterial[]
  connections?: KnowledgeConnection[]
  /** 原始 payload 留底，方便后续排查 */
  raw?: unknown
}

/**
 * 题库条目 —— 由题库类 SourceAdapter 产出。
 */
export interface Exercise {
  id: string
  subjectId: string
  knowledgePointIds: string[]      // 这道题考察的知识点
  kind: 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay' | 'true_false'
  stem: string                     // 题干
  options?: Array<{ key: string; text: string }>
  answer: string | string[]
  /** 0-1 难度 */
  difficulty: number
  /** 题源标签，如 "2020 真题" / "人教同步练习" */
  sourceTag?: string
  /** 解析 */
  explanation?: string
  tags?: string[]
}

/**
 * 学习资料条目 —— 视频 / 文章 / 讲义
 */
export interface LearningMaterial {
  id: string
  subjectId: string
  knowledgePointIds: string[]
  kind: 'article' | 'video' | 'lecture_note' | 'cheatsheet' | 'mindmap'
  title: string
  /** 内容（Markdown / 视频 URL / PDF 路径） */
  content: string
  difficulty: number
  estimatedMinutes: number
  sourceTag?: string
}

// ----------------------------------------------------------------------------
// 8. 学科教学方案（Pedagogy）
// ----------------------------------------------------------------------------

/**
 * 教学法（Pedagogy）—— "怎么教"某个学科的总纲领。
 * 引擎调用 Pedagogy 来组织学习路径、生成 Prompt、安排方法组合。
 */
export interface Pedagogy {
  id: string                       // e.g. "primary-math-scaffold", "ruankao-exam-driven"
  displayName: string
  /** 适用学科域 */
  domain: Subject['domain']
  /** 教学风格：苏格拉底式 / 直接讲解 / 渐进式 / 考试驱动 */
  style: 'socratic' | 'direct' | 'scaffold' | 'exam_driven' | 'playful'
  /** 教学目标声明：希望学生通过这套方案达到什么 */
  goals: string[]
  /** 该 Pedagogy 用到的方法包组合 */
  methodStack: Array<{
    methodId: string
    /** 在教学的哪个阶段使用 */
    phase: 'intro' | 'explain' | 'practice' | 'review' | 'assessment'
    /** 该方法在学科中的权重 */
    weight: number
  }>
  /** Prompt 模板集：每个 phase 一个 */
  promptTemplates: Record<'intro' | 'explain' | 'practice' | 'review' | 'assessment', string>
  /** 激励方式 */
  motivation: {
    style: 'praise' | 'progress' | 'challenge' | 'achievement'
    pacingDaysPerWeek?: number
  }
  /** 默认参数 */
  defaultParameters: {
    dailyMinutes: number
    sessionMinutes: number
    reviewIntervalDays: number
  }
}

// ============================================================================
// 桌面端 / 多平台 相关扩展
// ============================================================================

/**
 * AI 服务商类型（多服务商管理）
 *  - openai    OpenAI 官方
 *  - deepseek  DeepSeek（OpenAI 兼容）
 *  - anthropic Anthropic（Claude）
 *  - ollama    本地 Ollama（OpenAI 兼容）
 *  - custom    自定义 OpenAI 兼容 baseURL
 */
export type AIVendor = 'openai' | 'deepseek' | 'anthropic' | 'ollama' | 'custom'

/**
 * 用户配置的 AI 服务商记录
 *  - apiKey 永远不应被前端直接持有，应通过 Electron safeStorage 加密后存储
 *  - is_active=1 的那条会被当前请求使用
 */
export interface AIProviderConfig {
  id: string
  userId: string
  displayName: string               // 用户给这条配置起的名字，例如"主力 DeepSeek"
  vendor: AIVendor
  baseUrl: string
  model: string
  /** 加密后的 api key（base64 字符串）。解密由调用方负责，前端不应拿到明文 */
  encryptedApiKey: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 单个 provider 的明文配置（仅在 Electron 主进程或后端内部使用时存在）。
 * 前端拿到的是 AIProviderConfig，密文 apiKey 在主进程解密后再用。
 */
export interface AIProviderCredentials {
  configId: string
  vendor: AIVendor
  baseUrl: string
  model: string
  apiKey: string
}

/**
 * 用户在某个学科的选修记录（取代旧的 role-only 模型）
 */
export interface SubjectEnrollment {
  userId: string
  subjectId: string
  enrolledAt: string
}

/**
 * 用户在某个学科的私有知识图谱快照（覆盖原 KnowledgeGraph）。
 * 学科是图谱的容器，用户在不同学科间拥有不同的图谱。
 */
export interface UserKnowledgeGraphRecord {
  userId: string
  subjectId: string
  graphId: string
  graph: KnowledgeGraph
  updatedAt: string
}

/**
 * 采集源入库记录（用户在桌面端拖入的本地文件被 SourceAdapter 抽取后入库）
 */
export interface SourceLibraryEntry {
  id: string
  userId: string
  kind: SourceAdapter['kind']
  displayName: string
  adapterId: string
  locator: string
  files: Array<{
    path: string              // 绝对路径
    size: number
    mtime: string
  }>
  /** 该来源抽取出的 KP/Exercise/Material */
  extracted: {
    knowledgePoints?: KnowledgePoint[]
    exercises?: Exercise[]
    materials?: LearningMaterial[]
    connections?: KnowledgeConnection[]
  }
  createdAt: string
  updatedAt: string
}

// ----------------------------------------------------------------------------
// 9. 家庭与亲子关系（Phase 1）
// ----------------------------------------------------------------------------

export interface Family {
  id: string
  displayName: string
  createdBy: string          // 创建者 userId
  createdAt: string
}

export type FamilyRole = 'parent' | 'child'

export interface FamilyMember {
  familyId: string
  userId: string
  role: FamilyRole
  /** 孩子对家长的称呼，如 "妈妈" / "爸爸" */
  alias?: string
  joinedAt: string
}

// ----------------------------------------------------------------------------
// 10. 首次测评（Placement, IRT）
// ----------------------------------------------------------------------------

/** 单道测评题在 IRT 维度上的"画像" */
export interface PlacementItem {
  exerciseId: string
  knowledgePointId: string
  /** IRT 难度 b：越大越难（logit 单位） */
  difficulty: number
  /** IRT 区分度 a（1PL 简化为 1） */
  discrimination: number
  /** 猜测概率 c */
  guessing: number
}

export interface PlacementSession {
  id: string
  userId: string
  subjectId: string
  startedAt: string
  endedAt?: string
  /** IRT 估计的能力 θ（logit） */
  theta: number
  /** 标准误差 SE */
  se: number
  /** 答题历史 */
  responses: Array<{
    itemId: string
    correct: boolean
    answeredAt: string
    durationMs: number
  }>
  /** 输出画像：每个 KP 的初始掌握度（0-1） */
  profile: Record<string, number>
}

// ----------------------------------------------------------------------------
// 11. 家长课程 / 目标（影响每日计划）
// ----------------------------------------------------------------------------

/**
 * 家长课程：把"一段学习内容"挂到孩子身上，带时间表。
 * 引擎会把它展开成 KP 范围，在每日计划里插队。
 */
export interface ParentCurriculum {
  id: string
  familyId: string
  parentUserId: string
  childUserId: string
  subjectId: string
  title: string
  scope: ParentCurriculumScope
  schedule: {
    startDate: string                 // YYYY-MM-DD
    endDate: string
    /** 0=Sun, 1=Mon ... 6=Sat */
    weekdays: number[]
    /** 每日该课程投入分钟数 */
    dailyMinutes: number
  }
  /** 0-1，家长手动可调；越大越优先 */
  priority: number
  status: 'active' | 'paused' | 'completed' | 'archived'
  createdAt: string
  updatedAt: string
}

export type ParentCurriculumScope =
  | { kind: 'chapter'; chapter: string }
  | { kind: 'kp_ids'; knowledgePointIds: string[] }
  | { kind: 'kp_tags'; tags: string[] }
  | { kind: 'full_subject' }

/**
 * 家长目标：可量化的产出指标 + deadline。
 */
export interface ParentGoal {
  id: string
  familyId: string
  parentUserId: string
  childUserId: string
  subjectId: string
  title: string
  description?: string
  metric: ParentGoalMetric
  deadline: string                    // ISO date
  status: 'active' | 'achieved' | 'expired' | 'abandoned'
  progress: {
    lastCheckedAt: string
    /** 0-1 */
    value: number
    note: string
  }
  createdAt: string
  updatedAt: string
}

export type ParentGoalMetric =
  | { kind: 'mastery_threshold'; knowledgePointIds: string[]; threshold: number }
  | { kind: 'accuracy_threshold'; minAccuracy: number; minExercises: number }
  | { kind: 'kp_coverage'; knowledgePointIds: string[] }
  | { kind: 'manual' }

// ----------------------------------------------------------------------------
// 12. 每日计划块（DailyPlanBlock）
// ----------------------------------------------------------------------------

export type DailyPlanBlockKind = 'preview' | 'review' | 'learn' | 'practice'

/** 块从哪里来 —— UI 上展示"为什么今天要学这个" */
export interface DailyPlanBlockSourceRef {
  kind: 'curriculum' | 'goal' | 'review' | 'weakness' | 'preview' | 'manual'
  refId: string
  /** 简短文案 */
  label: string
}

/**
 * 每日计划块（每个块 ≈ 一个 15-30 分钟的学习单元）。
 * 由 DailyPlanEngine 产出，覆盖：复习到期 / 课程插队 / 目标紧迫 / 薄弱 / 预习。
 */
export interface DailyPlanBlock {
  id: string
  date: string                        // YYYY-MM-DD
  userId: string
  subjectId: string
  kind: DailyPlanBlockKind
  title: string
  knowledgePointIds: string[]
  estimatedMinutes: number
  reason: string                      // AI 推送原因（中文一句话）
  sourceRef: DailyPlanBlockSourceRef
  done: boolean
  doneAt?: string
  resourceRefs: Array<{
    kind: 'video' | 'article' | 'exercise' | 'graph'
    refId: string
  }>
  createdAt: string
}

// ----------------------------------------------------------------------------
// 13. 5 大学习场景（LessonScene）
// ----------------------------------------------------------------------------

export type LessonSceneKind =
  | 'daily'           // 每日计划
  | 'textbook'        // 教材跟进
  | 'graph'           // 知识图谱
  | 'exam'            // 测评考试
  | 'chat'            // AI 问答

export interface LessonScene {
  id: string
  kind: LessonSceneKind
  subjectId: string
  userId: string
  title: string
  context: {
    knowledgePointIds?: string[]
    chapter?: string
    materialIds?: string[]
  }
  createdAt: string
}

// ----------------------------------------------------------------------------
// 14. 学习报告（家长 / 孩子双视角）
// ----------------------------------------------------------------------------

export interface DailyReport {
  id: string
  date: string
  userId: string
  totalMinutes: number
  blocksPlanned: number
  blocksDone: number
  exercisesDone: number
  exercisesCorrect: number
  /** 今日 Top-3 薄弱维度 */
  topWeakness: Array<{ knowledgePointId: string; mastery: number; reason: string }>
  /** 给家长的话 */
  parentNote: string
  /** 给孩子的话 */
  kidNote: string
  generatedAt: string
}
