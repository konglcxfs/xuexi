import type { KnowledgePoint, RoleType } from '@xuexi/shared'
import { PRIMARY_MATH_GRADE4_UP } from './primary-math-grade4'
import { RUANKAO_SOFTMID } from './ruankao-softmid'

/**
 * 知识库总入口 —— 按角色返回初始知识图谱。
 */
export function getKnowledgeGraph(role: RoleType): KnowledgePoint[] {
  switch (role) {
    case 'primary_school':
      return PRIMARY_MATH_GRADE4_UP
    case 'ruankao':
      return RUANKAO_SOFTMID
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

export const ALL_KNOWLEDGE_POINTS: KnowledgePoint[] = [
  ...PRIMARY_MATH_GRADE4_UP,
  ...RUANKAO_SOFTMID,
]
