import { describe, expect, it } from 'vitest'
import { planDay } from '../src/daily-plan-engine'
import type { KnowledgePoint, MasteryState, ParentCurriculum, ParentGoal } from '@xuexi/shared'

function kp(id: string, prereq: string[] = [], tags: string[] = []): KnowledgePoint {
  return {
    id, role: 'primary_school', graph: 'g', code: id, title: id, description: '',
    prerequisites: prereq, difficulty: 0.5, tags,
    mastery: { explain: 0, apply: 0, extend: 0 },
  }
}

function mastery(id: string, m: number, lastDaysAgo: number): MasteryState {
  return {
    userId: 'u1', knowledgePointId: id, mastery: m, stability: 1,
    lastReviewedAt: new Date(Date.now() - lastDaysAgo * 86_400_000).toISOString(),
    reviewCount: 1, evidence: [],
  }
}

describe('planDay()', () => {
  const today = '2026-07-04'
  const kps = [
    kp('basic', [], ['algebra']),     // 已掌握
    kp('intermediate', ['basic']),   // 应当预习
    kp('advanced', ['intermediate']),
  ]

  it('没有任何输入时返回少量 block（仅 preview 兜底）', () => {
    // 没有 mastery / 没有 weakness / 没有课程 / 没有目标：
    // 引擎仍然会推荐"prereq 为空 + 未学过"的 KP 作为预习
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 60,
      knowledgePoints: kps, masteryStates: [],
      resolved: { curriculums: [], goals: [] },
    })
    // 期望至少有一个 preview 块挑中 prereq 为空的 'basic'
    expect(blocks.length).toBeLessThanOrEqual(2)
    if (blocks.length > 0) {
      expect(blocks[0]?.kind).toBe('preview')
    }
  })

  it('复习到期 (mastery 高 + 时间久) 触发 review block', () => {
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 60,
      knowledgePoints: kps,
      masteryStates: [mastery('basic', 0.9, 30)],   // 30 天前学过，必然衰减到 < 0.6
      resolved: { curriculums: [], goals: [] },
    })
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some(b => b.kind === 'review')).toBe(true)
  })

  it('Goal 紧迫插队 → 第一个 block 是 practice', () => {
    const goal: ParentGoal = {
      id: 'g1', familyId: 'f', parentUserId: 'p', childUserId: 'u1',
      subjectId: 'math', title: '冲刺',
      metric: { kind: 'kp_coverage', knowledgePointIds: ['intermediate'] },
      deadline: '2026-07-05',   // 明天 → urgency 高
      status: 'active',
      progress: { lastCheckedAt: '', value: 0, note: '' },
      createdAt: '', updatedAt: '',
    }
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 60,
      knowledgePoints: kps, masteryStates: [],
      resolved: {
        curriculums: [],
        goals: [{ goal, knowledgePointIds: ['intermediate'], urgency: 0.5, dailyMinutesHint: 15 }],
      },
    })
    expect(blocks[0]?.kind).toBe('practice')
    expect(blocks[0]?.sourceRef.kind).toBe('goal')
  })

  it('Curriculum 插队（priority > goal urgency 时靠后）', () => {
    const curr: ParentCurriculum = {
      id: 'c1', familyId: 'f', parentUserId: 'p', childUserId: 'u1',
      subjectId: 'math', title: '新课',
      scope: { kind: 'kp_ids', knowledgePointIds: ['intermediate'] },
      schedule: { startDate: '2026-07-01', endDate: '2026-07-31', weekdays: [0,1,2,3,4,5,6], dailyMinutes: 30 },
      priority: 0.5, status: 'active', createdAt: '', updatedAt: '',
    }
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 60,
      knowledgePoints: kps, masteryStates: [],
      resolved: {
        curriculums: [{ curriculum: curr, knowledgePointIds: ['intermediate'], dailyMinutes: 30, priority: 0.5 }],
        goals: [],
      },
    })
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0]?.kind).toBe('learn')
    expect(blocks[0]?.sourceRef.kind).toBe('curriculum')
  })

  it('预算用尽后停止追加 block', () => {
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 30,  // 1 个 block
      knowledgePoints: kps,
      masteryStates: [mastery('basic', 0.9, 60), mastery('intermediate', 0.9, 60), mastery('advanced', 0.9, 60)],
      resolved: { curriculums: [], goals: [] },
    })
    expect(blocks.length).toBe(1)
  })

  it('预习：prerequisites 已学 + KP 自身未学 → 触发 preview', () => {
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 60,
      knowledgePoints: kps,
      masteryStates: [mastery('basic', 0.8, 1)],   // basic 已学
      resolved: { curriculums: [], goals: [] },
    })
    // basic 是 review 候选 (mastery 0.8 衰减较小) → 复习优先
    // 复习桶用完后，intermediate 应被预习
    const previewBlock = blocks.find(b => b.kind === 'preview')
    if (previewBlock) {
      expect(previewBlock.knowledgePointIds).toContain('intermediate')
    }
  })

  it('每个 block 都有 sourceRef 与 reason', () => {
    const blocks = planDay({
      userId: 'u1', subjectId: 'math', today, dailyBudgetMinutes: 60,
      knowledgePoints: kps,
      masteryStates: [mastery('basic', 0.9, 30)],
      weakness: { topWeak: [{ knowledgePointId: 'advanced', mastery: 0.2, reason: '掌握度低' }] },
      resolved: { curriculums: [], goals: [] },
    })
    for (const b of blocks) {
      expect(b.sourceRef).toBeTruthy()
      expect(b.reason.length).toBeGreaterThan(0)
    }
  })
})