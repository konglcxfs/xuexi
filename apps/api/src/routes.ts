import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { engine } from './engine.js'
import { MasteryEngine } from '@xuexi/learning-engine'
import type {
  ChatMessage,
  LearningPlan,
  MasteryEvidence,
  RoleType,
} from '@xuexi/shared'

/**
 * 路由：用户、知识图谱、掌握度、薄弱点、计划、AI 对话。
 *
 * 设计原则：
 *  - 所有路由都按用户 + 角色 走 engine，role-aware。
 *  - 异常都返回带 code/message 的 JSON，便于前端处理。
 *  - 不做完整鉴权（本地用），保留 hook 位置。
 */

const userBody = z.object({
  displayName: z.string().min(1),
  role: z.enum(['primary_school', 'ruankao']),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export const userRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/users', async (req, reply) => {
    const body = userBody.parse(req.body)
    const id = crypto.randomUUID()
    engine.repo.createUser({
      id,
      displayName: body.displayName,
      role: body.role as RoleType,
      meta: body.meta,
    })
    // 首次创建用户时，确保 mastery 行存在
    const points = engine.for(body.role as RoleType).graph.all()
    const tx = engine.repo
    for (const p of points) {
      const existing = tx.getMastery(id, p.id)
      if (!existing) {
        tx.upsertMastery({
          userId: id,
          knowledgePointId: p.id,
          mastery: 0,
          stability: 1,
          lastReviewedAt: new Date().toISOString(),
          reviewCount: 0,
          evidence: [],
        })
      }
    }
    return { id }
  })

  app.get('/users/:id', async (req) => {
    const { id } = req.params as { id: string }
    const u = engine.repo.getUser(id)
    if (!u) throw new Error('user_not_found')
    return u
  })
}

// ---- knowledge graph ----
export const graphRoutes: FastifyPluginAsync = async (app) => {
  app.get('/graph/:role', async (req) => {
    const { role } = req.params as { role: RoleType }
    return { points: engine.for(role).graph.all() }
  })

  app.get('/graph/:role/topological', async (req) => {
    const { role } = req.params as { role: RoleType }
    return { order: engine.for(role).graph.topologicalOrder() }
  })
}

// ---- mastery + evidence ----
const evidenceBody = z.object({
  userId: z.string(),
  knowledgePointId: z.string(),
  dimension: z.enum(['explain', 'apply', 'extend']),
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  feedback: z.string().optional(),
  refId: z.string().optional(),
})

export const masteryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/mastery/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    return engine.repo.listMastery(userId)
  })

  app.post('/evidence', async (req) => {
    const body = evidenceBody.parse(req.body)
    const user = engine.repo.getUser(body.userId)
    if (!user) throw new Error('user_not_found')
    const evidence: MasteryEvidence = {
      at: new Date().toISOString(),
      dimension: body.dimension,
      correct: body.correct,
      score: body.score,
      feedback: body.feedback,
      refId: body.refId,
    }
    const existing =
      engine.repo.getMastery(body.userId, body.knowledgePointId) ?? {
        userId: body.userId,
        knowledgePointId: body.knowledgePointId,
        mastery: 0,
        stability: 1,
        lastReviewedAt: new Date().toISOString(),
        reviewCount: 0,
        evidence: [],
      }
    const updated = MasteryEngine.update(existing, evidence)
    engine.repo.upsertMastery(updated)

    // 自动写入一条"反馈记忆"
    if (body.feedback) {
      engine.repo.addMemory({
        id: crypto.randomUUID(),
        userId: body.userId,
        kind: 'feedback',
        content: body.feedback,
        knowledgePointIds: [body.knowledgePointId],
        createdAt: new Date().toISOString(),
        weight: 1,
      })
    }
    return updated
  })
}

// ---- weakness ----
export const weaknessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/weakness/:userId/latest', async (req) => {
    const { userId } = req.params as { userId: string }
    return engine.repo.getLatestWeaknessReport(userId)
  })

  app.post('/weakness/run/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const user = engine.repo.getUser(userId)
    if (!user) return reply.code(404).send({ error: 'user_not_found' })
    const states = engine.repo.listMastery(userId)
    const report = await engine.diagnostics(user.role).diagnose({ userId, states })
    const id = crypto.randomUUID()
    engine.repo.saveWeaknessReport(report, id)
    return { id, report }
  })
}

// ---- plans ----
const planBody = z.object({
  userId: z.string(),
  goal: z.string().min(1),
  startFromId: z.string().optional(),
  dailyMinutes: z.number().min(10).max(360).optional(),
  totalDays: z.number().min(1).max(60).optional(),
})

export const planRoutes: FastifyPluginAsync = async (app) => {
  app.post('/plans', async (req, reply) => {
    const body = planBody.parse(req.body)
    const user = engine.repo.getUser(body.userId)
    if (!user) return reply.code(404).send({ error: 'user_not_found' })
    const states = engine.repo.listMastery(body.userId)
    const gen = engine.plan(user.role)
    const plan = gen.generate({
      userId: body.userId,
      states,
      goal: body.goal,
      startFromId: body.startFromId,
      dailyMinutes: body.dailyMinutes,
      totalDays: body.totalDays,
    })
    engine.repo.savePlan(plan)
    // 把计划目标存为 milestone 记忆
    engine.repo.addMemory({
      id: crypto.randomUUID(),
      userId: body.userId,
      kind: 'milestone',
      content: `制定了计划：${plan.title}`,
      knowledgePointIds: [],
      createdAt: new Date().toISOString(),
      weight: 1,
    })
    return plan
  })

  app.get('/plans/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    return engine.repo.listPlansForUser(userId)
  })

  app.get('/plans/by-id/:id', async (req) => {
    const { id } = req.params as { id: string }
    const plan = engine.repo.getPlan(id)
    if (!plan) return null
    return plan
  })
}

