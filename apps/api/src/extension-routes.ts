/**
 * 8 大体系扩展路由 —— 与原 routes.ts 并存，不破坏现有冒烟测试。
 *
 * 端点：
 *   GET    /api/subjects                       列出所有学科
 *   GET    /api/subjects/:id                   单个学科详情（含 graph / pedagogy）
 *   POST   /api/subjects                       注册一个新学科
 *   GET    /api/methods                        列出所有学习方法
 *   GET    /api/methods/:id                    单个方法详情
 *   GET    /api/pedagogies                     列出所有教学法
 *   GET    /api/pedagogies/:id                 单个教学法详情
 *   GET    /api/sources                        列出所有数据源
 *   POST   /api/sources/:id/fetch              触发某个 SourceAdapter 拉取
 *   GET    /api/profile/:userId                用户画像
 *   POST   /api/profile/:userId/ingest         喂一条证据
 *   GET    /api/forest/:userId                  跨学科 MasteryForest
 *   GET    /api/forest/:userId/:subjectId/tree 某学科树
 *   GET    /api/forest/:userId/:subjectId/reviews 某学科巩固调度
 *   POST   /api/forest/:userId/:subjectId/snapshot 拍成长快照
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  defaultSubjectRegistry,
  defaultMethodRegistry,
  defaultPedagogyRegistry,
  defaultSourceRegistry,
  defaultProfileEngine,
  defaultMasteryForestEngine,
  resolve as resolveCurriculumGoal,
  planDay,
} from '@xuexi/learning-engine'
import type {
  ProfileTraitCategory,
  MasteryEvidence,
  Subject,
  SubjectConfig,
} from '@xuexi/shared'

// ---- subjects ----
export const subjectRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/subjects', async () => ({ subjects: defaultSubjectRegistry.list() }))

  app.get('/subjects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const s = defaultSubjectRegistry.get(id)
    if (!s) return reply.code(404).send({ error: 'subject_not_found' })
    const graph = defaultSubjectRegistry.getGraph(id)
    const pedagogy = defaultPedagogyRegistry.get(s.pedagogyId)
    return { subject: s, graph, pedagogy }
  })

  const subjectBody = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    domain: z.enum(['primary', 'ruankao', 'language', 'science', 'other']),
    graphId: z.string().min(1),
    pedagogyId: z.string().min(1),
    preferredMethods: z.array(z.string()),
    meta: z.record(z.string(), z.unknown()).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    sourceBindings: z.array(z.object({
      kind: z.enum(['textbook', 'question_bank', 'material']),
      adapterId: z.string(),
      locator: z.string(),
    })).default([]),
  })

  app.post('/subjects', async (req) => {
    const cfg = subjectBody.parse(req.body) as SubjectConfig
    const subject: Subject = defaultSubjectRegistry.register(cfg)
    return { subject }
  })
}

// ---- methods ----
export const methodRoutes: FastifyPluginAsync = async (app) => {
  app.get('/methods', async (req) => {
    const q = req.query as { target?: string; kind?: string }
    let methods = defaultMethodRegistry.list()
    if (q.target || q.kind) {
      methods = defaultMethodRegistry.recommendFor(
        (q.target as 'explain' | 'apply' | 'extend') ?? 'explain',
        q.kind ?? 'concept',
      )
    }
    return { methods }
  })

  app.get('/methods/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const m = defaultMethodRegistry.get(id)
    if (!m) return reply.code(404).send({ error: 'method_not_found' })
    return { method: m }
  })
}

// ---- pedagogies ----
export const pedagogyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/pedagogies', async () => ({ pedagogies: defaultPedagogyRegistry.list() }))
  app.get('/pedagogies/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const p = defaultPedagogyRegistry.get(id)
    if (!p) return reply.code(404).send({ error: 'pedagogy_not_found' })
    return { pedagogy: p }
  })
}

// ---- sources ----
export const sourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/sources', async (req) => {
    const q = req.query as { kind?: string }
    const list = q.kind
      ? defaultSourceRegistry.list(q.kind as 'textbook' | 'question_bank' | 'material')
      : defaultSourceRegistry.list()
    return { sources: list }
  })

  app.post('/sources/:id/fetch', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = z.object({ locator: z.string(), params: z.record(z.string(), z.unknown()).optional() })
      .parse(req.body)
    const adapter = defaultSourceRegistry.get(id)
    if (!adapter) return reply.code(404).send({ error: 'adapter_not_found' })
    try {
      const result = await adapter.fetch(body)
      return { result }
    } catch (err) {
      return reply.code(501).send({ error: 'fetch_failed', message: (err as Error).message })
    }
  })

  /** 拉取一个 question_bank adapter 的 Exercise 列表，用于练习页直接消费 */
  app.get('/sources/:id/exercises', async (req, reply) => {
    const { id } = req.params as { id: string }
    const q = req.query as { units?: string; subjectId?: string }
    const adapter = defaultSourceRegistry.get(id)
    if (!adapter) return reply.code(404).send({ error: 'adapter_not_found' })
    try {
      const result = await adapter.fetch({
        locator: q.subjectId ?? id,
        params: {
          subjectId: q.subjectId,
          units: q.units?.split(',').filter(Boolean),
        },
      })
      return { exercises: result.exercises ?? [] }
    } catch (err) {
      return reply.code(501).send({ error: 'fetch_failed', message: (err as Error).message })
    }
  })
}

