import type { ChatMessage } from '@xuexi/shared'

/**
 * AIProvider 接口 + ChatRequest/Response —— 抽象不同 LLM 的实现。
 */
export interface ChatRequest {
  messages: ChatMessage[]
  systemPrompt: string
  temperature?: number
  maxTokens?: number
  /** JSON 模式（用于让 AI 输出结构化诊断结果） */
  jsonMode?: boolean
}

export interface ChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIProvider {
  readonly name: string
  chat(req: ChatRequest): Promise<ChatResponse>
}
