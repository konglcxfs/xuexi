import { db } from '../db'
import type {
  ChatMessage,
  ChatSession,
  KnowledgePoint,
  LearningPlan,
  MasteryEvidence,
  MasteryState,
  MemoryEntry,
  RoleType,
  WeaknessReport,
} from '@xuexi/shared'

/**
 * 一组轻量的数据访问方法。
 * 用 prepared statements + JSON 列，外面的代码不用关心 SQLite 细节。
 */
export const repo = {
  // ---- users ----
  createUser(u: { id: string; displayName: string; role: RoleType; meta?: object }): void {
    db.prepare(
      'INSERT INTO users (id, display_name, role, meta_json, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(u.id, u.displayName, u.role, JSON.stringify(u.meta ?? {}), new Date().toISOString())
  },
  getUser(id: string) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | { id: string; display_name: string; role: RoleType; meta_json: string; created_at: string }
      | undefined
    if (!row) return null
    return {
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      meta: JSON.parse(row.meta_json),
      createdAt: row.created_at,
    }
  },

  // ---- knowledge points ----
  listKnowledgePoints(role: RoleType): KnowledgePoint[] {
    const rows = db
      .prepare('SELECT * FROM knowledge_points WHERE role = ? ORDER BY code')
      .all(role) as any[]
    return rows.map(rowToKnowledgePoint)
  },
  getKnowledgePoint(id: string): KnowledgePoint | null {
    const row = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(id) as any
    return row ? rowToKnowledgePoint(row) : null
  },

  // ---- mastery ----
  getMastery(userId: string, kpId: string): MasteryState | null {
    const row = db
      .prepare('SELECT * FROM mastery_states WHERE user_id = ? AND knowledge_point_id = ?')
      .get(userId, kpId) as any
    if (!row) return null
    return rowToMastery(row)
  },
  listMastery(userId: string): MasteryState[] {
    const rows = db.prepare('SELECT * FROM mastery_states WHERE user_id = ?').all(userId) as any[]
    return rows.map(rowToMastery)
  },
  upsertMastery(state: MasteryState): void {
    db.prepare(
      `INSERT INTO mastery_states
        (user_id, knowledge_point_id, mastery, stability, last_reviewed_at, review_count, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, knowledge_point_id) DO UPDATE SET
        mastery=excluded.mastery,
        stability=excluded.stability,
        last_reviewed_at=excluded.last_reviewed_at,
        review_count=excluded.review_count,
        evidence_json=excluded.evidence_json`
    ).run(
      state.userId,
      state.knowledgePointId,
      state.mastery,
      state.stability,
      state.lastReviewedAt,
      state.reviewCount,
      JSON.stringify(state.evidence)
    )
  },

  // ---- plans ----
  savePlan(plan: LearningPlan): void {
    db.prepare(
      `INSERT INTO learning_plans (id, user_id, role, title, goal, created_at, current_day_index, days_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        goal=excluded.goal,
        current_day_index=excluded.current_day_index,
        days_json=excluded.days_json`
    ).run(
      plan.id,
      plan.userId,
      plan.role,
      plan.title,
      plan.goal,
      plan.createdAt,
      plan.currentDayIndex,
      JSON.stringify(plan.days)
    )
  },
  getPlan(id: string): LearningPlan | null {
    const row = db.prepare('SELECT * FROM learning_plans WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      title: row.title,
      goal: row.goal,
      createdAt: row.created_at,
      currentDayIndex: row.current_day_index,
      days: JSON.parse(row.days_json),
    }
  },
  listPlansForUser(userId: string): LearningPlan[] {
    const rows = db
      .prepare('SELECT * FROM learning_plans WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as any[]
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      title: row.title,
      goal: row.goal,
      createdAt: row.created_at,
      currentDayIndex: row.current_day_index,
      days: JSON.parse(row.days_json),
    }))
  },

  // ---- memory ----
  addMemory(m: MemoryEntry): void {
    db.prepare(
      `INSERT INTO memory_entries (id, user_id, kind, content, knowledge_point_ids_json, created_at, weight)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.id,
      m.userId,
      m.kind,
      m.content,
      JSON.stringify(m.knowledgePointIds),
      m.createdAt,
      m.weight
    )
  },
  listMemory(userId: string, limit = 30): MemoryEntry[] {
    const rows = db
      .prepare('SELECT * FROM memory_entries WHERE user_id = ? ORDER BY weight DESC LIMIT ?')
      .all(userId, limit) as any[]
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      kind: row.kind,
      content: row.content,
      knowledgePointIds: JSON.parse(row.knowledge_point_ids_json),
      createdAt: row.created_at,
      weight: row.weight,
    }))
  },

  // ---- chat sessions ----
  saveSession(s: ChatSession): void {
    db.prepare(
      `INSERT INTO chat_sessions
        (id, user_id, role, knowledge_point_id, plan_task_id, state, created_at, updated_at, messages_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        knowledge_point_id=excluded.knowledge_point_id,
        plan_task_id=excluded.plan_task_id,
        state=excluded.state,
        updated_at=excluded.updated_at,
        messages_json=excluded.messages_json`
    ).run(
      s.id,
      s.userId,
      s.role,
      s.knowledgePointId ?? null,
      s.planTaskId ?? null,
      s.state,
      s.createdAt,
      s.updatedAt,
      JSON.stringify(s.messages)
    )
  },
  getSession(id: string): ChatSession | null {
    const row = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      knowledgePointId: row.knowledge_point_id,
      planTaskId: row.plan_task_id,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: JSON.parse(row.messages_json),
    }
  },
  listSessions(userId: string, limit = 20): ChatSession[] {
    const rows = db
      .prepare('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?')
      .all(userId, limit) as any[]
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      knowledgePointId: row.knowledge_point_id,
      planTaskId: row.plan_task_id,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: JSON.parse(row.messages_json),
    }))
  },

  // ---- weakness reports ----
  saveWeaknessReport(report: WeaknessReport, id: string): void {
    db.prepare(
      `INSERT INTO weakness_reports (id, user_id, role, generated_at, report_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET report_json=excluded.report_json, generated_at=excluded.generated_at`
    ).run(id, report.userId, report.role, report.generatedAt, JSON.stringify(report))
  },
  getLatestWeaknessReport(userId: string): { id: string; report: WeaknessReport } | null {
    const row = db
      .prepare('SELECT * FROM weakness_reports WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1')
      .get(userId) as any
    if (!row) return null
    return { id: row.id, report: JSON.parse(row.report_json) }
  },
}

function rowToKnowledgePoint(row: any): KnowledgePoint {
  return {
    id: row.id,
    role: row.role,
    graph: row.graph,
    code: row.code,
    title: row.title,
    description: row.description,
    prerequisites: JSON.parse(row.prerequisites_json),
    difficulty: row.difficulty,
    tags: JSON.parse(row.tags_json),
    mastery: JSON.parse(row.mastery_json),
  }
}

function rowToMastery(row: any): MasteryState {
  return {
    userId: row.user_id,
    knowledgePointId: row.knowledge_point_id,
    mastery: row.mastery,
    stability: row.stability,
    lastReviewedAt: row.last_reviewed_at,
    reviewCount: row.review_count,
    evidence: JSON.parse(row.evidence_json),
  }
}

export type { ChatMessage as _ChatMessage, MasteryEvidence as _MasteryEvidence }

// ============================================================================
// 桌面端 / 多平台相关表（与原 role-based 表并存，向后兼容）
// ============================================================================

import type {
  AIProviderConfig,
  AIVendor,
  SubjectEnrollment,
  SourceLibraryEntry,
} from '@xuexi/shared'

// ---- AI provider configs ----

function rowToProviderConfig(row: any): AIProviderConfig {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    vendor: row.vendor as AIVendor,
    baseUrl: row.base_url,
    model: row.model,
    encryptedApiKey: row.encrypted_api_key,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const providerRepo = {
  list(userId: string): AIProviderConfig[] {
    const rows = db
      .prepare('SELECT * FROM ai_provider_configs WHERE user_id = ? ORDER BY created_at')
      .all(userId) as any[]
    return rows.map(rowToProviderConfig)
  },
  upsert(c: AIProviderConfig): void {
    db.prepare(
      `INSERT INTO ai_provider_configs
        (id, user_id, display_name, vendor, base_url, model, encrypted_api_key, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        display_name=excluded.display_name,
        vendor=excluded.vendor,
        base_url=excluded.base_url,
        model=excluded.model,
        encrypted_api_key=excluded.encrypted_api_key,
        is_active=excluded.is_active,
        updated_at=excluded.updated_at`
    ).run(
      c.id,
      c.userId,
      c.displayName,
      c.vendor,
      c.baseUrl,
      c.model,
      c.encryptedApiKey,
      c.isActive ? 1 : 0,
      c.createdAt,
      c.updatedAt
    )
  },
  /** 把指定用户的全部 provider 置 0，再把 activatedId 置 1 */
  setActive(userId: string, activatedId: string): void {
    // node:sqlite 的 DatabaseSync 没有 transaction()，按顺序执行（与单线程访问一致）
    db.prepare('UPDATE ai_provider_configs SET is_active = 0 WHERE user_id = ?').run(userId)
    db.prepare('UPDATE ai_provider_configs SET is_active = 1 WHERE id = ? AND user_id = ?').run(activatedId, userId)
  },
  get(id: string): AIProviderConfig | null {
    const row = db
      .prepare('SELECT * FROM ai_provider_configs WHERE id = ?').get(id) as any
    return row ? rowToProviderConfig(row) : null
  },
  remove(id: string): void {
    db.prepare('DELETE FROM ai_provider_configs WHERE id = ?').run(id)
  },
}

// ---- subject enrollments ----

export const enrollmentRepo = {
  list(userId: string): SubjectEnrollment[] {
    const rows = db
      .prepare('SELECT * FROM subject_enrollments WHERE user_id = ? ORDER BY enrolled_at')
      .all(userId) as any[]
    return rows.map(r => ({
      userId: r.user_id,
      subjectId: r.subject_id,
      enrolledAt: r.enrolled_at,
    }))
  },
  enroll(userId: string, subjectId: string): void {
    db.prepare(
      `INSERT INTO subject_enrollments (user_id, subject_id, enrolled_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, subject_id) DO NOTHING`
    ).run(userId, subjectId, new Date().toISOString())
  },
  unenroll(userId: string, subjectId: string): void {
    db.prepare('DELETE FROM subject_enrollments WHERE user_id = ? AND subject_id = ?')
      .run(userId, subjectId)
  },
}

// ---- user knowledge graph snapshots ----

export const userGraphRepo = {
  save(rec: {
    userId: string
    subjectId: string
    graphId: string
    graph: unknown
  }): void {
    db.prepare(
      `INSERT INTO user_knowledge_graphs
        (user_id, subject_id, graph_id, graph_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, subject_id) DO UPDATE SET
        graph_id=excluded.graph_id,
        graph_json=excluded.graph_json,
        updated_at=excluded.updated_at`
    ).run(
      rec.userId,
      rec.subjectId,
      rec.graphId,
      JSON.stringify(rec.graph),
      new Date().toISOString()
    )
  },
  load(userId: string, subjectId: string): { graphId: string; graph: unknown; updatedAt: string } | null {
    const row = db.prepare(
      'SELECT * FROM user_knowledge_graphs WHERE user_id = ? AND subject_id = ?'
    ).get(userId, subjectId) as any
    if (!row) return null
    return {
      graphId: row.graph_id,
      graph: JSON.parse(row.graph_json),
      updatedAt: row.updated_at,
    }
  },
}

// ---- source library ----

function rowToSourceEntry(row: any): SourceLibraryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    displayName: row.display_name,
    adapterId: row.adapter_id,
    locator: row.locator,
    files: JSON.parse(row.files_json),
    extracted: JSON.parse(row.extracted_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const sourceLibraryRepo = {
  list(userId: string): SourceLibraryEntry[] {
    const rows = db
      .prepare('SELECT * FROM source_library WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as any[]
    return rows.map(rowToSourceEntry)
  },
  upsert(e: SourceLibraryEntry): void {
    db.prepare(
      `INSERT INTO source_library
        (id, user_id, kind, display_name, adapter_id, locator, files_json, extracted_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        kind=excluded.kind,
        display_name=excluded.display_name,
        adapter_id=excluded.adapter_id,
        locator=excluded.locator,
        files_json=excluded.files_json,
        extracted_json=excluded.extracted_json,
        updated_at=excluded.updated_at`
    ).run(
      e.id,
      e.userId,
      e.kind,
      e.displayName,
      e.adapterId,
      e.locator,
      JSON.stringify(e.files),
      JSON.stringify(e.extracted),
      e.createdAt,
      e.updatedAt
    )
  },
  get(id: string): SourceLibraryEntry | null {
    const row = db.prepare('SELECT * FROM source_library WHERE id = ?').get(id) as any
    return row ? rowToSourceEntry(row) : null
  },
  remove(id: string): void {
    db.prepare('DELETE FROM source_library WHERE id = ?').run(id)
  },
}

// ----------------------------------------------------------------------------
// Family / FamilyMember
// ----------------------------------------------------------------------------

export const familyRepo = {
  create(f: { id: string; displayName: string; createdBy: string; createdAt: string }) {
    db.prepare(
      `INSERT INTO families (id, display_name, created_by, created_at) VALUES (?, ?, ?, ?)`
    ).run(f.id, f.displayName, f.createdBy, f.createdAt)
  },
  get(id: string): { id: string; displayName: string; createdBy: string; createdAt: string } | null {
    const row = db.prepare('SELECT * FROM families WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      displayName: row.display_name,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }
  },
  listByUser(userId: string) {
    const rows = db.prepare(
      `SELECT f.* FROM families f
       JOIN family_members m ON m.family_id = f.id
       WHERE m.user_id = ? ORDER BY f.created_at DESC`
    ).all(userId) as any[]
    return rows.map(r => ({
      id: r.id,
      displayName: r.display_name,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }))
  },
  remove(id: string) {
    db.prepare('DELETE FROM families WHERE id = ?').run(id)
  },
}

export const familyMemberRepo = {
  add(m: { familyId: string; userId: string; role: 'parent' | 'child'; alias?: string; joinedAt: string }) {
    db.prepare(
      `INSERT INTO family_members (family_id, user_id, role, alias, joined_at) VALUES (?, ?, ?, ?, ?)`
    ).run(m.familyId, m.userId, m.role, m.alias ?? null, m.joinedAt)
  },
  remove(familyId: string, userId: string) {
    db.prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?').run(familyId, userId)
  },
  listByFamily(familyId: string) {
    const rows = db.prepare(
      'SELECT * FROM family_members WHERE family_id = ? ORDER BY joined_at'
    ).all(familyId) as any[]
    return rows.map(r => ({
      familyId: r.family_id,
      userId: r.user_id,
      role: r.role,
      alias: r.alias ?? undefined,
      joinedAt: r.joined_at,
    }))
  },
  listByUser(userId: string) {
    const rows = db.prepare(
      'SELECT * FROM family_members WHERE user_id = ?'
    ).all(userId) as any[]
    return rows.map(r => ({
      familyId: r.family_id,
      userId: r.user_id,
      role: r.role,
      alias: r.alias ?? undefined,
      joinedAt: r.joined_at,
    }))
  },
  isMember(familyId: string, userId: string): boolean {
    const row = db.prepare(
      'SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ?'
    ).get(familyId, userId)
    return !!row
  },
  isParentOf(parentId: string, childId: string): boolean {
    const row = db.prepare(
      `SELECT 1 FROM family_members WHERE user_id = ? AND role = 'parent'`
    ).get(parentId) as { 1?: number } | undefined
    if (!row) return false
    const childRow = db.prepare(
      `SELECT 1 FROM family_members fm
       WHERE fm.user_id = ? AND fm.role = 'child' AND fm.family_id IN (
         SELECT family_id FROM family_members WHERE user_id = ?
       )`
    ).get(childId, parentId)
    return !!childRow
  },
}

// ----------------------------------------------------------------------------
// ParentCurriculum / ParentGoal
// ----------------------------------------------------------------------------

interface CurriculumRow {
  id: string
  family_id: string
  parent_user_id: string
  child_user_id: string
  subject_id: string
  title: string
  scope_json: string
  schedule_json: string
  priority: number
  status: 'active' | 'paused' | 'completed' | 'archived'
  created_at: string
  updated_at: string
}

function rowToCurriculum(r: CurriculumRow): import('@xuexi/shared').ParentCurriculum {
  return {
    id: r.id,
    familyId: r.family_id,
    parentUserId: r.parent_user_id,
    childUserId: r.child_user_id,
    subjectId: r.subject_id,
    title: r.title,
    scope: JSON.parse(r.scope_json),
    schedule: JSON.parse(r.schedule_json),
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export const curriculumRepo = {
  upsert(c: import('@xuexi/shared').ParentCurriculum) {
    db.prepare(
      `INSERT INTO parent_curriculums
        (id, family_id, parent_user_id, child_user_id, subject_id, title,
         scope_json, schedule_json, priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title,
         scope_json=excluded.scope_json,
         schedule_json=excluded.schedule_json,
         priority=excluded.priority,
         status=excluded.status,
         updated_at=excluded.updated_at`
    ).run(
      c.id, c.familyId, c.parentUserId, c.childUserId, c.subjectId, c.title,
      JSON.stringify(c.scope), JSON.stringify(c.schedule), c.priority, c.status,
      c.createdAt, c.updatedAt
    )
  },
  get(id: string): import('@xuexi/shared').ParentCurriculum | null {
    const row = db.prepare('SELECT * FROM parent_curriculums WHERE id = ?').get(id) as CurriculumRow | undefined
    return row ? rowToCurriculum(row) : null
  },
  listByChild(childUserId: string): import('@xuexi/shared').ParentCurriculum[] {
    const rows = db.prepare(
      'SELECT * FROM parent_curriculums WHERE child_user_id = ? ORDER BY priority DESC, created_at DESC'
    ).all(childUserId) as CurriculumRow[]
    return rows.map(rowToCurriculum)
  },
  listActiveByChild(childUserId: string, today: string): import('@xuexi/shared').ParentCurriculum[] {
    const rows = db.prepare(
      `SELECT * FROM parent_curriculums
       WHERE child_user_id = ?
         AND status = 'active'
         AND json_extract(schedule_json, '$.startDate') <= ?
         AND json_extract(schedule_json, '$.endDate') >= ?
       ORDER BY priority DESC, created_at DESC`
    ).all(childUserId, today, today) as CurriculumRow[]
    return rows.map(rowToCurriculum)
  },
  remove(id: string) {
    db.prepare('DELETE FROM parent_curriculums WHERE id = ?').run(id)
  },
}

interface GoalRow {
  id: string
  family_id: string
  parent_user_id: string
  child_user_id: string
  subject_id: string
  title: string
  description: string | null
  metric_json: string
  deadline: string
  status: 'active' | 'achieved' | 'expired' | 'abandoned'
  progress_json: string
  created_at: string
  updated_at: string
}

function rowToGoal(r: GoalRow): import('@xuexi/shared').ParentGoal {
  return {
    id: r.id,
    familyId: r.family_id,
    parentUserId: r.parent_user_id,
    childUserId: r.child_user_id,
    subjectId: r.subject_id,
    title: r.title,
    description: r.description ?? undefined,
    metric: JSON.parse(r.metric_json),
    deadline: r.deadline,
    status: r.status,
    progress: JSON.parse(r.progress_json),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export const goalRepo = {
  upsert(g: import('@xuexi/shared').ParentGoal) {
    db.prepare(
      `INSERT INTO parent_goals
        (id, family_id, parent_user_id, child_user_id, subject_id, title,
         description, metric_json, deadline, status, progress_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title,
         description=excluded.description,
         metric_json=excluded.metric_json,
         deadline=excluded.deadline,
         status=excluded.status,
         progress_json=excluded.progress_json,
         updated_at=excluded.updated_at`
    ).run(
      g.id, g.familyId, g.parentUserId, g.childUserId, g.subjectId, g.title,
      g.description ?? null, JSON.stringify(g.metric), g.deadline, g.status,
      JSON.stringify(g.progress), g.createdAt, g.updatedAt
    )
  },
  get(id: string): import('@xuexi/shared').ParentGoal | null {
    const row = db.prepare('SELECT * FROM parent_goals WHERE id = ?').get(id) as GoalRow | undefined
    return row ? rowToGoal(row) : null
  },
  listByChild(childUserId: string): import('@xuexi/shared').ParentGoal[] {
    const rows = db.prepare(
      'SELECT * FROM parent_goals WHERE child_user_id = ? ORDER BY deadline ASC'
    ).all(childUserId) as GoalRow[]
    return rows.map(rowToGoal)
  },
  listActiveByChild(childUserId: string, today: string): import('@xuexi/shared').ParentGoal[] {
    const rows = db.prepare(
      `SELECT * FROM parent_goals
       WHERE child_user_id = ?
         AND status = 'active'
         AND deadline >= ?
       ORDER BY deadline ASC`
    ).all(childUserId, today) as GoalRow[]
    return rows.map(rowToGoal)
  },
  remove(id: string) {
    db.prepare('DELETE FROM parent_goals WHERE id = ?').run(id)
  },
}

// ----------------------------------------------------------------------------
// DailyPlanBlock
// ----------------------------------------------------------------------------

interface DailyBlockRow {
  id: string
  date: string
  user_id: string
  subject_id: string
  kind: 'preview' | 'review' | 'learn' | 'practice'
  title: string
  knowledge_point_ids_json: string
  estimated_minutes: number
  reason: string
  source_ref_json: string
  done: number
  done_at: string | null
  resource_refs_json: string
  created_at: string
}

function rowToBlock(r: DailyBlockRow): import('@xuexi/shared').DailyPlanBlock {
  return {
    id: r.id,
    date: r.date,
    userId: r.user_id,
    subjectId: r.subject_id,
    kind: r.kind,
    title: r.title,
    knowledgePointIds: JSON.parse(r.knowledge_point_ids_json),
    estimatedMinutes: r.estimated_minutes,
    reason: r.reason,
    sourceRef: JSON.parse(r.source_ref_json),
    done: !!r.done,
    doneAt: r.done_at ?? undefined,
    resourceRefs: JSON.parse(r.resource_refs_json),
    createdAt: r.created_at,
  }
}

export const dailyBlockRepo = {
  upsert(b: import('@xuexi/shared').DailyPlanBlock) {
    db.prepare(
      `INSERT INTO daily_plan_blocks
        (id, date, user_id, subject_id, kind, title,
         knowledge_point_ids_json, estimated_minutes, reason, source_ref_json,
         done, done_at, resource_refs_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title,
         knowledge_point_ids_json=excluded.knowledge_point_ids_json,
         estimated_minutes=excluded.estimated_minutes,
         reason=excluded.reason,
         source_ref_json=excluded.source_ref_json,
         done=excluded.done,
         done_at=excluded.done_at,
         resource_refs_json=excluded.resource_refs_json`
    ).run(
      b.id, b.date, b.userId, b.subjectId, b.kind, b.title,
      JSON.stringify(b.knowledgePointIds), b.estimatedMinutes, b.reason,
      JSON.stringify(b.sourceRef),
      b.done ? 1 : 0, b.doneAt ?? null,
      JSON.stringify(b.resourceRefs), b.createdAt
    )
  },
  listByUserAndDate(userId: string, date: string): import('@xuexi/shared').DailyPlanBlock[] {
    const rows = db.prepare(
      'SELECT * FROM daily_plan_blocks WHERE user_id = ? AND date = ? ORDER BY created_at'
    ).all(userId, date) as DailyBlockRow[]
    return rows.map(rowToBlock)
  },
  /** 用于引擎"按天 upsert 一次"：先删后插，保证幂等 */
  replaceForDate(userId: string, date: string, blocks: import('@xuexi/shared').DailyPlanBlock[]) {
    db.prepare('DELETE FROM daily_plan_blocks WHERE user_id = ? AND date = ? AND done = 0').run(userId, date)
    const stmt = db.prepare(
      `INSERT INTO daily_plan_blocks
        (id, date, user_id, subject_id, kind, title,
         knowledge_point_ids_json, estimated_minutes, reason, source_ref_json,
         done, done_at, resource_refs_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const b of blocks) {
      stmt.run(
        b.id, b.date, b.userId, b.subjectId, b.kind, b.title,
        JSON.stringify(b.knowledgePointIds), b.estimatedMinutes, b.reason,
        JSON.stringify(b.sourceRef),
        b.done ? 1 : 0, b.doneAt ?? null,
        JSON.stringify(b.resourceRefs), b.createdAt
      )
    }
  },
  get(id: string): import('@xuexi/shared').DailyPlanBlock | null {
    const row = db.prepare('SELECT * FROM daily_plan_blocks WHERE id = ?').get(id) as DailyBlockRow | undefined
    return row ? rowToBlock(row) : null
  },
  markDone(id: string, doneAt: string) {
    db.prepare('UPDATE daily_plan_blocks SET done = 1, done_at = ? WHERE id = ?').run(doneAt, id)
  },
}

// ----------------------------------------------------------------------------
// PlacementSession
// ----------------------------------------------------------------------------

interface PlacementRow {
  id: string
  user_id: string
  subject_id: string
  started_at: string
  ended_at: string | null
  theta: number
  se: number
  responses_json: string
  profile_json: string
}

function rowToPlacement(r: PlacementRow): import('@xuexi/shared').PlacementSession {
  return {
    id: r.id,
    userId: r.user_id,
    subjectId: r.subject_id,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? undefined,
    theta: r.theta,
    se: r.se,
    responses: JSON.parse(r.responses_json),
    profile: JSON.parse(r.profile_json),
  }
}

export const placementRepo = {
  create(s: import('@xuexi/shared').PlacementSession) {
    db.prepare(
      `INSERT INTO placement_sessions
        (id, user_id, subject_id, started_at, ended_at, theta, se, responses_json, profile_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      s.id, s.userId, s.subjectId, s.startedAt, s.endedAt ?? null,
      s.theta, s.se, JSON.stringify(s.responses), JSON.stringify(s.profile)
    )
  },
  update(s: import('@xuexi/shared').PlacementSession) {
    db.prepare(
      `UPDATE placement_sessions SET
        ended_at = ?, theta = ?, se = ?, responses_json = ?, profile_json = ?
        WHERE id = ?`
    ).run(
      s.endedAt ?? null, s.theta, s.se,
      JSON.stringify(s.responses), JSON.stringify(s.profile), s.id
    )
  },
  get(id: string): import('@xuexi/shared').PlacementSession | null {
    const row = db.prepare('SELECT * FROM placement_sessions WHERE id = ?').get(id) as PlacementRow | undefined
    return row ? rowToPlacement(row) : null
  },
  latestByUserSubject(userId: string, subjectId: string): import('@xuexi/shared').PlacementSession | null {
    const row = db.prepare(
      `SELECT * FROM placement_sessions
       WHERE user_id = ? AND subject_id = ? AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT 1`
    ).get(userId, subjectId) as PlacementRow | undefined
    return row ? rowToPlacement(row) : null
  },
}

// ----------------------------------------------------------------------------
// 便利别名（让路由可以用 masteryRepo.xxx 而不是 repo.xxx）
// ----------------------------------------------------------------------------

export const masteryRepo = {
  get: (userId: string, kpId: string) => repo.getMastery(userId, kpId),
  listByUser: (userId: string) => repo.listMastery(userId),
  upsert: (s: MasteryState) => repo.upsertMastery(s),
}