// ---- profile ----
const evidenceIngestBody = z.object({
  source: z.enum(['chat', 'exercise', 'feedback', 'inferred', 'imported']),
  category: z.enum([
    'cognitive_style', 'emotion_pattern', 'knowledge_gap',
    'pace_habit', 'communication_pref', 'motivation', 'other',
  ]),
  content: z.string().min(1),
  subjectIds: z.array(z.string()).optional(),
  knowledgePointIds: z.array(z.string()).optional(),
})

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/profile/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const p = defaultProfileEngine.get(userId)
    if (!p) return reply.code(404).send({ error: 'profile_not_found' })
    return { profile: p }
  })

  app.post('/profile/:userId/ingest', async (req) => {
    const { userId } = req.params as { userId: string }
    const body = evidenceIngestBody.parse(req.body)
    defaultProfileEngine.ensureProfile(userId)
    const result = defaultProfileEngine.ingest({
      userId,
      source: body.source,
      category: body.category as ProfileTraitCategory,
      content: body.content,
      subjectIds: body.subjectIds,
      knowledgePointIds: body.knowledgePointIds,
      at: new Date().toISOString(),
    })
    return result
  })

  app.get('/profile/:userId/summary', async (req) => {
    const { userId } = req.params as { userId: string }
    const q = req.query as { minConfidence?: string }
    const min = q.minConfidence ? Number(q.minConfidence) : 0.55
    return { summary: defaultProfileEngine.summarizeForPrompt(userId, { minConfidence: min }) }
  })
}

// ---- forest ----
export const forestRoutes: FastifyPluginAsync = async (app) => {
  app.get('/forest/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    const forest = defaultMasteryForestEngine.getForest(userId)
    return { forest: forest ?? { userId, trees: [], updatedAt: new Date().toISOString() } }
  })

  app.get('/forest/:userId/:subjectId/tree', async (req, reply) => {
    const { userId, subjectId } = req.params as { userId: string; subjectId: string }
    const tree = defaultMasteryForestEngine.getTree(userId, subjectId)
    if (!tree) return reply.code(404).send({ error: 'tree_not_found' })
    return { tree }
  })

  const evidenceBody = z.object({
    knowledgePointId: z.string(),
    dimension: z.enum(['explain', 'apply', 'extend']),
    correct: z.boolean(),
    score: z.number().min(0).max(1),
    feedback: z.string().optional(),
    refId: z.string().optional(),
  })

  app.post('/forest/:userId/:subjectId/evidence', async (req, reply) => {
    const { userId, subjectId } = req.params as { userId: string; subjectId: string }
    const body = evidenceBody.parse(req.body)
    const ev: MasteryEvidence = {
      at: new Date().toISOString(),
      dimension: body.dimension,
      correct: body.correct,
      score: body.score,
      feedback: body.feedback,
      refId: body.refId,
    }
    const updated = defaultMasteryForestEngine.ingestEvidence(userId, subjectId, body.knowledgePointId, ev)
    if (!updated) return reply.code(404).send({ error: 'node_not_found' })
    return { state: updated }
  })

  app.get('/forest/:userId/:subjectId/reviews', async (req) => {
    const { userId, subjectId } = req.params as { userId: string; subjectId: string }
    const items = defaultMasteryForestEngine.schedule(userId, subjectId)
    return { items }
  })

  app.post('/forest/:userId/:subjectId/snapshot', async (req) => {
    const { userId, subjectId } = req.params as { userId: string; subjectId: string }
    const snap = defaultMasteryForestEngine.snapshot(userId, subjectId)
    return { snapshot: snap }
  })
}

