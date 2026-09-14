"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Search,
  Loader2,
  Package,
  Boxes,
  Receipt,
  UserRound,
  ClipboardList,
  CornerDownLeft,
  X,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import { navItems } from "@/lib/pos/navigation"
import { coincide, pedirBusqueda, type PedidoBusqueda } from "@/lib/pos/busqueda"
import {
  posProducts,
  listSales,
  listOrders,
  type PosProduct,
  type Sale,
  type Order,
} from "@/lib/pos/api-sales"
import { getStock, type StockRow } from "@/lib/pos/api-inventory"
import { listCustomers, type Customer } from "@/lib/pos/api-customers"
import { money, qty as fmtQty } from "@/lib/pos/format"
import { cn } from "@/lib/utils"

/**
 * Buscador de todo el terminal, en la barra de arriba.
 *
 * Se escribe una palabra —"galleta", "Laura", "FV-000123", "domicilio"— y
 * aparece TODO lo del punto de venta donde sale: la pantalla que se llama así,
 * el producto para vender, sus existencias, las ventas que lo llevan, el
 * cliente y la mesa abierta. Tocar un resultado lleva a esa pantalla ya
 * filtrada.
 *
 * Carga los datos al abrirse y no antes: el terminal abre muchas veces al día
 * y casi nunca se busca, así que pedirlo todo de entrada sería gastar datos en
 * cada venta.
 */

/**
 * Palabras con las que la gente llama a cada pantalla. Nadie busca "Caja":
 * busca "cuadre", "cerrar turno" o "sangría".
 */
const PALABRAS_SECCION: Record<string, string> = {
  "/pos": "vender venta cobrar carrito registrar mostrador",
  "/pos/ventas":
    "historial ventas recibos facturas devolucion devolver anular reimprimir vendedor",
  "/pos/domicilios": "domicilios entregas repartidor mensajero envios pedidos",
  "/pos/caja":
    "caja abrir cerrar cuadre arqueo efectivo sangria turno base gastos",
  "/pos/inventario":
    "inventario existencias stock bodega ajustar vencidos lotes empaque bolsas",
  "/pos/nomina": "nomina colilla pago empleados asistencia turnos",
  "/pos/facturacion": "factura electronica dian",
}

/** Cuántos resultados por grupo antes de "ver todos". */
const POR_GRUPO = 5

/** Datos viejos de más de un minuto se vuelven a pedir al abrir. */
const VIGENCIA_MS = 60_000

interface Resultado {
  clave: string
  icono: React.ElementType
  titulo: string
  detalle?: string
  derecha?: string
  pedido: PedidoBusqueda
}

interface Grupo {
  titulo: string
  resultados: Resultado[]
  /** Cuántos coincidieron en total, para el "ver los N". */
  total: number
  /** A dónde lleva "ver todos". Sin esto, el grupo no lo ofrece. */
  verTodos?: PedidoBusqueda
}

interface Datos {
  productos: PosProduct[]
  existencias: StockRow[]
  ventas: Sale[]
  clientes: Customer[]
  cuentas: Order[]
}

const VACIO: Datos = {
  productos: [],
  existencias: [],
  ventas: [],
  clientes: [],
  cuentas: [],
}

/** Resultados del grupo más, si no caben todos, la fila "ver los N". */
function filasDe(g: Grupo): Resultado[] {
  if (!g.verTodos || g.total <= g.resultados.length) return g.resultados
  return [
    ...g.resultados,
    {
      clave: `todos-${g.titulo}`,
      icono: Search,
      titulo: `Ver los ${g.total} de «${g.titulo}»`,
      pedido: g.verTodos,
    },
  ]
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  })
}

