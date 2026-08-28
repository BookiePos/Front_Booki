/**
 * Tema del producto (claro / oscuro / sistema).
 *
 * El modo elegido se guarda en localStorage con el prefijo `bookipos.` que usa
 * el resto de la app (ver `lib/dashboard/layout-store.ts`). Es una preferencia
 * del dispositivo, no del usuario de negocio: quien trabaja de noche en una
 * caja quiere la pantalla oscura ahí, aunque en su portátil la prefiera clara.
 * Por eso no se cuelga del `userId`.
 */

/** Modo elegido por la persona. "system" sigue al sistema operativo. */
export type ThemeMode = "light" | "dark" | "system"

/** Tema realmente pintado. "system" ya está resuelto a uno de los dos. */
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "bookipos.theme"

/** Clase que activa el tema oscuro (ver `@custom-variant dark` en globals.css). */
export const DARK_CLASS = "dark"

const MODES: readonly ThemeMode[] = ["light", "dark", "system"]

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value)
}

/** Lee el modo guardado. Devuelve "system" si no hay nada o está corrupto. */
export function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system"
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(raw) ? raw : "system"
  } catch {
    // Modo incógnito o almacenamiento bloqueado: el tema no es crítico.
    return "system"
  }
}

export function writeThemeMode(mode: ThemeMode): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Si no se puede persistir, el tema vale para esta sesión y ya.
  }
}

/** ¿El sistema operativo pide oscuro ahora mismo? */
export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? systemTheme() : mode
}

/** Color de la barra del navegador para cada tema (mismos valores que el CSS). */
const BROWSER_CHROME: Record<ResolvedTheme, string> = {
  light: "#f9f5fd",
  dark: "#00081c",
}

/**
 * Sincroniza las metaetiquetas `theme-color`.
 *
 * El layout declara dos, una por `prefers-color-scheme`. Eso acierta mientras
 * el modo es "system", pero en cuanto alguien elige oscuro con el sistema en
 * claro el navegador sigue pintando su barra clara y queda una franja que no
 * pega con nada. Se le escribe el color resuelto a las dos: así da igual cuál
 * de las dos consultas case, el resultado es el mismo.
 */
function syncBrowserChrome(resolved: ResolvedTheme): void {
  const color = BROWSER_CHROME[resolved]
  const tags = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  tags.forEach((tag) => tag.setAttribute("content", color))
}

/**
 * Pinta el tema en el <html>. La clase la lee Tailwind (`dark:`) y el atributo
 * `data-theme-mode` deja el modo elegido visible para el script inline y para
 * depurar desde el inspector.
 */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode)
  if (typeof document === "undefined") return resolved
  const root = document.documentElement
  root.classList.toggle(DARK_CLASS, resolved === "dark")
  root.dataset.themeMode = mode
  syncBrowserChrome(resolved)
  return resolved
}

/**
 * Script anti-FOUC. Corre bloqueante en el <head>, antes del primer paint: si
 * la clase `dark` se pusiera en un `useEffect`, quien elige oscuro vería un
 * fogonazo blanco en cada carga (la página es estática y el HTML llega claro).
 *
 * Va minificado a mano y sin dependencias porque se inyecta tal cual en el
 * documento; cualquier fallo aquí bloquea la página, de ahí el try/catch.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var m=null;try{m=localStorage.getItem(k)}catch(e){}if(m!=="light"&&m!=="dark"&&m!=="system"){m="system"}var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle(${JSON.stringify(
  DARK_CLASS,
)},d);r.setAttribute("data-theme-mode",m)}catch(e){}})()`

/* ============================================================
   Almacén externo para `useSyncExternalStore`.

   El tema vive fuera de React —en localStorage y en el <html>—, así que el
   provider lo trata como lo que es: una fuente externa a la que se suscribe.
   Leerlo con un `useState` + `useEffect` obligaba a un setState dentro del
   efecto, que dispara un render en cascada en cada carga (y que la regla
   react-hooks/set-state-in-effect marca con razón).
   ============================================================ */

type Listener = () => void

const listeners = new Set<Listener>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

/** Otra pestaña cambió el tema: esta se pone al día sin recargar. */
function onStorageEvent(event: StorageEvent): void {
  if (event.key !== THEME_STORAGE_KEY) return
  applyTheme(readThemeMode())
  emit()
}

/** Suscripción al modo elegido (cambios locales y de otras pestañas). */
export function subscribeThemeMode(listener: Listener): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorageEvent)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorageEvent)
    }
  }
}

/**
 * En el servidor no hay preferencia que leer, así que se renderiza como
 * "system". React vuelve a pintar con el valor real justo después de hidratar,
 * sin discrepancia de marcado: para eso existe el snapshot de servidor.
 */
export function getServerThemeMode(): ThemeMode {
  return "system"
}

/** Suscripción a `prefers-color-scheme`, para el modo "system". */
export function subscribeSystemTheme(listener: Listener): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const query = window.matchMedia("(prefers-color-scheme: dark)")
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

export function getServerSystemTheme(): ResolvedTheme {
  return "light"
}

/** Guarda el modo, lo pinta y avisa a los suscriptores. */
export function setStoredThemeMode(mode: ThemeMode): void {
  writeThemeMode(mode)
  applyTheme(mode)
  emit()
}