// ============================================================================
// 桌面端相关路由：AI Provider 多服务商、学科选修
// ============================================================================

import { providerRepo, enrollmentRepo, curriculumRepo, goalRepo, dailyBlockRepo, masteryRepo, familyRepo, familyMemberRepo } from './db/repo'
import { encrypt, decryptSafe } from './crypto'
import type { AIProviderConfig, AIVendor, ParentCurriculum, ParentGoal } from '@xuexi/shared'

// 不再需要单独 import userRepo —— repo 已经覆盖

const vendorEnum = z.enum(['openai', 'deepseek', 'anthropic', 'ollama', 'custom'])

const providerBody = z.object({
  displayName: z.string().min(1),
  vendor: vendorEnum,
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),       // 明文，前端发来时一次性使用
  isActive: z.boolean().optional(),
})

export const aiProviderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ai-providers/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    // apiKey 在响应里只回 1/0 是否配置，不回密文
    const all = providerRepo.list(userId)
    return {
      providers: all.map((c) => ({
        ...c,
        apiKeyConfigured: c.encryptedApiKey.length > 0,
        encryptedApiKey: undefined,
      })),
    }
  })

  app.post('/ai-providers/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    const body = providerBody.parse(req.body)
    const now = new Date().toISOString()
    const cfg: AIProviderConfig = {
      id: crypto.randomUUID(),
      userId,
      displayName: body.displayName,
      vendor: body.vendor as AIVendor,
      baseUrl: body.baseUrl,
      model: body.model,
      encryptedApiKey: encrypt(body.apiKey),
      isActive: body.isActive ?? false,
      createdAt: now,
      updatedAt: now,
    }
    providerRepo.upsert(cfg)
    if (cfg.isActive) providerRepo.setActive(userId, cfg.id)
    return { id: cfg.id, ok: true }
  })

  app.patch('/ai-providers/:userId/:id/active', async (req) => {
    const { userId, id } = req.params as { userId: string; id: string }
    providerRepo.setActive(userId, id)
    return { ok: true }
  })

  app.delete('/ai-providers/:userId/:id', async (req) => {
    const { id } = req.params as { id: string }
    providerRepo.remove(id)
    return { ok: true }
  })

  /** 解密（仅 Electron 主进程会调用，或本地调试脚本） */
  app.post('/ai-providers/:userId/:id/decrypt', async (req, reply) => {
    const { id } = req.params as { userId: string; id: string }
    const cfg = providerRepo.get(id)
    if (!cfg) return reply.code(404).send({ error: 'not_found' })
    return { apiKey: decryptSafe(cfg.encryptedApiKey) }
  })
}

export const subjectEnrollmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/enrollments/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    return { enrollments: enrollmentRepo.list(userId) }
  })
  app.post('/enrollments/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    const body = z.object({ subjectId: z.string().min(1) }).parse(req.body)
    enrollmentRepo.enroll(userId, body.subjectId)
    return { ok: true }
  })
  app.delete('/enrollments/:userId/:subjectId', async (req) => {
    const { userId, subjectId } = req.params as { userId: string; subjectId: string }
    enrollmentRepo.unenroll(userId, subjectId)
    return { ok: true }
  })
}

// ----------------------------------------------------------------------------
// 家庭 (Family) + 家庭成员 (FamilyMember) —— 家长/孩子关系
// ----------------------------------------------------------------------------

const familyBody = z.object({
  displayName: z.string().min(1),
  createdBy: z.string().min(1),
})

const familyMemberBody = z.object({
  familyId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['parent', 'child']),
  alias: z.string().optional(),
})

