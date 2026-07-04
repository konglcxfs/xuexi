import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'
import type { KnowledgeConnection, KnowledgePoint, MasteryState } from '@xuexi/shared'

interface Positioned {
  id: string
  title: string
  x: number
  y: number
  mastery?: number
}

export function GraphPage() {
  const { user } = useAuth()
  const [points, setPoints] = useState<KnowledgePoint[]>([])
  const [mastery, setMastery] = useState<MasteryState[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [links, setLinks] = useState<KnowledgeConnection[]>([])

  useEffect(() => {
    if (!user) return
    api.getGraph(user.role).then((r) => setPoints(r.points))
    api.getMastery(user.userId).then((m) => setMastery(m as MasteryState[]))
  }, [user])

  useEffect(() => {
    if (!user || !selected) {
      setLinks([])
      return
    }
    api.getLinks(user.userId, selected).then((r) => setLinks(r.connections))
  }, [user, selected])

  const positioned = useMemo<Positioned[]>(() => {
    return layoutTree(points)
  }, [points])

  const masteryMap = useMemo(() => {
    const m = new Map<string, number>()
    mastery.forEach((s) => m.set(s.knowledgePointId, s.mastery))
    return m
  }, [mastery])

  const edges = useMemo(() => {
    return points.flatMap((p) =>
      p.prerequisites.map((pre) => ({
        from: pre,
        to: p.id,
      }))
    )
  }, [points])

  if (!user) return null

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">🕸️ 知识图谱</h1>
        <p className="text-slate-500 text-sm mt-1">
          点击任意节点查看它和别的知识点的串联（前置 / 类比 / 扩展）。
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="xuexi-card md:col-span-2 h-[560px] overflow-auto">
          <svg viewBox="0 0 1000 600" className="w-full h-full">
            {edges.map((e) => {
              const a = positioned.find((p) => p.id === e.from)
              const b = positioned.find((p) => p.id === e.to)
              if (!a || !b) return null
              return (
                <g key={`${e.from}-${e.to}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#cbd5e1"
                    strokeWidth={1.2}
                    markerEnd="url(#arrow)"
                  />
                </g>
              )
            })}
            <defs>
              <marker
                id="arrow"
                markerWidth="6"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L6,3 z" fill="#cbd5e1" />
              </marker>
            </defs>
            {positioned.map((p) => {
              const m = masteryMap.get(p.id) ?? 0
              const fill =
                m >= 0.85
                  ? '#a7f3d0'
                  : m >= 0.6
                  ? '#bfdbfe'
                  : m > 0
                  ? '#fde68a'
                  : '#e2e8f0'
              const isSel = selected === p.id
              return (
                <g
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSel ? 28 : 22}
                    fill={fill}
                    stroke={isSel ? '#7c3aed' : '#64748b'}
                    strokeWidth={isSel ? 3 : 1}
                  />
                  <text
                    x={p.x}
                    y={p.y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    className="select-none"
                    fill="#1e293b"
                  >
                    {p.title.slice(0, 4)}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + 42}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#475569"
                  >
                    {Math.round(m * 100)}%
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="xuexi-card h-[560px] overflow-y-auto">
          {selected ? (
            (() => {
              const p = points.find((x) => x.id === selected)
              if (!p) return null
              return (
                <div>
                  <h2 className="font-bold text-slate-800">{p.title}</h2>
                  <p className="text-sm text-slate-600 mt-1">{p.description}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    掌握度：
                    <span className="font-semibold ml-1">
                      {Math.round((masteryMap.get(p.id) ?? 0) * 100)}%
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mt-4 mb-2">🔗 知识串联</h3>
                  {links.length === 0 ? (
                    <p className="text-sm text-slate-500">未找到串联</p>
                  ) : (
                    <ul className="space-y-2">
                      {links.map((c, i) => (
                        <li key={i} className="bg-slate-50 p-3 rounded-xl text-sm">
                          <div className="text-xs text-brand-700 font-semibold mb-1">
                            {connKindLabel(c.kind)}
                          </div>
                          <div className="text-slate-700">{c.description}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className="text-sm font-semibold mt-4 mb-2">前置</h3>
                  <ul className="text-sm space-y-1">
                    {p.prerequisites.length === 0 && (
                      <li className="text-slate-400">（无）</li>
                    )}
                    {p.prerequisites.map((pid) => {
                      const p2 = points.find((x) => x.id === pid)
                      if (!p2) return null
                      return (
                        <li
                          key={pid}
                          className="text-brand-600 hover:underline cursor-pointer"
                          onClick={() => setSelected(pid)}
                        >
                          ← {p2.title}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()
          ) : (
            <div className="text-slate-500 text-sm h-full flex items-center justify-center text-center">
              点击左侧任意节点查看详情和串联。
            </div>
          )}
        </div>
      </div>

      <div className="xuexi-card text-xs text-slate-500">
        <div className="flex items-center gap-4 flex-wrap">
          <Legend color="#a7f3d0" label="已掌握 ≥85%" />
          <Legend color="#bfdbfe" label="学习中 ≥60%" />
          <Legend color="#fde68a" label="有错题" />
          <Legend color="#e2e8f0" label="未开始" />
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded-full border border-slate-300"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  )
}

function connKindLabel(k: string): string {
  switch (k) {
    case 'prerequisite':
      return '📌 前置'
    case 'analogy':
      return '🔁 类比'
    case 'extension':
      return '➡️ 延伸'
    case 'common_misconception':
      return '⚠️ 易错点'
    default:
      return k
  }
}

/**
 * 简易布局：BFS 分层，按 prerequisites 数放层级。
 */
function layoutTree(points: KnowledgePoint[]): Positioned[] {
  const ind = new Map<string, number>()
  for (const p of points) ind.set(p.id, 0)
  for (const p of points) for (const pre of p.prerequisites) ind.set(pre, (ind.get(pre) ?? 0) + 1)

  // 拓扑分层
  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const p of points) {
    if ((ind.get(p.id) ?? 0) === 0) {
      layer.set(p.id, 0)
      queue.push(p.id)
    }
  }
  while (queue.length) {
    const id = queue.shift()!
    const l = layer.get(id) ?? 0
    for (const p of points.filter((x) => x.prerequisites.includes(id))) {
      const nl = l + 1
      if ((layer.get(p.id) ?? -1) < nl) {
        layer.set(p.id, nl)
        queue.push(p.id)
      }
    }
  }

  // 按层分桶
  const buckets = new Map<number, string[]>()
  for (const [id, l] of layer) {
    if (!buckets.has(l)) buckets.set(l, [])
    buckets.get(l)!.push(id)
  }

  const out: Positioned[] = []
  const layerKeys = [...buckets.keys()].sort((a, b) => a - b)
  const W = 1000
  const H = 600
  const padding = 60
  for (const lk of layerKeys) {
    const ids = buckets.get(lk)!
    const step = (W - 2 * padding) / Math.max(1, ids.length - 1)
    ids.forEach((id, idx) => {
      const p = points.find((x) => x.id === id)
      if (!p) return
      out.push({
        id,
        title: p.title,
        x: ids.length === 1 ? W / 2 : padding + idx * step,
        y: padding + (lk / Math.max(1, layerKeys.length - 1)) * (H - 2 * padding),
      })
    })
  }
  return out
}