export function PosSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const { hasPermission } = useAuth()
  const { sedeId } = useSede()

  const [abierto, setAbierto] = React.useState(false)
  const [consulta, setConsulta] = React.useState("")
  const [datos, setDatos] = React.useState<Datos>(VACIO)
  const [cargando, setCargando] = React.useState(false)
  const [activo, setActivo] = React.useState(0)
  const cargadoEn = React.useRef<{ sede: string; en: number } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listaRef = React.useRef<HTMLDivElement>(null)

  const puedeInventario = hasPermission("inventory.view")
  const puedeClientes = hasPermission("customers.view")

  // Ctrl+K (o ⌘K) abre el buscador desde cualquier pantalla del terminal.
  React.useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setAbierto(true)
      }
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [])

  // Al abrir: foco en la casilla y datos frescos. Cada fuente va por su lado —
  // si falla una (p. ej. sin permiso de inventario), las demás igual aparecen.
  React.useEffect(() => {
    if (!abierto || !sedeId) return
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !sedeId) return
      inputRef.current?.focus()
      const previo = cargadoEn.current
      if (previo && previo.sede === sedeId && Date.now() - previo.en < VIGENCIA_MS) {
        return
      }
      setCargando(true)
      const [productos, existencias, ventas, clientes, cuentas] =
        await Promise.allSettled([
          posProducts(sedeId),
          puedeInventario ? getStock(sedeId) : Promise.resolve([]),
          // 100 es el máximo que entrega el servidor por página.
          listSales(sedeId, 1, 100).then((p) => p.rows),
          puedeClientes ? listCustomers() : Promise.resolve([]),
          listOrders(sedeId, "open"),
        ])
      if (!vivo) return
      const valor = <T,>(r: PromiseSettledResult<T[]>): T[] =>
        r.status === "fulfilled" ? r.value : []
      setDatos({
        productos: valor(productos),
        existencias: valor(existencias),
        ventas: valor(ventas),
        clientes: valor(clientes),
        cuentas: valor(cuentas),
      })
      cargadoEn.current = { sede: sedeId, en: Date.now() }
      setCargando(false)
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [abierto, sedeId, puedeInventario, puedeClientes])

  const cerrar = React.useCallback(() => {
    setAbierto(false)
    setConsulta("")
    setActivo(0)
  }, [])

  const grupos = React.useMemo<Grupo[]>(() => {
    const q = consulta.trim()
    if (!q) return []
    const out: Grupo[] = []

    // Pantallas del terminal, solo las que esta persona puede abrir.
    const secciones = navItems
      .filter((n) => !n.permission || hasPermission(n.permission))
      .filter((n) => coincide(q, n.title, PALABRAS_SECCION[n.href]))
    const extras: Resultado[] = []
    if (coincide(q, "cuentas abiertas mesas comandas")) {
      extras.push({
        clave: "sec-cuentas",
        icono: ClipboardList,
        titulo: "Cuentas abiertas",
        detalle: "Mesas y comandas sin cobrar",
        pedido: { href: "/pos", termino: "", verCuentas: true },
      })
    }
    if (secciones.length + extras.length > 0) {
      const lista = [
        ...secciones.map<Resultado>((n) => ({
          clave: `sec-${n.href}`,
          icono: n.icon,
          titulo: n.title,
          detalle: "Ir a la pantalla",
          pedido: { href: n.href, termino: "" },
        })),
        ...extras,
      ]
      out.push({ titulo: "Pantallas", resultados: lista, total: lista.length })
    }

    const productos = datos.productos.filter((p) =>
      coincide(q, p.name, p.sku, p.barcode, p.categoryName, p.variantGroupName),
    )
    if (productos.length > 0) {
      out.push({
        titulo: "Para vender",
        total: productos.length,
        verTodos: { href: "/pos", termino: q },
        resultados: productos.slice(0, POR_GRUPO).map((p) => ({
          clave: `prod-${p._id}`,
          icono: Package,
          titulo: p.name,
          detalle:
            p.stock <= 0 ? "Agotado" : `${fmtQty(p.stock)} disponibles · Venta`,
          derecha: money(p.salePrice),
          pedido: { href: "/pos", termino: p.name },
        })),
      })
    }

    const existencias = datos.existencias.filter((r) =>
      coincide(q, r.product.name, r.product.sku, r.product.barcode),
    )
    if (existencias.length > 0) {
      out.push({
        titulo: "En inventario",
        total: existencias.length,
        verTodos: { href: "/pos/inventario", termino: q },
        resultados: existencias.slice(0, POR_GRUPO).map((r) => ({
          clave: `inv-${r.id}`,
          icono: Boxes,
          titulo: r.product.name,
          detalle: `${r.product.sku} · Inventario`,
          derecha: `${fmtQty(r.qty)} ${r.product.unit}`,
          pedido: { href: "/pos/inventario", termino: r.product.name },
        })),
      })
    }

    const cuentas = datos.cuentas.filter((o) =>
      coincide(q, o.label, o.orderNumber, ...o.lines.map((l) => l.name)),
    )
    if (cuentas.length > 0) {
      out.push({
        titulo: "Cuentas abiertas",
        total: cuentas.length,
        resultados: cuentas.slice(0, POR_GRUPO).map((o) => ({
          clave: `cta-${o._id}`,
          icono: ClipboardList,
          titulo: o.label || o.orderNumber,
          detalle: `${o.lines.length} ítem(s) · abrir la cuenta`,
          pedido: { href: "/pos", termino: "", cuentaId: o._id },
        })),
      })
    }

    const ventas = datos.ventas.filter((s) =>
      coincide(
        q,
        s.saleNumber,
        s.customer?.name,
        s.customer?.idNumber,
        s.seller?.name,
        s.cashierName,
        ...s.lines.map((l) => l.name),
      ),
    )
    if (ventas.length > 0) {
      out.push({
        titulo: "Ventas",
        total: ventas.length,
        verTodos: { href: "/pos/ventas", termino: q },
        resultados: ventas.slice(0, POR_GRUPO).map((s) => ({
          clave: `vta-${s._id}`,
          icono: Receipt,
          titulo: s.saleNumber,
          detalle: [
            fechaCorta(s.createdAt),
            s.customer?.name,
            s.seller?.name ? `vendió ${s.seller.name}` : undefined,
            s.status === "void" ? "anulada" : undefined,
          ]
            .filter(Boolean)
            .join(" · "),
          derecha: money(s.total),
          pedido: { href: "/pos/ventas", termino: s.saleNumber },
        })),
      })
    }

    const clientes = datos.clientes.filter((c) =>
      coincide(q, c.name, c.docNumber, c.phone),
    )
    if (clientes.length > 0) {
      out.push({
        titulo: "Clientes",
        total: clientes.length,
        resultados: clientes.slice(0, POR_GRUPO).map((c) => ({
          clave: `cli-${c._id}`,
          icono: UserRound,
          titulo: c.name,
          detalle: `${c.docType} ${c.docNumber} · ver sus compras`,
          pedido: { href: "/pos/ventas", termino: c.name },
        })),
      })
    }

    return out
  }, [consulta, datos, hasPermission])

  /** Lista plana, en el orden en que se ve, para moverse con las flechas. */
  const planos = React.useMemo(() => grupos.flatMap(filasDe), [grupos])

  function ir(pedido: PedidoBusqueda) {
    cerrar()
    // Primero el pedido y después la navegación: si la pantalla ya está
    // abierta lo recoge con el aviso; si no, al montarse.
    pedirBusqueda(pedido)
    if (pathname !== pedido.href) router.push(pedido.href)
  }

  function alTeclearCasilla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActivo((i) => Math.min(i + 1, Math.max(planos.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const elegido = planos[activo]
      if (elegido) ir(elegido.pedido)
    } else if (e.key === "Escape") {
      e.preventDefault()
      cerrar()
    }
  }

  // Mantiene visible el resultado marcado al moverse con las flechas.
  React.useEffect(() => {
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activo])

  let indice = -1

  return (
    <>
      <button
        type="button"
        data-tour="pos-buscador"
        onClick={() => setAbierto(true)}
        aria-label="Buscar en todo el punto de venta"
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-muted/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Buscar productos, ventas, clientes…</span>
        <kbd className="ml-auto hidden rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] lg:inline">
          Ctrl K
        </kbd>
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Buscar en el punto de venta"
          className="fixed inset-0 z-[55] flex items-start justify-center bg-brand-950/45 p-4 pt-[8svh] backdrop-blur-sm dark:bg-navy-950/70"
          onClick={cerrar}
        >
          {/* `svh` y no `vh`: con `vh` el buscador se sale por abajo justo
              cuando aparece el teclado del celular, que es el momento en que se
              está escribiendo. La casilla no encoge nunca y la lista es la que
              scrollea. */}
          <div
            className="flex max-h-[80svh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={consulta}
                onChange={(e) => {
                  setConsulta(e.target.value)
                  setActivo(0)
                }}
                onKeyDown={alTeclearCasilla}
                placeholder="Escribe una palabra: galleta, Laura, FV-000123, caja…"
                aria-label="Qué buscas"
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              {cargando && (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              )}
              <button
                type="button"
                aria-label="Cerrar el buscador"
                onClick={cerrar}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div
              ref={listaRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
            >
              {!consulta.trim() ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Busca en todo el punto de venta a la vez: productos,
                  existencias, ventas, clientes, cuentas abiertas y pantallas.
                </p>
              ) : grupos.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {cargando
                    ? "Buscando…"
                    : `Nada con «${consulta.trim()}» en esta sede.`}
                </p>
              ) : (
                grupos.map((g) => (
                  <div key={g.titulo} className="mb-2 last:mb-0">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.titulo}
                      <span className="ml-1 font-normal normal-case">
                        · {g.total}
                      </span>
                    </p>
                    {filasDe(g).map((r) => {
                      indice += 1
                      const i = indice
                      const Icono = r.icono
                      return (
                        <button
                          key={r.clave}
                          type="button"
                          data-indice={i}
                          onMouseEnter={() => setActivo(i)}
                          onClick={() => ir(r.pedido)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            i === activo
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icono className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {r.titulo}
                            </span>
                            {r.detalle && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {r.detalle}
                              </span>
                            )}
                          </span>
                          {r.derecha && (
                            <span className="shrink-0 text-sm tabular-nums">
                              {r.derecha}
                            </span>
                          )}
                          {i === activo && (
                            <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
