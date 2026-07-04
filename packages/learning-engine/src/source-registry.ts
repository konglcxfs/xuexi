/**
 * SourceRegistry —— 数据源适配器注册表
 *
 * 三类 SourceAdapter：
 *   - textbook：教材源（人教 / 苏教 / 北师大 / 软考官方 PDF）
 *   - question_bank：题库源（同步练习 / 真题 / 模拟题）
 *   - material：资料源（视频 / 讲义 / 文章）
 *
 * 设计要点：
 *   - 接口统一：SourceAdapter.fetch({ locator, params })
 *   - 引擎只关心产出（KnowledgePoint / Exercise / Material / KnowledgeConnection）
 *   - 具体 adapter 可以是本地 JSON、PDF 解析、第三方 API
 *
 * 本文件只提供 registry 骨架。具体 adapter 实现放在 packages/learning-engine/src/adapters/。
 */

import type { SourceAdapter } from '@xuexi/shared'

export class SourceRegistry {
  private adapters = new Map<string, SourceAdapter>()

  register(adapter: SourceAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  get(id: string): SourceAdapter | undefined {
    return this.adapters.get(id)
  }

  list(kind?: SourceAdapter['kind']): SourceAdapter[] {
    const all = Array.from(this.adapters.values())
    return kind ? all.filter(a => a.kind === kind) : all
  }
}

export const defaultSourceRegistry = new SourceRegistry()

// 占位：内置两个 adapter ID（具体实现待补）。
// 真实的 SourceAdapter 注入放在 adapters/ 子目录或 server 启动时。
defaultSourceRegistry.register({
  id: 'pep-digital-textbook',
  displayName: '人教数字教材',
  kind: 'textbook',
  produces: ['KnowledgePoint', 'Exercise', 'Material', 'KnowledgeConnection'],
  requiresAuth: false,
  network: false,
  fetch: async () => {
    throw new Error('pep-digital-textbook adapter not yet implemented')
  },
})

defaultSourceRegistry.register({
  id: 'ruankao-official-pdf',
  displayName: '软考官方教材 / 真题 PDF',
  kind: 'textbook',
  produces: ['KnowledgePoint', 'Exercise', 'Material'],
  requiresAuth: false,
  network: false,
  fetch: async () => {
    throw new Error('ruankao-official-pdf adapter not yet implemented')
  },
})