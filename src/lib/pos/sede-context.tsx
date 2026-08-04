"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/pos/api-inventory"

interface SedeContextValue {
  /** Sedes del trabajador (JWT ∩ sedes activas de la BD). */
  sedes: Sede[]
  sedeId: string
  sede: Sede | undefined
  setSedeId: (id: string) => void
  /** ¿Ya se eligió la sede de trabajo de esta sesión del POS? */
  chosen: boolean
  /** Elige la sede de trabajo y entra al POS. */
  chooseSede: (id: string) => void
  /** Vuelve a la pantalla de elección de sede. */
  changeSede: () => void
  loading: boolean
  error: string | null
}

const SedeContext = createContext<SedeContextValue | null>(null)

const STORAGE_KEY = "pos.sedeId"

/**
 * Carga las sedes del trabajador una sola vez y expone la sede activa a toda la
 * app POS, para que venta e inventario compartan la misma selección.
 */
export function SedeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeId, setSedeIdState] = useState("")
  // Al entrar al POS se elige la sede de trabajo. Con 0 o 1 sede no hay nada que
  // elegir, así que se da por elegida automáticamente.
  const [chosen, setChosen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userSedeIds = useMemo(() => user?.sedeIds ?? [], [user])

  useEffect(() => {
    let active = true
    setLoading(true)
    listSedes()
      .then((all) => {
        if (!active) return
        const mine = all.filter(
          (s) => s.active && userSedeIds.includes(s._id),
        )
        setSedes(mine)
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY)
            : null
        const initial =
          (stored && mine.some((s) => s._id === stored) && stored) ||
          mine[0]?._id ||
          ""
        setSedeIdState(initial)
        // Solo se pide elegir cuando hay más de una sede.
        setChosen(mine.length <= 1)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Error al cargar sedes"),
      )
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userSedeIds])

  function setSedeId(id: string) {
    setSedeIdState(id)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id)
    }
  }

  function chooseSede(id: string) {
    setSedeId(id)
    setChosen(true)
  }

  function changeSede() {
    setChosen(false)
  }

  const sede = sedes.find((s) => s._id === sedeId)

  return (
    <SedeContext.Provider
      value={{
        sedes,
        sedeId,
        sede,
        setSedeId,
        chosen,
        chooseSede,
        changeSede,
        loading,
        error,
      }}
    >
      {children}
    </SedeContext.Provider>
  )
}

export function useSede(): SedeContextValue {
  const ctx = useContext(SedeContext)
  if (!ctx) throw new Error("useSede debe usarse dentro de <SedeProvider>")
  return ctx
}
