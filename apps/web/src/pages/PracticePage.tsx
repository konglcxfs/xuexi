/**
 * PracticePage —— 出题 + 答题 + 上报 mastery evidence。
 *
 * 数据流：
 *   1) 调用 /api/sources/primary-math-g4-bank/exercises?units=… 拿练习题
 *   2) 学生在 UI 答题
 *   3) 提交时调用 /api/evidence 把 feedback 上传给 learning-engine
 *      后端的 MasteryEngine.Apply Evidence 会更新 mastery，并把答题记录入 sqlite
 *
 * 这是"采集注入式 + 学习法驱动"的两端联通演示。
 */

import { useEffect, useState } from 'react'
import type { Exercise } from '@xuexi/shared'
import { api } from '../api'
import { useAuth } from '../auth'

export function PracticePage() {
  const { user } = useAuth()
  const [units, setUnits] = useState<string>('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<null | { correct: boolean; expected: string; explanation?: string }>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setErr(null)
    setLoading(true)
    try {
      const r = await api.listExercises('primary-math-g4-bank', {
        units: units ? units.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      })
      setExercises(r.exercises)
      setIdx(0)
      setAnswer('')
      setResult(null)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])   // 首次自动加载

  if (!user) return null

  const cur = exercises[idx]
  if (!cur) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">练习</h1>
        <div className="xuexi-card space-y-3">
          <p className="text-slate-600 text-sm">先用 units 标签筛一组题，或点下面"出题"。</p>
          <div className="flex items-center gap-2">
            <input
              value={units}
              onChange={e => setUnits(e.target.value)}
              placeholder="例如: angle, multiply, trapezoid（逗号分隔，留空取全部）"
              className="xuexi-input flex-1"
            />
            <button onClick={load} disabled={loading} className="xuexi-btn xuexi-btn-primary text-sm">
              {loading ? '出题中…' : '出题'}
            </button>
          </div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <p className="text-xs text-slate-400">内置示例：8 道题，覆盖角的度量 / 乘法 / 平行四边形 / 统计四个 KP。</p>
        </div>
      </div>
    )
  }

  async function submit() {
    if (!cur) return
    const expected = Array.isArray(cur.answer) ? cur.answer.join(',') : cur.answer
    const correct = answer.trim().toLowerCase() === expected.trim().toLowerCase()
    setResult({ correct, expected, explanation: cur.explanation })

    // 上报 mastery evidence
    if (!user) return
    await api.addEvidence({
      userId: user.userId,
      knowledgePointId: cur.knowledgePointIds[0] ?? '',
      dimension: 'apply',
      correct,
      score: correct ? 1 : 0,
      feedback: `practice[${cur.id}] correct=${correct}`,
    })
  }

  function next() {
    setAnswer('')
    setResult(null)
    setIdx((idx + 1) % exercises.length)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">练习</h1>

      <div className="xuexi-card">
        <div className="text-xs text-slate-500 mb-1">
          {idx + 1} / {exercises.length} · 知识点：{cur.knowledgePointIds.join(', ')} · 题型：{cur.kind}
        </div>
        <div className="text-lg text-slate-800 my-3">{cur.stem}</div>

        {cur.kind === 'multiple_choice' && cur.options && (
          <ul className="space-y-2">
            {cur.options.map(o => (
              <li key={o.key}>
                <label className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${answer === o.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="answer"
                    value={o.key}
                    checked={answer === o.key}
                    onChange={() => setAnswer(o.key)}
                  />
                  <span className="text-sm text-slate-700">{o.key}. {o.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {(cur.kind === 'fill_blank' || cur.kind === 'short_answer') && (
          <input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            className="xuexi-input w-full"
            placeholder="在此输入答案"
          />
        )}

        {cur.kind === 'true_false' && (
          <div className="flex gap-2">
            {['true', 'false'].map(v => (
              <button
                key={v}
                onClick={() => setAnswer(v)}
                className={`xuexi-btn text-sm ${answer === v ? 'xuexi-btn-primary' : 'xuexi-btn-ghost'}`}
              >
                {v === 'true' ? '对' : '错'}
              </button>
            ))}
          </div>
        )}

        {result && (
          <div className={`mt-3 p-3 rounded-xl ${result.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <div className="font-medium">{result.correct ? '回答正确' : `回答错误（正确答案：${result.expected}）`}</div>
            {result.explanation && <div className="text-sm mt-1 text-slate-700">{result.explanation}</div>}
          </div>
        )}

        <div className="flex justify-between mt-4">
          <button
            onClick={() => setIdx((idx - 1 + exercises.length) % exercises.length)}
            className="xuexi-btn xuexi-btn-ghost text-sm"
          >上一题</button>
          {!result ? (
            <button
              onClick={submit}
              disabled={!answer.trim()}
              className="xuexi-btn xuexi-btn-primary text-sm"
            >提交</button>
          ) : (
            <button onClick={next} className="xuexi-btn xuexi-btn-primary text-sm">下一题</button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-400">
        题目数据由 <code>primary-math-g4-bank</code> SourceAdapter 提供。后续可换成教育部国家中小学智慧教育平台题库。
      </div>
    </div>
  )
}