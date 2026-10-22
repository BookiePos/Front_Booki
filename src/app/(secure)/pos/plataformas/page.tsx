"use client"

import * as React from "react"
import { Loader2, ShieldOff, Upload, Plus, Minus, Trash2, Smartphone } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import { posProducts, type PosProduct } from "@/lib/pos/api-sales"
import {
  PLATFORM_CODES,
  PLATFORM_LABELS,
  createPlatformOrder,
  createPlatformSettlement,
  getPlatformSummary,
  importPlatformOrders,
  listPlatformOrders,
  listPlatformSettlements,
  previewPlatformImport,
  settlementProblem,
  voidPlatformSettlement,
  type ImportResult,
  type PlatformCode,
  type PlatformOrderRow,
  type PlatformSettlement,
  type PlatformSummary,
  type PreviewResult,
} from "@/lib/pos/api-platform"
import { money } from "@/lib/pos/format"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, NativeSelect } from "@/components/ui/field"
import { MoneyInput } from "@/components/ui/money-input"
import { FormAlert } from "@/components/ui/form-dialog"
import { Segmented } from "@/components/ui/segmented"
import { useConfirm } from "@/components/ui/confirm-dialog"

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperado"
}

const PLATFORM_OPTIONS = PLATFORM_CODES.map((c) => ({ value: c, label: PLATFORM_LABELS[c] }))

type Vista = "registrar" | "importar" | "cobrar"

/**
 * Pedidos de plataformas de domicilio (Rappi, DiDi Food, Uber Eats).
 *
 * No hay integración con sus APIs (exigen convenio de partner): el pedido se
 * registra aquí, a mano o desde el CSV del portal de aliados. La plataforma
 * cobra al cliente y le consigna al negocio después, así que cada pedido queda
 * como «por cobrar» a la plataforma —no entra a la caja ni al arqueo— hasta que
 * se registra la liquidación, que es donde se anota la comisión.
 */
export default function PlataformasPage() {
  const { hasPermission } = useAuth()
  const canSell = hasPermission("pos.sell")
  const canFinance = hasPermission("finance.view")
  const [vista, setVista] = React.useState<Vista>("registrar")

  if (!canSell) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldOff className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No tienes permiso para registrar pedidos de plataformas.
          </p>
        </CardContent>
      </Card>
    )
  }

  const options = [
    { value: "registrar", label: "Registrar pedido" },
    { value: "importar", label: "Importar CSV" },
    ...(canFinance ? [{ value: "cobrar", label: "Por cobrar" }] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Pedidos de plataformas</h1>
        <p className="text-sm text-muted-foreground">
          Rappi, DiDi Food, Uber Eats… La plataforma te debe lo vendido hasta que consigne.
        </p>
      </div>
      <Segmented
        fill
        ariaLabel="Qué quieres hacer"
        value={vista}
        onValueChange={(v) => setVista(v as Vista)}
        options={options}
      />
      {vista === "registrar" && <RegistrarPedido />}
      {vista === "importar" && <ImportarCsv />}
      {vista === "cobrar" && canFinance && <PorCobrar />}
    </div>
  )
}

// ─── Registro manual ─────────────────────────────────────────────────────────

