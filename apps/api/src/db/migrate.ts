import { db } from './index'
import { seedKnowledgeBase } from './seed'

/**
 * 直接运行 migrate：建表 + 灌知识库。
 * 一行 sql 已把所有建表语句写在 db/index.ts 里，所以这里只需要 ensure + seed。
 */
seedKnowledgeBase()
// eslint-disable-next-line no-console
console.log('[migrate] done')