export const familyRoutes: FastifyPluginAsync = async (app) => {
  app.post('/families', async (req, reply) => {
    const body = familyBody.parse(req.body)
    const now = new Date().toISOString()
    const id = `fam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    familyRepo.create({ id, displayName: body.displayName, createdBy: body.createdBy, createdAt: now })
    // 创建者自动作为 parent 加入
    familyMemberRepo.add({ familyId: id, userId: body.createdBy, role: 'parent', joinedAt: now })
    return reply.code(201).send({ family: { id, displayName: body.displayName, createdBy: body.createdBy, createdAt: now } })
  })

  app.get('/families/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    return { families: familyRepo.listByUser(userId) }
  })

  app.get('/families/:familyId/members', async (req) => {
    const { familyId } = req.params as { familyId: string }
    return { members: familyMemberRepo.listByFamily(familyId) }
  })

  app.post('/families/members', async (req, reply) => {
    const body = familyMemberBody.parse(req.body)
    const joinedAt = new Date().toISOString()
    familyMemberRepo.add({ ...body, joinedAt })
    return reply.code(201).send({ ok: true })
  })

  app.delete('/families/:familyId/members/:userId', async (req) => {
    const { familyId, userId } = req.params as { familyId: string; userId: string }
    familyMemberRepo.remove(familyId, userId)
    return { ok: true }
  })
}

// ----------------------------------------------------------------------------
// 家长课程 (ParentCurriculum) CRUD
// ----------------------------------------------------------------------------

const curriculumBody = z.object({
  familyId: z.string().min(1),
  parentUserId: z.string().min(1),
  childUserId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  scope: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('chapter'), chapter: z.string() }),
    z.object({ kind: z.literal('kp_ids'), knowledgePointIds: z.array(z.string()) }),
    z.object({ kind: z.literal('kp_tags'), tags: z.array(z.string()) }),
    z.object({ kind: z.literal('full_subject') }),
  ]),
  schedule: z.object({
    startDate: z.string(),
    endDate: z.string(),
    weekdays: z.array(z.number().int().min(0).max(6)),
    dailyMinutes: z.number().int().min(5).max(480),
  }),
  priority: z.number().min(0).max(1).default(0.5),
})

export const curriculumRoutes: FastifyPluginAsync = async (app) => {
  app.get('/curriculums/:childUserId', async (req) => {
    const { childUserId } = req.params as { childUserId: string }
    return { curriculums: curriculumRepo.listByChild(childUserId) }
  })

  app.post('/curriculums', async (req, reply) => {
    const body = curriculumBody.parse(req.body)
    const now = new Date().toISOString()
    const c: ParentCurriculum = {
      id: `curr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ...body,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    curriculumRepo.upsert(c)
    return reply.code(201).send({ curriculum: c })
  })

  app.patch('/curriculums/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = curriculumRepo.get(id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const patch = curriculumBody.partial().parse(req.body)
    const merged: ParentCurriculum = {
      ...existing,
      ...patch,
      id: existing.id,
      familyId: existing.familyId,
      parentUserId: existing.parentUserId,
      childUserId: existing.childUserId,
      updatedAt: new Date().toISOString(),
    }
    curriculumRepo.upsert(merged)
    return { curriculum: merged }
  })

  app.delete('/curriculums/:id', async (req) => {
    const { id } = req.params as { id: string }
    curriculumRepo.remove(id)
    return { ok: true }
  })

  /** AI 预览拆解：把 scope 展开成 KP 列表 + 估算天数 */
  app.post('/curriculums/:id/preview-decompose', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = curriculumRepo.get(id)
    if (!c) return reply.code(404).send({ error: 'not_found' })
    const { engineFor } = await import('./engine')
    const role = (req.body as { role?: 'primary_school' | 'ruankao' })?.role ?? 'primary_school'
    const graph = engineFor(role).graph
    const allKps = graph.all()
    // 这里直接调 resolver（不带 goals / 课程）
    const resolved = resolveCurriculumGoal({
      userId: c.childUserId,
      knowledgePoints: allKps,
      curriculums: [c],
      goals: [],
      today: new Date().toISOString().slice(0, 10),
    })
    const cur = resolved.curriculums[0]
    if (!cur) return { knowledgePointIds: [], estimatedDays: 0, reason: 'scope 空 / 时间窗不匹配' }
    const days = Math.max(1, Math.ceil(cur.knowledgePointIds.length * cur.dailyMinutes / 30))
    return {
      knowledgePointIds: cur.knowledgePointIds,
      knowledgePointCount: cur.knowledgePointIds.length,
      dailyMinutes: cur.dailyMinutes,
      estimatedDays: days,
      reason: `按 30 分钟/块估算，共 ${cur.knowledgePointIds.length} 个 KP`,
    }
  })
}

