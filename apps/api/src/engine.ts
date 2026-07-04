import type { RoleType } from '@xuexi/shared'
import {
  KnowledgeGraph,
  PlanGenerator,
  WeaknessDiagnostics,
  KnowledgeLinker,
} from '@xuexi/learning-engine'
import {
  PromptBuilder,
  createProviderFromEnv,
  ProviderRouter,
} from '@xuexi/ai-adapter'
import type { AIProvider } from '@xuexi/ai-adapter'
import { ALL_KNOWLEDGE_POINTS } from '@xuexi/knowledge-base'
import { repo, providerRepo } from './db/repo'
import { decryptSafe } from './crypto'

/**
 * 引擎运行时（Engine Runtime）—— 进程内的"会话态"。
 *
 * 设计：
 *  - 启动时从 DB 加载知识库到 KnowledgeGraph（按角色分别加载）。
 *  - 用户级的运行时状态（graph 实例、prompt builder）懒加载。
 *  - 持久化的数据都通过 repo 走 DB。
 *
 * 这是一个微型的 plugin registry，未来可拆成 service。
 */

interface RuntimeContext {
  graph: KnowledgeGraph
  prompts: PromptBuilder
}

const caches = new Map<RoleType, RuntimeContext>()

export function engineFor(role: RoleType): RuntimeContext {
  const cached = caches.get(role)
  if (cached) return cached
  const points = ALL_KNOWLEDGE_POINTS.filter((p) => p.role === role)
  const graph = new KnowledgeGraph()
  graph.load(points)
  const ctx: RuntimeContext = { graph, prompts: new PromptBuilder() }
  caches.set(role, ctx)
  return ctx
}

export function diagnosticsFor(role: RoleType) {
  const { graph, prompts } = engineFor(role)
  return new WeaknessDiagnostics({ graph, role, prompts })
}

export function planGenFor(role: RoleType) {
  const { graph } = engineFor(role)
  return new PlanGenerator({ graph, role })
}

export function linkerFor(role: RoleType) {
  const { graph } = engineFor(role)
  return new KnowledgeLinker({ graph, role })
}

/**
 * 默认 AI Provider：优先用 ProviderRouter（用户配置的 active provider），
 * 退化到 env-based provider，再退化到 LocalStubProvider。
 */
let router: ProviderRouter | null = null
let fallback: AIProvider = createProviderFromEnv()

export function aiFor(userId: string | null): AIProvider {
  if (!router) {
    router = new ProviderRouter({ decrypt: decryptSafe })
  }
  if (userId) {
    const configs = providerRepo.list(userId)
    const active = router.load(configs)
    if (active) {
      return router.resolve(active.configId)
    }
  }
  return fallback
}

// 兼容老代码：直接 import aiProvider 的场景
export const aiProvider = fallback

// 把上面这些再聚合成一个 facade，方便路由中调用
export const engine = {
  for: engineFor,
  diagnostics: diagnosticsFor,
  plan: planGenFor,
  linker: linkerFor,
  aiProvider,                         // env fallback
  ai: aiFor,                          // 路由（推荐）
  repo,
  providerRepo,
  router,
}
