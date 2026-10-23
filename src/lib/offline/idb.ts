/**
 * IndexedDB mínimo del modo sin conexión (ítem 6.3).
 *
 * Una base POR EMPRESA Y USUARIO (`bookipos-offline:<empresa>:<usuario>`): lo
 * que guarda un cajero nunca lo lee otro usuario ni otra empresa en el mismo
 * navegador. Los nombres abiertos se anotan en `localStorage` para poder
 * borrarlos todos al cerrar sesión, también en navegadores sin
 * `indexedDB.databases()`.
 */

export const DB_PREFIX = "bookipos-offline:"
const REGISTRO_KEY = "bookipos.offline.dbs"
const VERSION = 1

/** Almacenes de la base. */
export const STORES = {
  /** Copias de lectura: catálogo, turno y sedes. Llave `<tipo>:<sede>`. */
  snapshots: "snapshots",
  /** Bloque de consecutivos reservado. Llave = sedeId. */
  reservas: "reservas",
  /** Ventas cobradas sin red. Llave = offlineId (UUID). */
  cola: "cola",
} as const
export type StoreName = (typeof STORES)[keyof typeof STORES]

export interface Alcance {
  businessId: string
  userId: string
}

export function dbName(a: Alcance): string {
  return `${DB_PREFIX}${a.businessId}:${a.userId}`
}

function leerRegistro(): string[] {
  try {
    const raw = window.localStorage.getItem(REGISTRO_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function anotar(nombre: string) {
  try {
    const actual = leerRegistro()
    if (!actual.includes(nombre)) {
      window.localStorage.setItem(REGISTRO_KEY, JSON.stringify([...actual, nombre]))
    }
  } catch {
    /* sin localStorage: el borrado cae en indexedDB.databases() */
  }
}

export function hayIndexedDb(): boolean {
  return typeof indexedDB !== "undefined"
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

const abiertas = new Map<string, Promise<IDBDatabase>>()

export function abrir(a: Alcance): Promise<IDBDatabase> {
  const nombre = dbName(a)
  const hit = abiertas.get(nombre)
  if (hit) return hit
  anotar(nombre)
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(nombre, VERSION)
    r.onupgradeneeded = () => {
      const db = r.result
      for (const s of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
      }
    }
    r.onsuccess = () => {
      const db = r.result
      // Si otra pestaña borra la base (cierre de sesión), se suelta la conexión.
      db.onversionchange = () => {
        db.close()
        abiertas.delete(nombre)
      }
      resolve(db)
    }
    r.onerror = () => reject(r.error)
  })
  abiertas.set(nombre, p)
  p.catch(() => abiertas.delete(nombre))
  return p
}

export async function leer<T>(a: Alcance, store: StoreName, key: string): Promise<T | undefined> {
  const db = await abrir(a)
  return req(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>
}

export async function escribir<T>(a: Alcance, store: StoreName, key: string, value: T): Promise<void> {
  const db = await abrir(a)
  const tx = db.transaction(store, "readwrite")
  tx.objectStore(store).put(value, key)
  await fin(tx)
}

export async function borrar(a: Alcance, store: StoreName, key: string): Promise<void> {
  const db = await abrir(a)
  const tx = db.transaction(store, "readwrite")
  tx.objectStore(store).delete(key)
  await fin(tx)
}

export async function todos<T>(a: Alcance, store: StoreName): Promise<T[]> {
  const db = await abrir(a)
  return req(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>
}

/**
 * Corre `fn` en UNA transacción de lectura-escritura sobre `stores`. IndexedDB
 * serializa las transacciones que se cruzan, también entre pestañas: es lo que
 * hace atómico tomar un número del bloque y encolar la venta.
 */
export async function transaccion<T>(
  a: Alcance,
  stores: StoreName[],
  fn: (tx: IDBTransaction, get: <V>(s: StoreName, k: string) => Promise<V | undefined>) => Promise<T>,
): Promise<T> {
  const db = await abrir(a)
  const tx = db.transaction(stores, "readwrite")
  const get = <V,>(s: StoreName, k: string) =>
    req(tx.objectStore(s).get(k)) as Promise<V | undefined>
  let resultado: T
  let fallo: unknown
  try {
    resultado = await fn(tx, get)
  } catch (err) {
    fallo = err
    try {
      tx.abort()
    } catch {
      /* ya terminada */
    }
  }
  if (fallo !== undefined) {
    await fin(tx).catch(() => undefined)
    throw fallo
  }
  await fin(tx)
  return resultado!
}

function fin(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("Transacción abortada"))
  })
}

/** Nombres de todas las bases offline de este navegador. */
async function basesOffline(): Promise<Set<string>> {
  const nombres = new Set(leerRegistro())
  try {
    const dbs = (await indexedDB.databases?.()) ?? []
    for (const d of dbs) if (d.name?.startsWith(DB_PREFIX)) nombres.add(d.name)
  } catch {
    /* navegador sin databases(): basta el registro */
  }
  return nombres
}

/** Abre una base por nombre (sin crearla ni anotarla) y corre `fn`. */
function conBase<T>(nombre: string, fn: (db: IDBDatabase) => Promise<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    const r = indexedDB.open(nombre)
    r.onupgradeneeded = () => {
      // No existía: no hay nada que leer. Se aborta para no dejarla creada.
      r.transaction?.abort()
    }
    r.onerror = () => resolve(undefined)
    r.onsuccess = () => {
      const db = r.result
      fn(db)
        .then(resolve, () => resolve(undefined))
        .finally(() => db.close())
    }
  })
}

