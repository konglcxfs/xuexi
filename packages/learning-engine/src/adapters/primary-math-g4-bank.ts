/**
 * PrimaryMathG4Adapter —— 把内置的同步练习 JSON 当作 SourceAdapter 暴露。
 *
 * 设计：
 *   - 把 packages/learning-engine/src/adapters/primary-math-g4.ts 里的示例集合当作数据源
 *   - 引擎通过 SourceAdapter 接口可获取到 Exercise
 *   - 同时给每道题反向关联到原 KnowledgePoint（已经写在 knowledgePointIds 字段里）
 *
 * 后续真正接入开源数据时，把 fetch 实现改为读真实 JSON / 调 API 即可。
 */

import type {
  SourceAdapter,
  SourceFetchResult,
} from '@xuexi/shared'
import { loadPrimaryMathG4Exercises } from './primary-math-g4'

export class PrimaryMathG4Adapter implements SourceAdapter {
  readonly id = 'primary-math-g4-bank'
  readonly displayName = '小学数学四年级·同步练习（内置示例）'
  readonly kind = 'question_bank' as const
  readonly produces: ('KnowledgePoint' | 'Exercise')[] = ['Exercise', 'KnowledgePoint']
  readonly requiresAuth = false
  readonly network = false

  async fetch(args: { locator: string; params?: { subjectId?: string; units?: string[] } }): Promise<SourceFetchResult> {
    const subjectId = args.params?.subjectId ?? args.locator ?? 'primary-math-g4'
    const wantedUnits = args.params?.units ?? null

    let exercises = loadPrimaryMathG4Exercises()
    if (wantedUnits && wantedUnits.length > 0) {
      exercises = exercises.filter(e => e.tags?.some(t => wantedUnits.includes(t)))
    }

    return {
      exercises: exercises.map(e => ({ ...e, subjectId })),
      // 顺便产出"从哪里来"的知识图谱节点（每个 tag 一个）
      knowledgePoints: exercises.flatMap(e => []), // 占位：避免空 array issue，由调用方合并到 graph
    }
  }
}