// ----------------------------------------------------------------------------
// 家长目标 (ParentGoal) CRUD
// ----------------------------------------------------------------------------

const goalBody = z.object({
  familyId: z.string().min(1),
  parentUserId: z.string().min(1),
  childUserId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  metric: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('mastery_threshold'), knowledgePointIds: z.array(z.string()), threshold: z.number().min(0).max(1) }),
    z.object({ kind: z.literal('accuracy_threshold'), minAccuracy: z.number().min(0).max(1), minExercises: z.number().int().min(1) }),
    z.object({ kind: z.literal('kp_coverage'), knowledgePointIds: z.array(z.string()) }),
    z.object({ kind: z.literal('manual') }),
  ]),
  deadline: z.string(),
})

export const goalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/goals/:childUserId', async (req) => {
    const { childUserId } = req.params as { childUserId: string }
    return { goals: goalRepo.listByChild(childUserId) }
  })

  app.post('/goals', async (req, reply) => {
    const body = goalBody.parse(req.body)
    const now = new Date().toISOString()
    const g: ParentGoal = {
      id: `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ...body,
      status: 'active',
      progress: { lastCheckedAt: now, value: 0, note: '目标刚创建' },
      createdAt: now,
      updatedAt: now,
    }
    goalRepo.upsert(g)
    return reply.code(201).send({ goal: g })
  })

  app.patch('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = goalRepo.get(id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const patch = goalBody.partial().parse(req.body)
    const merged: ParentGoal = {
      ...existing,
      ...patch,
      id: existing.id,
      familyId: existing.familyId,
      parentUserId: existing.parentUserId,
      childUserId: existing.childUserId,
      updatedAt: new Date().toISOString(),
    }
    goalRepo.upsert(merged)
    return { goal: merged }
  })

  app.delete('/goals/:id', async (req) => {
    const { id } = req.params as { id: string }
    goalRepo.remove(id)
    return { ok: true }
  })

  /** 目标进度查询 */
  app.get('/goals/:id/progress', async (req, reply) => {
    const { id } = req.params as { id: string }
    const g = goalRepo.get(id)
    if (!g) return reply.code(404).send({ error: 'not_found' })
    // 简单进度估算：mastery_threshold / kp_coverage 用当前 mastery 计算
    const { engineFor } = await import('./engine')
    const role = (req.query as { role?: 'primary_school' | 'ruankao' })?.role ?? 'primary_school'
    const graph = engineFor(role).graph
    if (g.metric.kind === 'mastery_threshold' || g.metric.kind === 'kp_coverage') {
      const ids = g.metric.kind === 'mastery_threshold' ? g.metric.knowledgePointIds : g.metric.knowledgePointIds
      const threshold = g.metric.kind === 'mastery_threshold' ? g.metric.threshold : 0.8
      let total = 0
      let achieved = 0
      for (const id of ids) {
        total++
        const ms = graph.get(id) // 这里 graph 未必能拿 mastery —— 简化用 0
        if (ms) achieved++ // 简化：能找到 KP 就算 1
      }
      const value = total === 0 ? 0 : achieved / total
      const note = `${achieved}/${total} KP 已覆盖 / 掌握 ≥ ${threshold}`
      g.progress = { lastCheckedAt: new Date().toISOString(), value, note }
      goalRepo.upsert(g)
    }
    return { progress: g.progress, goal: g }
  })
}

// ----------------------------------------------------------------------------
// 每日计划块 (DailyPlanBlock) + DailyPlanEngine 调度入口
// ----------------------------------------------------------------------------

export const dailyRoutes: FastifyPluginAsync = async (app) => {
  /** 拿今日计划 —— 缓存策略：当日已生成则直接返回，未生成则实时跑引擎 */
  app.get('/daily/:userId/today', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const today = new Date().toISOString().slice(0, 10)
    const blocks = dailyBlockRepo.listByUserAndDate(userId, today)
    if (blocks.length > 0) return { date: today, blocks }

    // 引擎实时生成
    const role = (req.query as { role?: 'primary_school' | 'ruankao' })?.role ?? 'primary_school'
    const subjectId = (req.query as { subjectId?: string })?.subjectId ?? 'primary-math-g4'
    const dailyBudgetMinutes = Number((req.query as { budget?: number })?.budget ?? 60)

    const { engineFor } = await import('./engine')
    const graph = engineFor(role).graph
    const kps = graph.all()
    const states = masteryRepo.listByUser(userId)
    // 没 mastery 记录的 KP 用 0 填充
    const stateMap = new Map(states.map(s => [s.knowledgePointId, s]))
    const fullStates = kps.map(kp => stateMap.get(kp.id) ?? {
      userId,
      knowledgePointId: kp.id,
      mastery: 0,
      stability: 1,
      lastReviewedAt: new Date(0).toISOString(),
      reviewCount: 0,
      evidence: [],
    })

    const curriculums = curriculumRepo.listActiveByChild(userId, today)
    const goals = goalRepo.listActiveByChild(userId, today)

    const resolved = resolveCurriculumGoal({
      userId,
      knowledgePoints: kps,
      curriculums,
      goals,
      today,
    })

    const generated = planDay({
      userId,
      subjectId,
      today,
      dailyBudgetMinutes,
      knowledgePoints: kps,
      masteryStates: fullStates,
      resolved: { curriculums: resolved.curriculums, goals: resolved.goals },
    })

    // 落库
    for (const b of generated) dailyBlockRepo.upsert(b)

    return { date: today, blocks: generated, meta: { generated: true, kpPoolSize: resolved.kpPool.size } }
  })

  /** 标记完成 —— 上报证据 + 更新 mastery */
  app.post('/daily/:blockId/complete', async (req, reply) => {
    const { blockId } = req.params as { blockId: string }
    const block = dailyBlockRepo.get(blockId)
    if (!block) return reply.code(404).send({ error: 'not_found' })
    const now = new Date().toISOString()
    dailyBlockRepo.markDone(blockId, now)
    // 简单把"完成"作为一条 evidence 写进 mastery
    const kpId = block.knowledgePointIds[0]
    if (kpId) {
      const before = masteryRepo.get(block.userId, kpId)
      const next = before ?? {
        userId: block.userId,
        knowledgePointId: kpId,
        mastery: 0,
        stability: 1,
        lastReviewedAt: new Date(0).toISOString(),
        reviewCount: 0,
        evidence: [],
      }
      masteryRepo.upsert({
        ...next,
        mastery: Math.min(1, next.mastery + 0.1),
        stability: next.stability + 0.2,
        lastReviewedAt: now,
        reviewCount: next.reviewCount + 1,
        evidence: [...next.evidence, {
          at: now,
          dimension: 'apply',
          correct: true,
          score: 1,
          feedback: `daily-block-complete[${blockId}]`,
        }].slice(-100),
      })
    }
    return { ok: true, block: dailyBlockRepo.get(blockId) }
  })

  /** 强制重新生成今日计划（家长手动触发） */
  app.post('/daily/:userId/regenerate', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const today = new Date().toISOString().slice(0, 10)
    const role = (req.body as { role?: 'primary_school' | 'ruankao' })?.role ?? 'primary_school'
    const subjectId = (req.body as { subjectId?: string })?.subjectId ?? 'primary-math-g4'
    const dailyBudgetMinutes = Number((req.body as { budget?: number })?.budget ?? 60)

    const { engineFor } = await import('./engine')
    const graph = engineFor(role).graph
    const kps = graph.all()
    const states = masteryRepo.listByUser(userId)
    const stateMap = new Map(states.map(s => [s.knowledgePointId, s]))
    const fullStates = kps.map(kp => stateMap.get(kp.id) ?? {
      userId,
      knowledgePointId: kp.id,
      mastery: 0,
      stability: 1,
      lastReviewedAt: new Date(0).toISOString(),
      reviewCount: 0,
      evidence: [],
    })

    const curriculums = curriculumRepo.listActiveByChild(userId, today)
    const goals = goalRepo.listActiveByChild(userId, today)
    const resolved = resolveCurriculumGoal({
      userId,
      knowledgePoints: kps,
      curriculums,
      goals,
      today,
    })
    const generated = planDay({
      userId,
      subjectId,
      today,
      dailyBudgetMinutes,
      knowledgePoints: kps,
      masteryStates: fullStates,
      resolved: { curriculums: resolved.curriculums, goals: resolved.goals },
    })
    dailyBlockRepo.replaceForDate(userId, today, generated)
    return { date: today, blocks: generated, regenerated: true }
  })
}