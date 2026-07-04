import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { RoleType } from '@xuexi/shared'

interface AuthState {
  userId: string
  displayName: string
  role: RoleType
}

interface AuthContextValue {
  user: AuthState | null
  login: (user: AuthState) => void
  logout: () => void
}

const KEY = 'xuexi.auth.v1'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const login = useCallback((u: AuthState) => {
    setUser(u)
    localStorage.setItem(KEY, JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(KEY)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
