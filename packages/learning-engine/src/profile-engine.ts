/**
 * ProfileEngine —— 用户身份画像 + AI 自动补全
 *
 * 三层结构：
 *   - static_: 注册时填或采集识别（学科 / 年级 / 角色 / 目标）
 *   - traits: AI 自动学习的特征条目（带置信度 / 证据数）
 *   - crossSubjectMemories: 跨学科长期记忆摘要（喂给对话）
 *
 * 补全策略：
 *   - 弱信号合并：多条弱证据合并成一条强 trait
 *   - 强信号即时生效：单条高置信度直接加进画像
 *   - 跨学科提炼：把多个学科的 trait 抽象成"用户学习风格"
 */

import type {
  UserIdentityProfile,
  ProfileTrait,
  ProfileTraitCategory,
} from '@xuexi/shared'

/**
 * 一条原始证据：由对话 / 答题 / 反馈产生。
 * evidence 会根据 category 聚合成 trait。
 */
export interface ProfileEvidence {
  userId: string
  source: ProfileTrait['source']
  category: ProfileTraitCategory
  content: string
  /** 这条证据涉及的学科 */
  subjectIds?: string[]
  knowledgePointIds?: string[]
  at: string
}

export interface ProfileEngine {
  /** 初始化画像 */
  ensureProfile(userId: string, seed?: Partial<UserIdentityProfile>): UserIdentityProfile
  /** 喂一条证据进去，引擎自动合并到 trait */
  ingest(ev: ProfileEvidence): { addedTrait?: ProfileTrait; updatedTrait?: ProfileTrait }
  /** 读取画像 */
  get(userId: string): UserIdentityProfile | undefined
  /** 喂给对话的画像摘要（带置信度阈值过滤） */
  summarizeForPrompt(userId: string, opts?: { minConfidence?: number }): string
  /** 跨学科长期记忆摘要，由引擎自动生成 */
  updateCrossSubjectMemories(userId: string, memories: string[]): void
}

/**
 * 内存版 ProfileEngine 实现 —— 单进程足够用，后续可替换为 Redis/DB 版本。
 */
export class InMemoryProfileEngine implements ProfileEngine {
  private profiles = new Map<string, UserIdentityProfile>()
  private traitIndex = new Map<string, ProfileTrait[]>() // userId -> traits

  ensureProfile(userId: string, seed?: Partial<UserIdentityProfile>): UserIdentityProfile {
    const existing = this.profiles.get(userId)
    if (existing) return existing

    const profile: UserIdentityProfile = {
      userId,
      static_: {
        displayName: seed?.static_?.displayName ?? 'Learner',
        subjects: seed?.static_?.subjects ?? [],
        grade: seed?.static_?.grade,
        role: seed?.static_?.role ?? 'primary_school',
        examTarget: seed?.static_?.examTarget,
        locale: seed?.static_?.locale ?? 'zh-CN',
      },
      traits: seed?.traits ?? [],
      crossSubjectMemories: seed?.crossSubjectMemories ?? [],
      preferences: seed?.preferences ?? {},
      version: 1,
      updatedAt: new Date().toISOString(),
    }
    this.profiles.set(userId, profile)
    this.traitIndex.set(userId, profile.traits)
    return profile
  }

  ingest(ev: ProfileEvidence): { addedTrait?: ProfileTrait; updatedTrait?: ProfileTrait } {
    const profile = this.ensureProfile(ev.userId)
    const traits = this.traitIndex.get(ev.userId) ?? []

    // 找同 category 的相似 trait（简单做法：同 category + 内容关键词匹配）
    const similar = traits.find(t =>
      t.category === ev.category && this.textSimilar(t.content, ev.content) > 0.6
    )

    if (similar) {
      similar.evidenceCount += 1
      similar.lastSeenAt = ev.at
      // 置信度提升：cap 到 0.95
      similar.confidence = Math.min(0.95, similar.confidence + 0.05)
      similar.source = similar.source === 'inferred' ? ev.source : similar.source
      profile.version += 1
      profile.updatedAt = ev.at
      return { updatedTrait: similar }
    }

    // 创建新 trait
    const trait: ProfileTrait = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: ev.category,
      content: ev.content,
      confidence: 0.35,
      evidenceCount: 1,
      firstSeenAt: ev.at,
      lastSeenAt: ev.at,
      source: ev.source,
      subjectIds: ev.subjectIds,
      knowledgePointIds: ev.knowledgePointIds,
    }
    profile.traits.push(trait)
    this.traitIndex.set(ev.userId, profile.traits)
    profile.version += 1
    profile.updatedAt = ev.at
    return { addedTrait: trait }
  }

  get(userId: string): UserIdentityProfile | undefined {
    return this.profiles.get(userId)
  }

  summarizeForPrompt(userId: string, opts?: { minConfidence?: number }): string {
    const profile = this.profiles.get(userId)
    if (!profile) return ''
    const min = opts?.minConfidence ?? 0.55
    const usable = profile.traits.filter(t => t.confidence >= min)
    if (usable.length === 0) return ''
    const lines = usable.map(t => `- [${t.category}] ${t.content} (置信度 ${t.confidence.toFixed(2)})`)
    return ['# 用户画像（自动学习）', ...lines, '# 跨学科记忆', ...profile.crossSubjectMemories].join('\n')
  }

  updateCrossSubjectMemories(userId: string, memories: string[]): void {
    const profile = this.ensureProfile(userId)
    profile.crossSubjectMemories = memories
    profile.version += 1
    profile.updatedAt = new Date().toISOString()
  }

  /** 极简文本相似度：基于字符集合重叠 */
  private textSimilar(a: string, b: string): number {
    const sa = new Set(a.replace(/\s+/g, ''))
    const sb = new Set(b.replace(/\s+/g, ''))
    let inter = 0
    for (const c of sa) if (sb.has(c)) inter += 1
    return inter / Math.max(sa.size, sb.size, 1)
  }
}

export const defaultProfileEngine: ProfileEngine = new InMemoryProfileEngine()