function RegistrarPedido() {
  const { sedeId } = useSede()
  const [productos, setProductos] = React.useState<PosProduct[]>([])
  const [plataforma, setPlataforma] = React.useState<PlatformCode>("rappi")
  const [codigo, setCodigo] = React.useState("")
  const [comision, setComision] = React.useState<number | null>(null)
  const [busqueda, setBusqueda] = React.useState("")
  const [carrito, setCarrito] = React.useState<Record<string, number>>({})
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)

  React.useEffect(() => {
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      if (!sedeId) return
      try {
        const lista = await posProducts(sedeId)
        if (vivo) setProductos(lista)
      } catch (err) {
        if (vivo) setError(errorMessage(err))
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [sedeId])

  const porId = React.useMemo(() => new Map(productos.map((p) => [p._id, p])), [productos])
  const lineas = Object.entries(carrito).filter(([, q]) => q > 0)
  const total = lineas.reduce((a, [id, q]) => a + (porId.get(id)?.salePrice ?? 0) * q, 0)
  const filtrados = busqueda.trim()
    ? productos
        .filter((p) =>
          `${p.name} ${p.sku}`.toLowerCase().includes(busqueda.trim().toLowerCase()),
        )
        .slice(0, 8)
    : []

  function cambiar(id: string, delta: number) {
    setCarrito((c) => {
      const q = Math.max((c[id] ?? 0) + delta, 0)
      const { [id]: _quitado, ...resto } = c
      void _quitado
      return q > 0 ? { ...resto, [id]: q } : resto
    })
  }

  async function registrar() {
    if (!sedeId) return
    setGuardando(true)
    setError(null)
    setOk(null)
    try {
      const venta = await createPlatformOrder({
        sedeId,
        platform: plataforma,
        externalId: codigo,
        lines: lineas.map(([productId, qty]) => ({ productId, qty })),
        commissionEstimate: comision ?? undefined,
      })
      setOk(`Pedido ${codigo.trim()} registrado como ${venta.saleNumber}.`)
      setCodigo("")
      setComision(null)
      setCarrito({})
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  const listo = codigo.trim().length > 0 && lineas.length > 0 && !guardando

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        {error && <FormAlert>{error}</FormAlert>}
        {ok && <FormAlert tone="success">{ok}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="pl-plataforma" label="Plataforma">
            <NativeSelect
              id="pl-plataforma"
              value={plataforma}
              onChange={(v) => setPlataforma(v as PlatformCode)}
              options={PLATFORM_OPTIONS}
            />
          </Field>
          <Field id="pl-codigo" label="Código del pedido" hint="El que muestra el portal. No se puede repetir.">
            <Input
              id="pl-codigo"
              value={codigo}
              maxLength={80}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </Field>
          <Field id="pl-comision" label="Comisión estimada" hint="Opcional. La real se anota al liquidar.">
            <MoneyInput id="pl-comision" value={comision} onValueChange={setComision} />
          </Field>
        </div>

        <Field id="pl-buscar" label="Agregar producto">
          <Input
            id="pl-buscar"
            placeholder="Nombre o SKU"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Field>
        {filtrados.length > 0 && (
          <ul className="flex flex-col gap-1">
            {filtrados.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    cambiar(p._id, 1)
                    setBusqueda("")
                  }}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="tnum text-muted-foreground">{money(p.salePrice)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {lineas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {lineas.map(([id, qty]) => {
              const p = porId.get(id)
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p?.name ?? id}</span>
                  <Button size="icon" variant="outline" aria-label="Quitar uno" onClick={() => cambiar(id, -1)}>
                    <Minus />
                  </Button>
                  <span className="tnum w-6 text-center">{qty}</span>
                  <Button size="icon" variant="outline" aria-label="Agregar uno" onClick={() => cambiar(id, 1)}>
                    <Plus />
                  </Button>
                  <span className="tnum w-24 text-right">{money((p?.salePrice ?? 0) * qty)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Quitar producto"
                    onClick={() => cambiar(id, -qty)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Total con precios del POS: <span className="tnum font-medium text-foreground">{money(total)}</span>
          </p>
          <Button onClick={() => void registrar()} disabled={!listo}>
            {guardando ? <Loader2 className="animate-spin" /> : <Smartphone />}
            Registrar pedido
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Importación ─────────────────────────────────────────────────────────────

const ESTADO_TONO = {
  ok: "bg-success/15 text-success-ink",
  duplicado: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
} as const

function ImportarCsv() {
  const { sedeId } = useSede()
  const [plataforma, setPlataforma] = React.useState<PlatformCode>("rappi")
  const [archivo, setArchivo] = React.useState<string>("")
  const [nombre, setNombre] = React.useState("")
  const [vista, setVista] = React.useState<PreviewResult | null>(null)
  const [resultado, setResultado] = React.useState<ImportResult | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function leer(file: File | undefined) {
    setVista(null)
    setResultado(null)
    setError(null)
    if (!file) return
    setNombre(file.name)
    setArchivo(await file.text())
  }

  async function previsualizar() {
    if (!sedeId) return
    setCargando(true)
    setError(null)
    setResultado(null)
    try {
      setVista(await previewPlatformImport(sedeId, plataforma, archivo))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }

  async function importar() {
    if (!sedeId) return
    setCargando(true)
    setError(null)
    try {
      setResultado(await importPlatformOrders(sedeId, plataforma, archivo))
      setVista(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="im-plataforma" label="Plataforma">
            <NativeSelect
              id="im-plataforma"
              value={plataforma}
              onChange={(v) => {
                setPlataforma(v as PlatformCode)
                setVista(null)
              }}
              options={PLATFORM_OPTIONS}
            />
          </Field>
          <Field
            id="im-archivo"
            label="Archivo CSV del portal de aliados"
            hint="Columnas: pedido, producto o sku, cantidad (y opcionales fecha, comisión, total). Separador , o ;"
          >
            <Input
              id="im-archivo"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => void leer(e.target.files?.[0])}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void previsualizar()} disabled={!archivo || cargando}>
            {cargando ? <Loader2 className="animate-spin" /> : <Upload />}
            Vista previa{nombre ? ` de ${nombre}` : ""}
          </Button>
          {vista && vista.summary.ok > 0 && (
            <Button onClick={() => void importar()} disabled={cargando}>
              Importar {vista.summary.ok} pedido(s)
            </Button>
          )}
        </div>

        {vista && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {vista.summary.ok} listos · {vista.summary.duplicado} ya registrados · {vista.summary.error} con error.
              Se cobra con los precios del POS, no con los del portal.
            </p>
            {vista.fileErrors.map((e) => (
              <FormAlert key={`${e.line}-${e.message}`}>
                Línea {e.line}: {e.message}
              </FormAlert>
            ))}
            <ul className="flex flex-col gap-2">
              {vista.orders.map((o) => (
                <li key={o.externalId} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.externalId}</span>
                    <Badge className={ESTADO_TONO[o.status]}>
                      {o.status === "ok" ? "Listo" : o.status === "duplicado" ? `Ya registrado (${o.saleNumber})` : "Con error"}
                    </Badge>
                    <span className="tnum ml-auto">{money(o.total)}</span>
                  </div>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {o.lines.map((l) => (
                      <li key={l.line}>
                        {l.qty} × {l.productName ?? l.name ?? l.sku}
                        {l.error ? ` — ${l.error}` : ""}
                      </li>
                    ))}
                  </ul>
                  {o.warnings.map((w) => (
                    <p key={w} className="mt-1 text-xs text-warning-ink">
                      {w}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        {resultado && (
          <div className="flex flex-col gap-2">
            <FormAlert tone={resultado.summary.error > 0 ? "warning" : "success"}>
              {resultado.summary.creado} creados · {resultado.summary.duplicado} ya estaban · {resultado.summary.error} con error.
            </FormAlert>
            <ul className="flex flex-col gap-1 text-sm">
              {resultado.results.map((r) => (
                <li key={r.externalId} className="flex flex-wrap gap-2">
                  <span className="font-medium">{r.externalId}</span>
                  <span className="text-muted-foreground">
                    {r.status === "creado" ? `creado (${r.saleNumber})` : r.status === "duplicado" ? "ya estaba" : r.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Por cobrar y liquidación ────────────────────────────────────────────────

function PorCobrar() {
  const { sedeId } = useSede()
  const { hasPermission } = useAuth()
  const canManage = hasPermission("finance.manage")
  const confirm = useConfirm()

  const [resumen, setResumen] = React.useState<PlatformSummary | null>(null)
  const [plataforma, setPlataforma] = React.useState<PlatformCode>("rappi")
  const [pedidos, setPedidos] = React.useState<PlatformOrderRow[]>([])
  const [liquidaciones, setLiquidaciones] = React.useState<PlatformSettlement[]>([])
  const [elegidos, setElegidos] = React.useState<Set<string>>(new Set())
  const [recibido, setRecibido] = React.useState<number | null>(null)
  const [comision, setComision] = React.useState<number | null>(null)
  const [ivaComision, setIvaComision] = React.useState<number | null>(null)
  const [fecha, setFecha] = React.useState("")
  const [nota, setNota] = React.useState("")
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const cargar = React.useCallback(async () => {
    if (!sedeId) return
    setCargando(true)
    setError(null)
    try {
      const [res, ped, liq] = await Promise.all([
        getPlatformSummary({ sedeId }),
        listPlatformOrders({ sedeId, platform: plataforma, pending: true }),
        listPlatformSettlements({ sedeId, platform: plataforma }),
      ])
      setResumen(res)
      setPedidos(ped)
      setLiquidaciones(liq)
      setElegidos(new Set())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }, [sedeId, plataforma])

  React.useEffect(() => {
    let vivo = true
    async function arrancar() {
      await Promise.resolve()
      if (vivo) await cargar()
    }
    void arrancar()
    return () => {
      vivo = false
    }
  }, [cargar])

  const bruto = pedidos.filter((p) => elegidos.has(p.id)).reduce((a, p) => a + p.amount, 0)
  const estimada = pedidos.filter((p) => elegidos.has(p.id)).reduce((a, p) => a + p.commissionEstimate, 0)
  const problema = settlementProblem(bruto, recibido ?? 0, comision ?? 0, ivaComision ?? 0)

  function alternar(id: string) {
    setElegidos((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function liquidar() {
    if (!sedeId) return
    setCargando(true)
    setError(null)
    try {
      await createPlatformSettlement({
        sedeId,
        platform: plataforma,
        saleIds: [...elegidos],
        received: recibido ?? 0,
        commission: comision ?? 0,
        commissionIva: ivaComision ?? 0,
        date: fecha || undefined,
        note: nota.trim() || undefined,
      })
      setRecibido(null)
      setComision(null)
      setIvaComision(null)
      setNota("")
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
      setCargando(false)
    }
  }

  async function anular(l: PlatformSettlement) {
    const ok = await confirm({
      title: "¿Anular la liquidación?",
      description: `Los ${l.saleIds.length} pedido(s) vuelven a quedar por cobrar a ${PLATFORM_LABELS[l.platform]}.`,
      confirmLabel: "Anular liquidación",
      destructive: true,
    })
    if (!ok) return
    try {
      await voidPlatformSettlement(l._id)
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-sm font-medium">Saldo por cobrar a cada plataforma</p>
          {resumen && resumen.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay pedidos de plataformas.</p>
          )}
          <ul className="flex flex-col gap-2">
            {resumen?.rows.map((r) => (
              <li key={r.platform} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border p-3 text-sm">
                <span className="min-w-0 flex-1 font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground">
                  {r.orders} pedido(s) · vendido {money(r.sales)} · comisión liquidada {money(r.commission + r.commissionIva)}
                </span>
                <Badge variant="secondary" className="tnum">
                  Te deben {money(r.pendingAmount)} ({r.pendingOrders})
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <Field id="pc-plataforma" label="Liquidar a">
            <NativeSelect
              id="pc-plataforma"
              value={plataforma}
              onChange={(v) => setPlataforma(v as PlatformCode)}
              options={PLATFORM_OPTIONS}
            />
          </Field>
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos pendientes con esta plataforma.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {pedidos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <Checkbox
                    checked={elegidos.has(p.id)}
                    onCheckedChange={() => alternar(p.id)}
                    aria-label={`Incluir ${p.externalId}`}
                    disabled={!canManage}
                  />
                  <span className="font-medium">{p.externalId}</span>
                  <span className="text-xs text-muted-foreground">{p.saleNumber}</span>
                  <span className="tnum ml-auto">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          {canManage && elegidos.size > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <p className="text-sm">
                La plataforma debía <span className="tnum font-medium">{money(bruto)}</span>
                {estimada > 0 && (
                  <span className="text-muted-foreground"> (el portal estimó {money(estimada)} de comisión)</span>
                )}
                . Lo consignado + la comisión + su IVA tienen que sumar eso.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="lq-recibido" label="Consignado">
                  <MoneyInput id="lq-recibido" value={recibido} onValueChange={setRecibido} />
                </Field>
                <Field id="lq-comision" label="Comisión" hint="Sin IVA. Incluye ajustes o descuentos de la plataforma.">
                  <MoneyInput id="lq-comision" value={comision} onValueChange={setComision} />
                </Field>
                <Field id="lq-iva" label="IVA de la comisión" hint="Solo si lo descuentas.">
                  <MoneyInput id="lq-iva" value={ivaComision} onValueChange={setIvaComision} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="lq-fecha" label="Fecha de la consignación" hint="Hoy si lo dejas vacío.">
                  <Input id="lq-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </Field>
                <Field id="lq-nota" label="Nota">
                  <Input id="lq-nota" value={nota} maxLength={240} onChange={(e) => setNota(e.target.value)} />
                </Field>
              </div>
              {problema && <FormAlert tone="warning">{problema}</FormAlert>}
              <Button onClick={() => void liquidar()} disabled={Boolean(problema) || cargando} className="self-start">
                {cargando ? <Loader2 className="animate-spin" /> : null}
                Registrar liquidación
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {liquidaciones.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-sm font-medium">Liquidaciones de {PLATFORM_LABELS[plataforma]}</p>
            <ul className="flex flex-col gap-2">
              {liquidaciones.map((l) => (
                <li key={l._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-3 text-sm">
                  <span className="font-medium">{l.date}</span>
                  <span className="text-xs text-muted-foreground">
                    {l.saleIds.length} pedido(s) · {money(l.gross)} · consignado {money(l.received)} · comisión{" "}
                    {money(l.commission + l.commissionIva)}
                  </span>
                  {l.status === "void" ? (
                    <Badge variant="outline" className="ml-auto">
                      Anulada
                    </Badge>
                  ) : (
                    canManage && (
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void anular(l)}>
                        Anular
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
