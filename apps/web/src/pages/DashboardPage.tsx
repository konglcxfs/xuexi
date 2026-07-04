import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'
import type { DashboardSummary } from '@xuexi/shared'

export function DashboardPage() {
  const { user } = useAuth()
  const [dash, setDash] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    api.getDashboard(user.userId).then((d) => {
      setDash(d)
      setLoading(false)
    })
  }, [user])

  if (loading || !dash) return <div className="text-slate-500">加载中...</div>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">
          你好，{dash.user.displayName} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          今天是 {new Date().toLocaleDateString('zh-CN')}，下面是为你定制的今日学习概况。
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="平均掌握度" value={`${(dash.masteryAverage * 100).toFixed(0)}%`} accent="text-brand-700" />
        <Stat label="薄弱知识点" value={dash.weakPointsCount} accent="text-warm-600" />
        <Stat label="待复习" value={dash.upcomingReviews} accent="text-amber-600" />
        <Stat label="累计学习" value={`${dash.totalMinutes} 分钟`} accent="text-slate-700" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="xuexi-card">
          <h2 className="font-semibold text-slate-800 mb-2">📋 今日学习计划</h2>
          {dash.todayPlan ? (
            <div>
              <p className="text-sm text-slate-600 mb-2">{dash.todayPlan.theme}</p>
              <p className="text-xs text-slate-400 mb-3">
                预计 {dash.todayPlan.estimatedMinutes} 分钟 · {dash.todayPlan.tasks.length} 个任务
              </p>
              <ul className="space-y-2">
                {dash.todayPlan.tasks.slice(0, 4).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">{t.title}</div>
                      <div className="text-xs text-slate-500">{t.description}</div>
                    </div>
                    <span className="xuexi-pill bg-slate-200 text-slate-600">
                      {t.estimateMinutes}m
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/plan" className="block mt-3 text-sm text-brand-600 hover:underline">
                查看完整计划 →
              </Link>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              还没有计划。
              <Link to="/plan" className="text-brand-600 hover:underline ml-1">
                去生成 →
              </Link>
            </div>
          )}
        </div>

        <div className="xuexi-card">
          <h2 className="font-semibold text-slate-800 mb-2">🎯 快速入口</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink to="/weakness" emoji="🩺" title="薄弱点诊断" subtitle="找出盲区" />
            <QuickLink to="/chat" emoji="💬" title="AI 对话" subtitle="讲解 & 提问" />
            <QuickLink to="/graph" emoji="🕸️" title="知识图谱" subtitle="看依赖" />
            <QuickLink to="/plan" emoji="📅" title="调整计划" subtitle="再生成" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="xuexi-card">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  )
}

function QuickLink({
  to,
  emoji,
  title,
  subtitle,
}: {
  to: string
  emoji: string
  title: string
  subtitle: string
}) {
  return (
    <Link
      to={to}
      className="block p-3 rounded-xl bg-slate-50 hover:bg-brand-50 transition"
    >
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-sm font-medium text-slate-800">{title}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </Link>
  )
}
