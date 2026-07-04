import { describe, expect, it } from 'vitest'
import {
  expandScope,
  expandGoalMetric,
  computeUrgency,
  resolve,
} from '../src/curriculum-goal-resolver'
import type { KnowledgePoint, ParentCurriculum, ParentGoal } from '@xuexi/shared'

function kp(id: string, code: string, tags: string[] = [], prereq: string[] = []): KnowledgePoint {
  return {
    id, role: 'primary_school', graph: 'g', code, title: id, description: '',
    prerequisites: prereq, difficulty: 0.5, tags,
    mastery: { explain: 0, apply: 0, extend: 0 },
  }
}

describe('expandScope', () => {
  const kps = [
    kp('a', 'M1'),
    kp('b', 'M2', ['algebra']),
    kp('c', 'M3', ['geometry']),
    kp('d', 'unit-3-lesson-1', ['chapter:unit-3']),
    kp('e', 'unit-3-lesson-2', ['chapter:unit-3']),
  ]
  it('full_subject', () => {
    expect(expandScope({ kind: 'full_subject' }, kps)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('kp_ids', () => {
    expect(expandScope({ kind: 'kp_ids', knowledgePointIds: ['a', 'c', 'zzz'] }, kps)).toEqual(['a', 'c'])
  })
  it('kp_tags', () => {
    expect(expandScope({ kind: 'kp_tags', tags: ['algebra'] }, kps)).toEqual(['b'])
  })
  it('chapter via prefix', () => {
    expect(expandScope({ kind: 'chapter', chapter: 'unit-3' }, kps)).toEqual(['d', 'e'])
  })
})

describe('expandGoalMetric', () => {
  it('mastery_threshold', () => {
    expect(expandGoalMetric({ kind: 'mastery_threshold', knowledgePointIds: ['a','b'], threshold: 0.8 }))
      .toEqual(['a','b'])
  })
  it('kp_coverage', () => {
    expect(expandGoalMetric({ kind: 'kp_coverage', knowledgePointIds: ['x'] })).toEqual(['x'])
  })
  it('accuracy_threshold returns []', () => {
    expect(expandGoalMetric({ kind: 'accuracy_threshold', minAccuracy: 0.8, minExercises: 20 })).toEqual([])
  })
  it('manual returns []', () => {
    expect(expandGoalMetric({ kind: 'manual' })).toEqual([])
  })
})

describe('computeUrgency', () => {
  it('已过期 → 1.0', () => {
    const now = new Date('2026-01-01')
    expect(computeUrgency('2025-12-01', now)).toBe(1.0)
  })
  it('今日 deadline → 0.5', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(computeUrgency('2026-01-02', now)).toBeCloseTo(0.5, 2)
  })
  it('7 天后 → 0.125', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(computeUrgency('2026-01-08', now)).toBeCloseTo(0.125, 3)
  })
})

describe('resolve()', () => {
  const kps = [
    kp('a', 'M1'),
    kp('b', 'M2', ['algebra']),
    kp('c', 'M3', ['geometry']),
  ]
  const today = '2026-07-04'   // 周六
  const weekday = new Date(today + 'T00:00:00').getDay()

  it('课程在时间窗 + 匹配 weekday 时被采纳', () => {
    const c: ParentCurriculum = {
      id: 'c1', familyId: 'f1', parentUserId: 'p1', childUserId: 'k1',
      subjectId: 'math', title: '代数', scope: { kind: 'kp_tags', tags: ['algebra'] },
      schedule: { startDate: '2026-07-01', endDate: '2026-07-31', weekdays: [weekday], dailyMinutes: 30 },
      priority: 0.8, status: 'active', createdAt: '', updatedAt: '',
    }
    const out = resolve({
      userId: 'k1', knowledgePoints: kps, curriculums: [c], goals: [],
      today, now: new Date(today + 'T00:00:00'),
    })
    expect(out.curriculums).toHaveLength(1)
    expect(out.curriculums[0]!.knowledgePointIds).toEqual(['b'])
    expect(out.kpPool.has('b')).toBe(true)
  })

  it('课程 weekday 不匹配 → 跳过', () => {
    const c: ParentCurriculum = {
      id: 'c1', familyId: 'f1', parentUserId: 'p1', childUserId: 'k1',
      subjectId: 'math', title: 'X', scope: { kind: 'full_subject' },
      schedule: { startDate: '2026-07-01', endDate: '2026-07-31', weekdays: [(weekday + 1) % 7], dailyMinutes: 30 },
      priority: 0.8, status: 'active', createdAt: '', updatedAt: '',
    }
    const out = resolve({
      userId: 'k1', knowledgePoints: kps, curriculums: [c], goals: [],
      today,
    })
    expect(out.curriculums).toHaveLength(0)
  })

  it('目标生成 urgency + KP 池', () => {
    const g: ParentGoal = {
      id: 'g1', familyId: 'f1', parentUserId: 'p1', childUserId: 'k1',
      subjectId: 'math', title: '掌握代数',
      metric: { kind: 'kp_coverage', knowledgePointIds: ['b'] },
      deadline: '2026-07-05',   // 1 天后
      status: 'active',
      progress: { lastCheckedAt: '', value: 0, note: '' },
      createdAt: '', updatedAt: '',
    }
    const out = resolve({
      userId: 'k1', knowledgePoints: kps, curriculums: [], goals: [g],
      today, now: new Date(today + 'T00:00:00'),
    })
    expect(out.goals).toHaveLength(1)
    expect(out.goals[0]!.urgency).toBeGreaterThan(0.4)   // 1 天
    expect(out.kpPool.has('b')).toBe(true)
  })
})