// ---- AI chat ----
const chatBody = z.object({
  userId: z.string(),
  sessionId: z.string().optional(),
  knowledgePointId: z.string().optional(),
  planTaskId: z.string().optional(),
  state: z.enum(['idle', 'explaining', 'practicing', 'reviewing', 'planning']).default('idle'),
  message: z.string().min(1),
})

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post('/chat', async (req, reply) => {
    const body = chatBody.parse(req.body)
    const user = engine.repo.getUser(body.userId)
    if (!user) return reply.code(404).send({ error: 'user_not_found' })

    // 1. 找/建 session
    let session =
      body.sessionId ? engine.repo.getSession(body.sessionId) : null
    if (!session || session.userId !== body.userId) {
      session = {
        id: crypto.randomUUID(),
        userId: body.userId,
        role: user.role,
        knowledgePointId: body.knowledgePointId,
        planTaskId: body.planTaskId,
        state: body.state,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    // 2. 拼 system prompt（角色风格 + 当前知识点 + 记忆 + 薄弱点摘要）
    const kp =
      body.knowledgePointId ??
      session.knowledgePointId ??
      engine.for(user.role).graph.all()[0]?.id ??
      null
    const kpObj = kp ? engine.repo.getKnowledgePoint(kp) : null
    const memory = engine.repo.listMemory(body.userId, 8).map((m) => ({
      ...m,
    }))
    const latest = engine.repo.getLatestWeaknessReport(body.userId)
    const sysPrompt = engine.for(user.role).prompts.buildChatSystemPrompt({
      role: user.role,
      ...(kpObj ? { knowledgePoint: kpObj } : {}),
      recentMemory: memory,
      ...(latest ? { weaknessSummary: latest.report.summary } : {}),
      sessionState: session.state,
    })

    // 3. 追加用户消息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: body.message,
      knowledgePointRefs: kp ? [kp] : [],
      at: new Date().toISOString(),
    }
    session.messages.push(userMsg)

    // 4. 调 AI
    const t0 = Date.now()
    const resp = await engine.ai(body.userId).chat({
      systemPrompt: sysPrompt,
      messages: session.messages.slice(-20),
    })
    const elapsed = Date.now() - t0

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: resp.content,
      knowledgePointRefs: kp ? [kp] : [],
      at: new Date().toISOString(),
    }
    session.messages.push(assistantMsg)
    session.updatedAt = new Date().toISOString()
    session.state = body.state
    engine.repo.saveSession(session)

    // 5. 提炼记忆：每 5 轮提炼一次里程碑
    if (session.messages.length % 10 === 0) {
      engine.repo.addMemory({
        id: crypto.randomUUID(),
        userId: body.userId,
        kind: 'fact',
        content: `最近对话主题：${kpObj?.title ?? '自由提问'} (${elapsed}ms)`,
        knowledgePointIds: kp ? [kp] : [],
        createdAt: new Date().toISOString(),
        weight: 1,
      })
    }

    return { sessionId: session.id, message: assistantMsg, session: { ...session, messages: session.messages.slice(-20) } }
  })

  app.get('/chat/sessions/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    return engine.repo.listSessions(userId)
  })
}

// ---- knowledge connection ----
export const linkerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/links/:userId/:kpId', async (req, reply) => {
    const { userId, kpId } = req.params as { userId: string; kpId: string }
    const user = engine.repo.getUser(userId)
    if (!user) return reply.code(404).send({ error: 'user_not_found' })
    const states = engine.repo.listMastery(userId)
    const linker = engine.linker(user.role)
    return { connections: linker.bridge({ known: states, focusId: kpId }) }
  })
}

// ---- memory ----
export const memoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/memory/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    return engine.repo.listMemory(userId)
  })
}

// ---- dashboard ----
export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard/:userId', async (req) => {
    const { userId } = req.params as { userId: string }
    const user = engine.repo.getUser(userId)
    if (!user) return null
    const plans = engine.repo.listPlansForUser(userId)
    const plan = plans[0]
    const today = plan?.days[plan.currentDayIndex] ?? null
    const states = engine.repo.listMastery(userId)
    const avg = states.length === 0 ? 0 : states.reduce((a: number, b) => a + b.mastery, 0) / states.length
    const weak = states.filter((s) => s.mastery < 0.7).length
    return {
      user: { id: user.id, displayName: user.displayName, role: user.role },
      todayPlan: today,
      streakDays: 0,
      totalMinutes: states.reduce((a: number, b) => a + b.reviewCount * 5, 0),
      masteryAverage: avg,
      weakPointsCount: weak,
      upcomingReviews: states.filter((s: { lastReviewedAt: string; stability: number }) => {
        if (!s.lastReviewedAt) return false
        const dueIn = new Date(s.lastReviewedAt).getTime() + s.stability * 0.8 * 86400000
        return dueIn - Date.now() < 2 * 86400000
      }).length,
    }
  })
}
