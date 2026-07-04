import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'
import type { ChatSession, KnowledgePoint } from '@xuexi/shared'

const STATES = [
  { value: 'idle', label: '自由提问' },
  { value: 'explaining', label: '让老师讲解' },
  { value: 'practicing', label: '我来练一练' },
  { value: 'reviewing', label: '帮我复习' },
  { value: 'planning', label: '调整计划' },
] as const

export function ChatPage() {
  const { user } = useAuth()
  const [points, setPoints] = useState<KnowledgePoint[]>([])
  const [kpId, setKpId] = useState<string>('')
  const [state, setState] = useState<typeof STATES[number]['value']>('idle')
  const [session, setSession] = useState<ChatSession | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    api.getGraph(user.role).then((r) => {
      setPoints(r.points)
      if (r.points[0]) setKpId(r.points[0].id)
    })
  }, [user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [session?.messages.length])

  async function send() {
    if (!user || !input.trim()) return
    setSending(true)
    try {
      const res = await api.chat({
        userId: user.userId,
        sessionId: session?.id,
        knowledgePointId: kpId || undefined,
        state,
        message: input.trim(),
      })
      setSession(res.session)
      setInput('')
    } finally {
      setSending(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">💬 AI 对话</h1>
        <p className="text-slate-500 text-sm mt-1">
          引擎已经记住了你是 {user.displayName}（{user.role === 'primary_school' ? '小学生' : '软考生'}），
          并根据当前知识点 + 薄弱点 + 长期记忆定制回答风格。
        </p>
      </header>

      <div className="xuexi-card grid md:grid-cols-3 gap-3">
        <label className="block">
          <div className="text-xs text-slate-500 mb-1">当前知识点</div>
          <select
            value={kpId}
            onChange={(e) => setKpId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          >
            <option value="">(不指定)</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-xs text-slate-500 mb-1">状态</div>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as typeof state)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          >
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            onClick={() => setSession(null)}
            className="xuexi-btn xuexi-btn-ghost text-xs"
          >
            清空对话
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="xuexi-card h-[480px] overflow-y-auto bg-slate-50"
      >
        {(!session || session.messages.length === 0) && (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">✨</div>
              从一个问题开始吧...
            </div>
          </div>
        )}
        <div className="space-y-3">
          {session?.messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[80%] bg-brand-600 text-white px-4 py-2 rounded-2xl rounded-br-sm'
                  : 'mr-auto max-w-[80%] bg-white border border-slate-200 px-4 py-2 rounded-2xl rounded-bl-sm whitespace-pre-wrap'
              }
            >
              {m.content}
            </div>
          ))}
        </div>
      </div>

      <div className="xuexi-card flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          placeholder="问一个关于这个知识点的问题... (Enter 发送 / Shift+Enter 换行)"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="xuexi-btn xuexi-btn-primary disabled:opacity-50"
        >
          {sending ? '...' : '发送'}
        </button>
      </div>
    </div>
  )
}
