import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { WeaknessPage } from './pages/WeaknessPage'
import { PlanPage } from './pages/PlanPage'
import { ChatPage } from './pages/ChatPage'
import { GraphPage } from './pages/GraphPage'
import { SettingsPage } from './pages/SettingsPage'
import { PracticePage } from './pages/PracticePage'

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const linkCls = (path: string) =>
    'px-3 py-1.5 rounded-lg text-sm transition ' +
    (loc.pathname === path
      ? 'bg-brand-600 text-white'
      : 'text-slate-600 hover:bg-slate-100')
  return (
    <div className="min-h-full">
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-bold text-lg text-brand-700">
            📚 xuexi
          </Link>
          {user && (
            <nav className="flex items-center gap-1">
              <Link to="/" className={linkCls('/')}>
                仪表盘
              </Link>
              <Link to="/weakness" className={linkCls('/weakness')}>
                薄弱点
              </Link>
              <Link to="/plan" className={linkCls('/plan')}>
                计划
              </Link>
              <Link to="/chat" className={linkCls('/chat')}>
                AI 对话
              </Link>
              <Link to="/graph" className={linkCls('/graph')}>
                知识图谱
              </Link>
              <Link to="/practice" className={linkCls('/practice')}>
                练习
              </Link>
              <Link to="/settings" className={linkCls('/settings')}>
                设置
              </Link>
            </nav>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user.displayName}
              <span className="xuexi-pill bg-brand-100 text-brand-700 ml-2">
                {user.role === 'primary_school' ? '小学生' : '软考'}
              </span>
            </span>
            <button onClick={logout} className="xuexi-btn xuexi-btn-ghost text-xs">
              切换
            </button>
          </div>
        )}
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  )
}

export function App() {
  const { user } = useAuth()
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/weakness" element={<WeaknessPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
