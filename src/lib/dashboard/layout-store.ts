import type { LayoutItem } from "./types"

/** El layout del tablero se guarda por usuario en localStorage. */
const KEY_PREFIX = "gocheck.dashboard."

export function readLayout(userId: string): LayoutItem[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (x): x is LayoutItem =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as LayoutItem).id === "string" &&
        typeof (x as LayoutItem).size === "string",
    )
  } catch {
    return null
  }
}

export function writeLayout(userId: string, layout: LayoutItem[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(layout))
  } catch {
    // localStorage lleno o bloqueado: la personalización no es crítica.
  }
}
