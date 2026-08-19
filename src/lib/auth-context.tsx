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
  BusinessPlan,
  BusinessType,
  Entitlements,
  PlanFeature,
  RegisterPayload,
  RegisterResponse,
  Tokens,
  apiLogin,
  apiLogout,
  apiMe,
  apiRefresh,
  apiRegister,
} from "@/lib/api"
import { OPERATION_PERMISSIONS } from "@/lib/access"

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
  /** Plan comercial activo (undefined mientras carga o si el token es viejo). */
  plan: BusinessPlan | undefined
  /** Capacidades habilitadas por el plan (undefined si el token es viejo). */
  entitlements: Entitlements | undefined
  /**
   * ¿El plan incluye esta capacidad? Fail-open: si aún no hay `entitlements`
   * (sesión cargando o token viejo) devuelve `true` para no bloquear de más.
   */
  hasFeature: (feature: PlanFeature) => boolean
  /** Giro del negocio activo (undefined mientras carga o si el token es viejo). */
  tipoNegocio: BusinessType | undefined
  /** Atajo: el negocio es retail / tienda. */
  isRetail: boolean
  /** Atajo: el negocio es restaurante. */
  isRestaurant: boolean
  /** Puede entrar al punto de venta (/pos). */
  canUsePos: boolean
  /** Puede entrar a la Operación / back-office (/panel). */
  canUseOperation: boolean
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
          const tokens = await apiRefresh()
          const me = await apiMe(tokens.accessToken)
          if (!active) return
          writeStored({ tokens: { accessToken: tokens.accessToken }, user: me })
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
    // El refresh token queda en la cookie HttpOnly; solo persistimos el access.
    writeStored({ tokens: { accessToken: res.tokens.accessToken }, user: res.user })
    setUser(res.user)
    setStatus("authenticated")
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await apiRegister(payload)
    // Alta = auto-login: guarda la sesión igual que login().
    writeStored({ tokens: { accessToken: res.tokens.accessToken }, user: res.user })
    setUser(res.user)
    setStatus("authenticated")
    return res
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    writeStored(null)
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const hasFeature = useCallback(
    (feature: PlanFeature) => {
      // Fail-open: sin entitlements (token viejo o sesión cargando) no bloquea.
      if (!user?.entitlements) return true
      return user.entitlements.features.includes(feature)
    },
    [user],
  )

  const plan = user?.plan
  const entitlements = user?.entitlements
  const tipoNegocio = user?.tipoNegocio
  const permissions = user?.permissions ?? []
  const canUsePos = permissions.includes("pos.sell")
  const canUseOperation = OPERATION_PERMISSIONS.some((p) =>
    permissions.includes(p),
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        register,
        logout,
        hasPermission,
        plan,
        entitlements,
        hasFeature,
        tipoNegocio,
        isRetail: tipoNegocio === "retail",
        isRestaurant: tipoNegocio === "restaurante",
        canUsePos,
        canUseOperation,
      }}
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