/** Ventas cobradas sin red que siguen sin registrar, de todas las sesiones de este equipo. */
export async function ventasSinSincronizar(): Promise<number> {
  if (!hayIndexedDb()) return 0
  let total = 0
  for (const nombre of await basesOffline()) {
    const n = await conBase(nombre, async (db) => {
      if (!db.objectStoreNames.contains(STORES.cola)) return 0
      return req(db.transaction(STORES.cola).objectStore(STORES.cola).count())
    })
    total += n ?? 0
  }
  return total
}

/**
 * Cierre de sesión: borra las copias de lectura (catálogo, turno, sedes) y los
 * bloques de consecutivos de TODAS las bases offline de este navegador, pero
 * NUNCA las ventas en cola o en conflicto. Son efectivo que ya entró al cajón;
 * borrarlas descuadra la caja. La base es por empresa y usuario, así que solo
 * las ve y las sincroniza quien las cobró cuando vuelva a entrar. Una base sin
 * ventas se elimina entera.
 */
export async function limpiarAlCerrarSesion(): Promise<void> {
  if (!hayIndexedDb()) return
  for (const [nombre, p] of abiertas) {
    abiertas.delete(nombre)
    void p.then((db) => db.close()).catch(() => undefined)
  }
  const conVentas: string[] = []
  for (const nombre of await basesOffline()) {
    const quedan = await conBase(nombre, async (db) => {
      const stores = [STORES.snapshots, STORES.reservas].filter((s) =>
        db.objectStoreNames.contains(s),
      )
      if (stores.length > 0) {
        const tx = db.transaction(stores, "readwrite")
        for (const s of stores) tx.objectStore(s).clear()
        await fin(tx)
      }
      if (!db.objectStoreNames.contains(STORES.cola)) return 0
      return req(db.transaction(STORES.cola).objectStore(STORES.cola).count())
    })
    if (quedan && quedan > 0) conVentas.push(nombre)
    else await eliminarBase(nombre)
  }
  try {
    if (conVentas.length > 0) {
      window.localStorage.setItem(REGISTRO_KEY, JSON.stringify(conVentas))
    } else {
      window.localStorage.removeItem(REGISTRO_KEY)
    }
  } catch {
    /* nada */
  }
}

function eliminarBase(n: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(n)
    r.onsuccess = r.onerror = r.onblocked = () => resolve()
  })
}

/**
 * Borra TODAS las bases offline de este navegador, ventas incluidas. Solo para
 * pruebas y soporte: el cierre de sesión usa `limpiarAlCerrarSesion`.
 */
export async function borrarTodo(): Promise<void> {
  if (!hayIndexedDb()) return
  const nombres = await basesOffline()
  for (const [nombre, p] of abiertas) {
    abiertas.delete(nombre)
    void p.then((db) => db.close()).catch(() => undefined)
  }
  await Promise.all(
    [...nombres].map(
      (n) =>
        new Promise<void>((resolve) => {
          const r = indexedDB.deleteDatabase(n)
          r.onsuccess = r.onerror = r.onblocked = () => resolve()
        }),
    ),
  )
  try {
    window.localStorage.removeItem(REGISTRO_KEY)
  } catch {
    /* nada */
  }
}
