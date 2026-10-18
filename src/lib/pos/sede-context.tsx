"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
/** Marca por pestaña: sede ya elegida en este turno (sessionStorage). */
const CHOSEN_KEY = "pos.sedeElegida"

/** Devuelve la sede marcada solo si la marca es del usuario indicado. */
function readChosen(userId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(CHOSEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: string; sedeId?: string }
    return parsed.userId === userId && parsed.sedeId ? parsed.sedeId : null
  } catch {
    return null
  }
}

function writeChosen(mark: { userId: string; sedeId: string } | null) {
  try {
    if (mark) window.sessionStorage.setItem(CHOSEN_KEY, JSON.stringify(mark))
    else window.sessionStorage.removeItem(CHOSEN_KEY)
  } catch {
    // sessionStorage no disponible: la marca vive solo en memoria.
  }
}

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

  // Se compara por contenido: un arreglo nuevo con los mismos ids no re-ejecuta.
  const userSedeKey = (user?.sedeIds ?? []).join(",")
  const userSedeIds = useMemo(
    () => (userSedeKey ? userSedeKey.split(",") : []),
    [userSedeKey],
  )
  const userId = user?.id ?? ""
  const userIdRef = useRef("")
  const chosenRef = useRef(false)
  const sedeIdRef = useRef("")

  useEffect(() => {
    chosenRef.current = chosen
    sedeIdRef.current = sedeId
  }, [chosen, sedeId])

  // Cerrar sesión (transición de haber usuario a no haberlo) limpia la marca.
  // Mientras auth-context carga, user es null sin ser un cierre de sesión.
  useEffect(() => {
    if (!userId && userIdRef.current) writeChosen(null)
  }, [userId])

  useEffect(() => {
    // Otro usuario no hereda la elección del anterior.
    if (userIdRef.current && userIdRef.current !== userId) {
      chosenRef.current = false
      sedeIdRef.current = ""
    }
    userIdRef.current = userId
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
        const valid = (id: string | null | undefined): id is string =>
          !!id && mine.some((s) => s._id === id)
        const current = sedeIdRef.current
        const marker = readChosen(userId)
        // La sede ya elegida (en memoria o marca de la pestaña) se conserva
        // mientras siga siendo válida; solo si dejó de serlo se vuelve a pedir.
        const keepCurrent = chosenRef.current && valid(current)
        const keepMarker = !keepCurrent && valid(marker)
        const initial =
          (keepCurrent && current) ||
          (keepMarker && marker) ||
          (valid(stored) && stored) ||
          mine[0]?._id ||
          ""
        setSedeIdState(initial)
        // Solo se pide elegir cuando hay más de una sede.
        const isChosen = mine.length <= 1 || keepCurrent || keepMarker
        setChosen(isChosen)
        if (!isChosen) writeChosen(null)
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
  }, [userSedeIds, userId])

  function setSedeId(id: string) {
    setSedeIdState(id)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id)
    }
  }

  function chooseSede(id: string) {
    setSedeId(id)
    if (userId) writeChosen({ userId, sedeId: id })
    setChosen(true)
  }

  function changeSede() {
    writeChosen(null)
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
