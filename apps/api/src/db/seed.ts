import { db } from './index'
import { ALL_KNOWLEDGE_POINTS } from '@xuexi/knowledge-base'

/**
 * 启动时把知识库写入数据库。
 * 已经存在的点不会覆盖（保留本地可能的修改）。
 */
export function seedKnowledgeBase(): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO knowledge_points
     (id, role, graph, code, title, description, prerequisites_json, difficulty, tags_json, mastery_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const p of ALL_KNOWLEDGE_POINTS) {
    insert.run(
      p.id,
      p.role,
      p.graph,
      p.code,
      p.title,
      p.description,
      JSON.stringify(p.prerequisites),
      p.difficulty,
      JSON.stringify(p.tags),
      JSON.stringify(p.mastery)
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedKnowledgeBase()
  // eslint-disable-next-line no-console
  console.log(`[seed] 写入 ${ALL_KNOWLEDGE_POINTS.length} 个知识点`)
}
