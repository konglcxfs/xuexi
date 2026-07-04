import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'
import type { LearningPlan } from '@xuexi/shared'

export function PlanPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [plans, setPlans] = useState<LearningPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(40)
  const [totalDays, setTotalDays] = useState(14)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user) return
    api.listPlans(user.userId).then((p) => {
      setPlans(p)
      setLoading(false)
    })
  }, [user])

  async function create() {
    if (!user) return
    setCreating(true)
    try {
      const plan = await api.createPlan({
        userId: user.userId,
        goal: goal || '系统学习',
        dailyMinutes,
        totalDays,
      })
      setPlans([plan, ...plans])
    } finally {
      setCreating(false)
    }
  }

  async function simulatePractice(
    planId: string,
    taskId: string,
    kpId: string,
    dimension: 'apply' | 'explain'
  ) {
    if (!user) return
    // 模拟一次答对 / 答错
    const correct = Math.random() > 0.4
    await api.addEvidence({
      userId: user.userId,
      knowledgePointId: kpId,
      dimension,
      correct,
      score: correct ? 0.85 : 0.3,
      feedback: correct ? '答对了' : '还差一点',
    })
    alert(correct ? '✅ 这次掌握了' : '⚠️ 这次没掌握，会进入复习队列')
    nav('/weakness')
  }

  if (loading) return <div className="text-slate-500">加载中...</div>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">📅 学习计划</h1>
        <p className="text-slate-500 text-sm mt-1">
          引擎根据薄弱点 + 知识图谱 + 遗忘曲线自动生成多日计划。每天不超过你设定的时间。
        </p>
      </header>

      <div className="xuexi-card">
        <h2 className="font-semibold text-slate-800 mb-3">🆕 生成新计划</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="目标">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例如：两周把分数搞定"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </Field>
          <Field label="每天时长（分钟）">
            <input
              type="number"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              min={10}
              max={240}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </Field>
          <Field label="计划天数">
            <input
              type="number"
              value={totalDays}
              onChange={(e) => setTotalDays(Number(e.target.value))}
              min={1}
              max={60}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </Field>
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="mt-3 xuexi-btn xuexi-btn-primary disabled:opacity-50"
        >
          {creating ? '生成中...' : '生成计划'}
        </button>
      </div>

      {plans.length === 0 && (
        <div className="xuexi-card text-center text-slate-500">还没有计划</div>
      )}

      {plans.map((plan) => (
        <div key={plan.id} className="xuexi-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-800">{plan.title}</h3>
              {plan.goal && <p className="text-xs text-slate-500 mt-1">目标：{plan.goal}</p>}
            </div>
            <span className="xuexi-pill bg-brand-100 text-brand-700">
              {plan.days.length} 天
            </span>
          </div>

          <div className="space-y-4">
            {plan.days.slice(0, 5).map((day) => (
              <div key={day.index} className="border-l-4 border-brand-300 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="xuexi-pill bg-slate-200 text-slate-700">第 {day.index} 天</span>
                  <span className="text-sm text-slate-600">{day.date}</span>
                  <span className="text-xs text-slate-400">
                    {day.estimatedMinutes} 分钟
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium mb-2">{day.theme}</p>
                <ul className="space-y-1.5">
                  {day.tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg"
                    >
                      <div className="flex-1">
                        <span className="text-xs xuexi-pill bg-white border border-slate-200 text-slate-600 mr-2">
                          {kindLabel(t.kind)}
                        </span>
                        {t.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{t.estimateMinutes}m</span>
                        <button
                          onClick={() =>
                            simulatePractice(
                              plan.id,
                              t.id,
                              t.knowledgePointId,
                              t.kind === 'explain' ? 'explain' : 'apply'
                            )
                          }
                          className="text-xs text-brand-600 hover:underline"
                        >
                          完成 →
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {day.rationale && (
                  <p className="text-xs text-slate-400 mt-2 italic">{day.rationale}</p>
                )}
              </div>
            ))}
            {plan.days.length > 5 && (
              <p className="text-xs text-slate-500 text-center">
                还有 {plan.days.length - 5} 天未展开...
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
    </label>
  )
}

function kindLabel(k: string): string {
  switch (k) {
    case 'review':
      return '复习'
    case 'learn':
      return '新学'
    case 'practice':
      return '练习'
    case 'explain':
      return '讲解'
    case 'connect':
      return '串联'
    default:
      return k
  }
}
