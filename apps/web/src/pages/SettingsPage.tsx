/**
 * SettingsPage —— 多服务商 AI Key 配置 + 桌面端状态 + 自动更新。
 *
 * 三件事：
 *  1. 列出当前用户配置的所有 AI provider，可以新增 / 删除 / 激活
 *  2. 桌面端状态：当前是否在 Electron 内、safeStorage 是否可用
 *  3. 自动更新：触发检查 + 下载按钮
 *
 * 入参：userId 通过 useAuth() 拿。
 */

import { useEffect, useState } from 'react'
import type { AIVendor } from '@xuexi/shared'
import { api } from '../api'
import {
  isDesktop,
  VENDOR_PRESETS,
  VENDOR_NAMES,
  encryptApiKey,
} from '../desktop'
import { useAuth } from '../auth'

type ProviderRow = {
  id: string
  displayName: string
  vendor: AIVendor
  baseUrl: string
  model: string
  apiKeyConfigured: boolean
  isActive: boolean
}

export function SettingsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [desktopInfo, setDesktopInfo] = useState<{
    inDesktop: boolean
    safeStorage: boolean
    platform: string
  } | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      try {
        const r = await api.listAiProviders(user.userId)
        setRows(r.providers)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  useEffect(() => {
    void (async () => {
      const inDesktop = isDesktop()
      let safeStorage = false
      if (inDesktop) {
        safeStorage = await window.desktop!.safeStorage.available()
      }
      setDesktopInfo({
        inDesktop,
        safeStorage,
        platform: inDesktop ? window.desktop!.platform : 'browser',
      })
    })()
  }, [])

  async function refresh() {
    if (!user) return
    const r = await api.listAiProviders(user.userId)
    setRows(r.providers)
  }

  if (!user) return null
  if (loading) return <div className="text-slate-500">加载中...</div>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">设置</h1>
        <p className="text-slate-500 text-sm mt-1">管理 AI 服务商、桌面端能力、采集库。</p>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {desktopInfo && <DesktopStatusCard info={desktopInfo} />}
      {desktopInfo?.inDesktop && <UpdaterCard />}

      <section className="xuexi-card">
        <h2 className="font-semibold text-slate-800 mb-3">AI 服务商</h2>
        {rows.length === 0 ? (
          <p className="text-slate-500 text-sm">还没有配置任何 AI provider。下方添加一条来开始。</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(r => (
              <ProviderRowItem
                key={r.id}
                userId={user.userId}
                row={r}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="xuexi-card">
        <h2 className="font-semibold text-slate-800 mb-3">添加新服务商</h2>
        <NewProviderForm
          userId={user.userId}
          onCreated={refresh}
        />
      </section>

      <SourcesPanel />
    </div>
  )
}

// ============================================================
// 子组件
// ============================================================

function DesktopStatusCard({ info }: {
  info: { inDesktop: boolean; safeStorage: boolean; platform: string }
}) {
  return (
    <section className="xuexi-card">
      <h2 className="font-semibold text-slate-800 mb-2">桌面端状态</h2>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="运行平台" value={info.platform} />
        <Stat
          label="应用形态"
          value={info.inDesktop ? '桌面应用 (Electron)' : '浏览器'}
          accent={info.inDesktop ? 'text-brand-700' : 'text-slate-500'}
        />
        <Stat
          label="安全存储"
          value={
            info.inDesktop
              ? info.safeStorage
                ? 'safeStorage 可用 (Keychain / DPAPI)'
                : 'safeStorage 不可用 — 加密强度会下降'
              : '仅浏览器 (Web Crypto，仅本地)'
          }
          accent={info.safeStorage ? 'text-emerald-600' : 'text-amber-600'}
        />
      </div>
    </section>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-medium mt-0.5 ${accent ?? 'text-slate-700'}`}>{value}</div>
    </div>
  )
}

function ProviderRowItem({
  row, userId, onChanged,
}: {
  row: ProviderRow
  userId: string
  onChanged: () => Promise<void>
}) {
  return (
    <li className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
      <div className="flex-1">
        <div className="font-medium text-slate-800">
          {row.displayName}{' '}
          {row.isActive && <span className="xuexi-pill bg-emerald-100 text-emerald-700 ml-1">活跃</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {VENDOR_NAMES[row.vendor]} · {row.model}
          {!row.apiKeyConfigured && (
            <span className="text-red-600 ml-2">⚠ 未配置 key</span>
          )}
        </div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">{row.baseUrl}</div>
      </div>
      <div className="flex items-center gap-2">
        {!row.isActive && (
          <button
            onClick={async () => {
              await api.setActiveAiProvider(userId, row.id)
              await onChanged()
            }}
            className="xuexi-btn xuexi-btn-ghost text-xs"
          >
            激活
          </button>
        )}
        <button
          onClick={async () => {
            if (!confirm(`删除「${row.displayName}」？`)) return
            await api.deleteAiProvider(userId, row.id)
            await onChanged()
          }}
          className="xuexi-btn xuexi-btn-ghost text-xs text-red-600"
        >
          删除
        </button>
      </div>
    </li>
  )
}

function NewProviderForm({
  userId, onCreated,
}: {
  userId: string
  onCreated: () => Promise<void>
}) {
  const [displayName, setDisplayName] = useState('')
  const [vendor, setVendor] = useState<AIVendor>('deepseek')
  const [baseUrl, setBaseUrl] = useState(VENDOR_PRESETS.deepseek.baseUrl)
  const [model, setModel] = useState(VENDOR_PRESETS.deepseek.model)
  const [apiKey, setApiKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function pickVendor(v: AIVendor) {
    setVendor(v)
    setBaseUrl(VENDOR_PRESETS[v].baseUrl)
    setModel(VENDOR_PRESETS[v].model)
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setErr(null)
        if (!displayName.trim() || !apiKey.trim()) {
          setErr('显示名与 API Key 必填')
          return
        }
        setSubmitting(true)
        try {
          const encrypted = await encryptApiKey(apiKey)
          await api.createAiProvider(userId, {
            displayName: displayName.trim(),
            vendor,
            baseUrl,
            model,
            apiKey: encrypted,  // 后端会再加密一次（双层加密：safeStorage + AES-GCM）
          })
          setDisplayName('')
          setApiKey('')
          await onCreated()
        } catch (e2) {
          setErr((e2 as Error).message)
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="显示名">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="主力 DeepSeek"
            className="xuexi-input w-full"
          />
        </Field>
        <Field label="服务商">
          <select
            value={vendor}
            onChange={(e) => pickVendor(e.target.value as AIVendor)}
            className="xuexi-input w-full"
          >
            {(Object.keys(VENDOR_NAMES) as AIVendor[]).map(v => (
              <option key={v} value={v}>{VENDOR_NAMES[v]}</option>
            ))}
          </select>
        </Field>
        <Field label="Base URL">
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="xuexi-input w-full"
          />
        </Field>
        <Field label="模型">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="xuexi-input w-full"
          />
        </Field>
        <Field label="API Key" full>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="不会明文存储——会在桌面端用 safeStorage 加密"
            type="password"
            className="xuexi-input w-full"
            autoComplete="off"
          />
        </Field>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="flex justify-end">
        <button
          disabled={submitting}
          className="xuexi-btn xuexi-btn-primary text-sm"
        >
          {submitting ? '保存中…' : '添加'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label, children, full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

// ============================================================
// 自动更新面板
// ============================================================

function UpdaterCard() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloaded' | 'error'>('idle')
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!isDesktop()) return
    window.desktop!.updater.onAvailable((u: any) => {
      setStatus('available')
      setInfo(`新版本 ${u?.version ?? ''} 可用，点击下载。`)
    })
    window.desktop!.updater.onDownloaded((u: any) => {
      setStatus('downloaded')
      setInfo(`新版本 ${u?.version ?? ''} 已下载，重启应用即可安装。`)
    })
  }, [])

  async function check() {
    setStatus('checking')
    setInfo(null)
    const r = await window.desktop!.updater.check()
    if (!r.ok) {
      setStatus('error')
      setInfo(r.error ?? '检查失败')
      return
    }
    setStatus('idle')
    setInfo(`当前是最新版本（最近发布 ${r.version ?? '?'}）。`)
  }

  return (
    <section className="xuexi-card">
      <h2 className="font-semibold text-slate-800 mb-2">自动更新</h2>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={check} disabled={status === 'checking'} className="xuexi-btn xuexi-btn-ghost text-sm">
          {status === 'checking' ? '检查中…' : '检查更新'}
        </button>
        {status === 'downloaded' && (
          <span className="text-emerald-600 text-sm">已就绪，重启即生效</span>
        )}
      </div>
      {info && <div className="text-xs text-slate-500">{info}</div>}
    </section>
  )
}

// ============================================================
// 本地采集库面板 —— 仅 Electron 桌面端启用
// ============================================================

type WatchEntry = { dir: string; subjectId: string; lastResult?: unknown }

function SourcesPanel() {
  const [dir, setDir] = useState('')
  const [subjectId, setSubjectId] = useState('primary-math-g4')
  const [adapters, setAdapters] = useState<Array<{ id: string; displayName: string; kind: string }>>([])
  const [watches, setWatches] = useState<WatchEntry[]>([])
  const [scanResult, setScanResult] = useState<unknown>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isDesktop()) return
    void window.desktop!.desktop.listAdapters().then(setAdapters)
    window.desktop!.desktop.onWatchIngested((entry) => {
      setWatches(prev => prev.map(w =>
        w.dir === dir && w.subjectId === subjectId ? { ...w, lastResult: entry } : w
      ))
    })
  }, [dir, subjectId])

  if (!isDesktop()) {
    return (
      <section className="xuexi-card bg-slate-50">
        <h2 className="font-semibold text-slate-800 mb-2">本地采集库</h2>
        <p className="text-sm text-slate-500">
          仅桌面端可用。当前在浏览器模式下，请通过 npm start 启动桌面应用。
        </p>
      </section>
    )
  }

  async function scan() {
    setErr(null)
    const r = await window.desktop!.desktop.collectDir(dir)
    if (!r.ok) {
      setErr(r.message ?? '未知错误')
      return
    }
    setScanResult(r)
  }

  async function startWatch() {
    setErr(null)
    const r = await window.desktop!.desktop.startWatch(dir, subjectId)
    if (!r.ok) {
      setErr('启动监听失败')
      return
    }
    setWatches(prev => [...prev.filter(w => !(w.dir === dir && w.subjectId === subjectId)), { dir, subjectId }])
  }

  async function stopWatch() {
    setErr(null)
    await window.desktop!.desktop.stopWatch(dir, subjectId)
    setWatches(prev => prev.filter(w => !(w.dir === dir && w.subjectId === subjectId)))
  }

  return (
    <section className="xuexi-card">
      <h2 className="font-semibold text-slate-800 mb-3">本地采集库</h2>
      <p className="text-xs text-slate-500 mb-3">
        把 .md / .json 讲义放进一个目录，下面填上这个目录的路径。点击"扫描"会抽取成知识点；
        点击"开始监听"后，目录内文件改动会自动入库。
      </p>

      <div className="grid md:grid-cols-3 gap-3 mb-3">
        <Field label="采集目录">
          <input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            placeholder="/Users/you/Documents/xuexi/sources/math"
            className="xuexi-input w-full"
          />
        </Field>
        <Field label="学科 ID">
          <input
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="xuexi-input w-full"
          />
        </Field>
        <Field label="已注册 Adapter">
          <div className="text-xs text-slate-700">
            {adapters.length === 0 ? '无' : adapters.map(a => (
              <span key={a.id} className="xuexi-pill bg-slate-100 text-slate-700 mr-1">{a.displayName}</span>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={scan} disabled={!dir} className="xuexi-btn xuexi-btn-ghost text-sm">扫描一次</button>
        <button onClick={startWatch} disabled={!dir} className="xuexi-btn xuexi-btn-primary text-sm">开始监听</button>
        <button onClick={stopWatch} disabled={!dir} className="xuexi-btn xuexi-btn-ghost text-sm">停止监听</button>
      </div>

      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {scanResult !== null && <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-3 overflow-auto">
        {JSON.stringify(scanResult, null, 2)}
      </pre>}
      {watches.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-slate-500 mb-1">活跃监听：</div>
          {watches.map((w, i) => (
            <div key={i} className="text-xs text-slate-700">
              • {w.dir} ({w.subjectId})
              {w.lastResult !== null && <span className="text-emerald-600 ml-2">已自动入库</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}