/**
 * ProviderRouter —— 多服务商 AI Key 路由器。
 *
 * 工作流：
 *   1) 后端 / 桌面端主进程 启动时，加载用户配置的 active AIProviderConfig + 解密它的 apiKey
 *   2) ProviderRouter 拿到凭证（creds）后，根据 vendor 选具体 provider 实现
 *   3) 上层 chat 直接走 router，无需关心 vendor 切换
 *
 * 多家并存：允许 list() 同时有多个 provider，由 router 决定用哪个 active。
 * 切换 = 调一次 setActive()，下一次请求生效（router 内部缓存凭证）。
 */

import type {
  AIProviderConfig,
  AIProviderCredentials,
} from '@xuexi/shared'
import type { AIProvider, ChatRequest, ChatResponse } from './types'
import { OpenAICompatibleProvider, LocalStubProvider } from './index'
import { AnthropicProvider } from './anthropic-provider'

export type DecryptFn = (encrypted: string) => string

export class ProviderRouter {
  private providers = new Map<string, AIProvider>()
  private decrypt: DecryptFn

  constructor(opts: { decrypt: DecryptFn }) {
    this.decrypt = opts.decrypt
  }

  /**
   * 载入若干 provider configs（明文密文都接受，按 encryptedApiKey 走解密）。
   * 把 activated 的那条作为 active。
   */
  load(configs: AIProviderConfig[]): AIProviderCredentials | null {
    this.providers.clear()
    let active: AIProviderCredentials | null = null

    for (const c of configs) {
      const apiKey = this.decrypt(c.encryptedApiKey)
      const creds: AIProviderCredentials = {
        configId: c.id,
        vendor: c.vendor,
        baseUrl: c.baseUrl,
        model: c.model,
        apiKey,
      }
      const p = this.materialize(creds)
      this.providers.set(c.id, p)
      if (c.isActive) active = creds
    }
    return active
  }

  /** 返回当前 router 内活跃的 provider（按 configId），没注册过就报错 */
  resolve(configId?: string): AIProvider {
    if (configId) {
      const p = this.providers.get(configId)
      if (!p) throw new Error(`Provider ${configId} not registered`)
      return p
    }
    // 取第一个
    const first = this.providers.values().next().value as AIProvider | undefined
    if (!first) throw new Error('No provider registered. Add one via /api/ai-providers.')
    return first
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  materialize(creds: AIProviderCredentials): AIProvider {
    switch (creds.vendor) {
      case 'openai':
      case 'deepseek':
      case 'ollama':
      case 'custom':
        return new OpenAICompatibleProvider({
          apiKey: creds.apiKey,
          baseURL: creds.baseUrl,
          model: creds.model,
          name: `${creds.vendor}[${creds.model}]`,
        })
      case 'anthropic':
        return new AnthropicProvider({
          apiKey: creds.apiKey,
          baseUrl: creds.baseUrl,
          model: creds.model,
          name: `anthropic[${creds.model}]`,
        })
      default:
        // 退化到本地 stub，避免崩溃
        return new LocalStubProvider()
    }
  }
}