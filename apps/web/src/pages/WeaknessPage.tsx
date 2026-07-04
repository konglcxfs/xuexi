import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'
import type { WeaknessReport } from '@xuexi/shared'

export function WeaknessPage() {
  const { user } = useAuth()
  const [report, setReport] = useState<WeaknessReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    const latest = await api.getLatestWeakness(user.userId)
    setReport(latest?.report ?? null)
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function runDiagnosis() {
    if (!user) return
    setRunning(true)
    try {
      const { report } = await api.runWeakness(user.userId)
      setReport(report)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="text-slate-500">加载中...</div>

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🩺 薄弱点诊断</h1>
          <p className="text-slate-500 text-sm mt-1">
            引擎会分析你的错题记录、掌握度历史、知识依赖关系，找出真正薄弱的根因。
          </p>
        </div>
        <button
          onClick={runDiagnosis}
          disabled={running}
          className="xuexi-btn xuexi-btn-primary disabled:opacity-50"
        >
          {running ? '诊断中...' : '立即诊断'}
        </button>
      </header>

      {!report && (
        <div className="xuexi-card text-center text-slate-500">
          还没有诊断报告。点击右上角"立即诊断"开始。
        </div>
      )}

      {report && (
        <>
          <div className="xuexi-card">
            <h2 className="font-semibold text-slate-800 mb-2">📝 整体摘要</h2>
            <p className="text-slate-600 text-sm leading-relaxed">{report.summary}</p>
            <div className="text-xs text-slate-400 mt-2">
              生成于 {new Date(report.generatedAt).toLocaleString('zh-CN')}
            </div>
          </div>

          {report.patterns.length > 0 && (
            <div className="xuexi-card border-l-4 border-warm-500">
              <h2 className="font-semibold text-slate-800 mb-3">🔗 跨知识点薄弱模式</h2>
              <div className="space-y-3">
                {report.patterns.map((p, i) => (
                  <div key={i} className="bg-warm-50 p-3 rounded-xl">
                    <div className="font-medium text-slate-800">{p.title}</div>
                    <div className="text-sm text-slate-600 mt-1">{p.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="xuexi-card">
            <h2 className="font-semibold text-slate-800 mb-3">🎯 薄弱知识点</h2>
            <div className="space-y-3">
              {report.weakPoints.map((w, i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-slate-800">
                      {w.knowledgePoint.title}
                    </div>
                    <span className="text-sm font-semibold text-warm-600">
                      {(w.mastery * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{w.knowledgePoint.description}</p>
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <span className="xuexi-pill bg-brand-100 text-brand-700">
                      根因: {rootCauseLabel(w.rootCause)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-slate-500 mb-1">建议补救：</div>
                    <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
                      {w.remedy.map((r, j) => (
                        <li key={j}>{r}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function rootCauseLabel(rc: string): string {
  switch (rc) {
    case 'prerequisite_gap':
      return '前置缺失'
    case 'concept_unclear':
      return '概念不清'
    case 'practice_lack':
      return '练习不够'
    case 'forgetting':
      return '已遗忘'
    default:
      return rc
  }
}
