import { useState } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

export function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'primary_school' | 'ruankao'>('primary_school')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!displayName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { id } = await api.createUser(
        displayName.trim(),
        role,
        role === 'ruankao' ? { ruankaoLevel: 'junior' } : { grade: 4 }
      )
      login({ userId: id, displayName: displayName.trim(), role })
      nav('/')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 via-white to-warm-50">
      <div className="xuexi-card w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-700 mb-1">📚 xuexi 学习引擎</h1>
        <p className="text-sm text-slate-500 mb-6">
          一个统一的学习引擎：为小学生和软考生都提供个性化计划、薄弱点诊断、知识串联。
        </p>

        <label className="block text-sm font-medium text-slate-700 mb-1">昵称</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例如：小明 / 我"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />

        <label className="block text-sm font-medium text-slate-700 mb-2">角色</label>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <RoleCard
            active={role === 'primary_school'}
            onClick={() => setRole('primary_school')}
            emoji="🎒"
            title="小学生"
            desc="四年级上册数学"
          />
          <RoleCard
            active={role === 'ruankao'}
            onClick={() => setRole('ruankao')}
            emoji="📐"
            title="软考考生"
            desc="中级 / 高级"
          />
        </div>

        <button
          onClick={submit}
          disabled={loading || !displayName.trim()}
          className="w-full xuexi-btn xuexi-btn-primary disabled:opacity-50"
        >
          {loading ? '进入...' : '进入学习引擎'}
        </button>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <p className="mt-4 text-xs text-slate-400">
          首次进入会建立一个用户档案（保存在本地浏览器存储里），稍后可在右上角切换。
        </p>
      </div>
    </div>
  )
}

function RoleCard({
  active,
  onClick,
  emoji,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  emoji: string
  title: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={
        'p-4 rounded-xl border text-left transition ' +
        (active
          ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-200'
          : 'bg-white border-slate-200 hover:border-brand-200')
      }
    >
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{desc}</div>
    </button>
  )
}
