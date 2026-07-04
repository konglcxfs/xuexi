/**
 * Anthropic (Claude) Provider —— 直接走 /v1/messages，不依赖官方 SDK。
 *
 * 选择这样做的原因：
 *   - 桌面应用 + Electron 主进程体积敏感，少一个依赖少一份风险
 *   - 请求体形状稳定，fetch + 解析即可
 *
 * 如果以后要支持更多 Anthropic 能力（Tool Use / Vision），再换成 SDK。
 */

import type { ChatRequest, ChatResponse, AIProvider } from './types'

export class AnthropicProvider implements AIProvider {
  readonly name: string
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(opts: { apiKey: string; baseUrl?: string; model?: string; name?: string }) {
    this.apiKey = opts.apiKey
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com/v1'
    this.model = opts.model ?? 'claude-3-5-sonnet-latest'
    this.name = opts.name ?? `anthropic[${this.model}]`
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const system = req.systemPrompt
    const messages = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

    const body = {
      model: this.model,
      system,
      messages,
      max_tokens: req.maxTokens ?? 1500,
      temperature: req.temperature ?? 0.5,
    }

    const resp = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`anthropic ${resp.status}: ${text.slice(0, 200)}`)
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const content = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('')

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
    }
  }
}