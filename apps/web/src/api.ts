import type {
  ChatMessage,
  ChatSession,
  DashboardSummary,
  KnowledgePoint,
  KnowledgeConnection,
  LearningPlan,
  RoleType,
  WeaknessReport,
  AIVendor,
  Exercise,
} from '@xuexi/shared'

const BASE = ''

async function http<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

export const api = {
  // ---- user ----
  createUser: (displayName: string, role: RoleType, meta?: object) =>
    http<{ id: string }>('POST', '/api/users', { displayName, role, meta }),
  getUser: (id: string) => http<{ id: string; displayName: string; role: RoleType }>(
    'GET',
    `/api/users/${id}`
  ),

  // ---- knowledge ----
  getGraph: (role: RoleType) =>
    http<{ points: KnowledgePoint[] }>('GET', `/api/graph/${role}`),
  getLinks: (userId: string, kpId: string) =>
    http<{ connections: KnowledgeConnection[] }>(
      'GET',
      `/api/links/${userId}/${encodeURIComponent(kpId)}`
    ),

  // ---- mastery ----
  getMastery: (userId: string) => http('GET', `/api/mastery/${userId}`),
  addEvidence: (body: {
    userId: string
    knowledgePointId: string
    dimension: 'explain' | 'apply' | 'extend'
    correct: boolean
    score: number
    feedback?: string
  }) => http('POST', '/api/evidence', body),

  // ---- weakness ----
  getLatestWeakness: (userId: string) =>
    http<{ id: string; report: WeaknessReport } | null>(
      'GET',
      `/api/weakness/${userId}/latest`
    ),
  runWeakness: (userId: string) =>
    http<{ id: string; report: WeaknessReport }>(
      'POST',
      `/api/weakness/run/${userId}`
    ),

  // ---- plan ----
  createPlan: (body: {
    userId: string
    goal: string
    dailyMinutes?: number
    totalDays?: number
    startFromId?: string
  }) => http<LearningPlan>('POST', '/api/plans', body),
  listPlans: (userId: string) => http<LearningPlan[]>('GET', `/api/plans/${userId}`),

  // ---- chat ----
  chat: (body: {
    userId: string
    sessionId?: string
    knowledgePointId?: string
    planTaskId?: string
    state?: 'idle' | 'explaining' | 'practicing' | 'reviewing' | 'planning'
    message: string
  }) =>
    http<{
      sessionId: string
      message: ChatMessage
      session: ChatSession
    }>('POST', '/api/chat', body),
  listSessions: (userId: string) => http<ChatSession[]>('GET', `/api/chat/sessions/${userId}`),

  // ---- memory ----
  getMemory: (userId: string) => http('GET', `/api/memory/${userId}`),

  // ---- dashboard ----
  getDashboard: (userId: string) =>
    http<DashboardSummary | null>('GET', `/api/dashboard/${userId}`),

  // ---- subjects / methods / pedagogies / sources (8 大体系) ----
  listSubjects: () => http<{ subjects: Array<{ id: string; displayName: string; domain: string }> }>('GET', '/api/subjects'),
  listMethods: (q?: { target?: string; kind?: string }) =>
    http('GET', `/api/methods${q ? `?target=${q.target ?? ''}&kind=${q.kind ?? ''}` : ''}`),
  listPedagogies: () => http('GET', '/api/pedagogies'),
  listSources: () => http('GET', '/api/sources'),

  /** 题库类的 SourceAdapter 用这个拿 Exercise 列表（例：/api/sources/primary-math-g4-bank/exercises） */
  listExercises: (adapterId: string, opts?: { units?: string[]; subjectId?: string }) =>
    http<{ exercises: Exercise[] }>(
      'GET',
      `/api/sources/${encodeURIComponent(adapterId)}/exercises${
        opts
          ? `?units=${(opts.units ?? []).join(',')}&subjectId=${opts.subjectId ?? ''}`
          : ''
      }`
    ),

  // ---- AI providers (multi-vendor) ----
  listAiProviders: (userId: string) =>
    http<{
      providers: Array<{
        id: string
        userId: string
        displayName: string
        vendor: AIVendor
        baseUrl: string
        model: string
        apiKeyConfigured: boolean
        isActive: boolean
        createdAt: string
        updatedAt: string
      }>
    }>('GET', `/api/ai-providers/${userId}`),

  createAiProvider: (userId: string, body: {
    displayName: string
    vendor: AIVendor
    baseUrl: string
    model: string
    apiKey: string
    isActive?: boolean
  }) => http<{ id: string; ok: boolean }>('POST', `/api/ai-providers/${userId}`, body),

  setActiveAiProvider: (userId: string, id: string) =>
    http<{ ok: boolean }>('PATCH', `/api/ai-providers/${userId}/${id}/active`),

  deleteAiProvider: (userId: string, id: string) =>
    http<{ ok: boolean }>('DELETE', `/api/ai-providers/${userId}/${id}`),

  // ---- subject enrollments ----
  listEnrollments: (userId: string) =>
    http<{ enrollments: Array<{ userId: string; subjectId: string; enrolledAt: string }> }>('GET', `/api/enrollments/${userId}`),
  enroll: (userId: string, subjectId: string) =>
    http<{ ok: boolean }>('POST', `/api/enrollments/${userId}`, { subjectId }),
  unenroll: (userId: string, subjectId: string) =>
    http<{ ok: boolean }>('DELETE', `/api/enrollments/${userId}/${subjectId}`),
}
