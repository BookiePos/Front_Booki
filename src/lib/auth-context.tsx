"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  AuthUser,
  RegisterPayload,
  RegisterResponse,
  Tokens,
  apiLogin,
  apiLogout,
  apiMe,
  apiRefresh,
  apiRegister,
} from "@/lib/api"

const STORAGE_KEY = "sistemapos.auth"

type Status = "loading" | "authenticated" | "unauthenticated"

interface StoredAuth {
  tokens: Tokens
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  status: Status
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<RegisterResponse>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStored(): StoredAuth | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

function writeStored(value: StoredAuth | null): void {
  if (typeof window === "undefined") return
  if (value) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<Status>("loading")

  // Al montar: valida el token guardado; si venció, intenta refrescarlo.
  useEffect(() => {
    let active = true

    async function bootstrap(): Promise<void> {
      const stored = readStored()
      if (!stored) {
        if (active) setStatus("unauthenticated")
        return
      }
      try {
        const me = await apiMe(stored.tokens.accessToken)
        if (!active) return
        setUser(me)
        setStatus("authenticated")
      } catch {
        try {
          const tokens = await apiRefresh(stored.tokens.refreshToken)
          const me = await apiMe(tokens.accessToken)
          if (!active) return
          writeStored({ tokens, user: me })
          setUser(me)
          setStatus("authenticated")
        } catch {
          if (!active) return
          writeStored(null)
          setStatus("unauthenticated")
        }
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password)
    writeStored({ tokens: res.tokens, user: res.user })
    setUser(res.user)
    setStatus("authenticated")
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await apiRegister(payload)
    // Alta = auto-login: guarda la sesión igual que login().
    writeStored({ tokens: res.tokens, user: res.user })
    setUser(res.user)
    setStatus("authenticated")
    return res
  }, [])

  const logout = useCallback(async () => {
    const stored = readStored()
    if (stored) await apiLogout(stored.tokens.refreshToken)
    writeStored(null)
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  return (
    <AuthContext.Provider
      value={{ user, status, login, register, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  }
  return ctx
}
