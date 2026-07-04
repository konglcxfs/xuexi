import type { ChatRequest, ChatResponse, AIProvider } from './types.ts'
import OpenAI from 'openai'

export type { ChatRequest, ChatResponse, AIProvider }
export { AnthropicProvider } from './anthropic-provider'
export { ProviderRouter } from './router'

/**
 * OpenAI 兼容 Provider —— 同时兼容：
 *   - OpenAI 官方
 *   - DeepSeek（base_url=https://api.deepseek.com/v1）
 *   - 通义千问兼容模式
 *   - Ollama 本地（base_url=http://localhost:11434/v1）
 * 切换只需改环境变量 XUEXI_AI_BASE_URL / XUEXI_AI_MODEL
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string
  private client: OpenAI

  constructor(opts: {
    apiKey: string
    baseURL: string
    model: string
    name?: string
  }) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
    })
    this.name = opts.name ?? `openai-compatible[${opts.model}]`
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: req.systemPrompt },
      ...req.messages.map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
    ]

    const completion = await this.client.chat.completions.create({
      model: process.env.XUEXI_AI_MODEL ?? 'deepseek-chat',
      messages,
      temperature: req.temperature ?? 0.5,
      max_tokens: req.maxTokens ?? 1500,
      ...(req.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    })

    const choice = completion.choices[0]
    const content = choice?.message?.content ?? ''
    return {
      content,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    }
  }
}

/**
 * 本地假 Provider —— 当没有 API key 时用于本地开发测试，
 * 用规则化的回复来支撑整个系统能跑通。
 */
export class LocalStubProvider implements AIProvider {
  readonly name = 'local-stub'
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const last = req.messages.at(-1)
    const userContent = last?.content ?? ''
    const echo = `[本地模式] 我看到你说："${userContent.slice(0, 80)}"。` +
      `当前 system prompt 已生效（长度=${req.systemPrompt.length} 字符）。` +
      `配置 XUEXI_AI_API_KEY 后即可接入真实大模型。`
    return { content: echo }
  }
}

/**
 * Provider 工厂 —— 根据环境变量决定使用哪一个。
 */
export function createProviderFromEnv(): AIProvider {
  const apiKey = process.env.XUEXI_AI_API_KEY
  const baseURL = process.env.XUEXI_AI_BASE_URL ?? 'https://api.deepseek.com/v1'
  if (!apiKey) {
    return new LocalStubProvider()
  }
  return new OpenAICompatibleProvider({
    apiKey,
    baseURL,
    model: process.env.XUEXI_AI_MODEL ?? 'deepseek-chat',
    name: process.env.XUEXI_AI_PROVIDER_NAME,
  })
}

export * from './types'
export * from './prompt-builder'
