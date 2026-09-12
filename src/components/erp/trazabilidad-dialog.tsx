"use client"

import * as React from "react"
import {
  Search,
  Loader2,
  Factory,
  ShoppingCart,
  Users,
  TriangleAlert,
  ChevronRight,
} from "lucide-react"

import { ApiError } from "@/lib/api"
import {
  findTraceLots,
  traceLot,
  type TraceLotMatch,
  type TraceLotNode,
  type TraceResult,
} from "@/lib/erp/api-reports"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
const df = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" })

function fecha(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : df.format(d)
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

/**
 * Un eslabón de la cadena, dibujado con sangría según su profundidad.
 *
 * La sangría es el punto: se tiene que ver de un golpe que la harina no se
 * vendió sola, que pasó por una tanda, y que lo que llegó al cliente fue otra
 * cosa con otro lote.
 */
function Eslabon({ nodo, nivel }: { nodo: TraceLotNode; nivel: number }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3",
        nivel > 0 && "border-l-4 border-l-brand-400",
      )}
      style={{ marginLeft: nivel * 16 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{nodo.productName}</span>
        <Badge variant="outline">Lote {nodo.lotCode}</Badge>
        {nodo.expiresAt && (
          <span className="text-xs text-muted-foreground">
            vence {fecha(nodo.expiresAt)}
          </span>
        )}
        {nodo.supplier && (
          <span className="text-xs text-muted-foreground">
            · {nodo.supplier}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Entraron {nf.format(nodo.initialQty)} · quedan{" "}
        {nf.format(nodo.remainingQty)} en bodega
      </p>

      {nodo.sales.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {nodo.sales.map((v) => (
            <li
              key={v.saleId}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
            >
              <ShoppingCart className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-mono text-xs">{v.saleNumber}</span>
              <span className="text-muted-foreground">
                {fecha(v.date)} · {nf.format(v.qty)} und
              </span>
              {v.status === "void" && (
                <Badge variant="destructive">Anulada</Badge>
              )}
              {v.customer ? (
                <span className="font-medium">
                  {v.customer.name ?? "Sin nombre"}
                  {v.customer.phone ? ` · ${v.customer.phone}` : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  mostrador (sin datos del cliente)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {nodo.producedInto.map((op) => (
        <div key={op.orderId} className="mt-2 flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Factory className="size-3.5 shrink-0 text-muted-foreground" />
            <span>
              Entró a la tanda <span className="font-mono">{op.number}</span> del{" "}
              {op.date}, que produjo {nf.format(op.producedQty)}{" "}
              {op.productName}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </p>
          {op.outputs.map((hijo) => (
            <Eslabon key={hijo.lotId} nodo={hijo} nivel={nivel + 1} />
          ))}
          {op.outputs.length === 0 && (
            <p
              className="text-xs text-muted-foreground"
              style={{ marginLeft: (nivel + 1) * 16 }}
            >
              De esa tanda no quedó rastro del lote que salió.
            </p>
          )}
        </div>
      ))}

      {nodo.sales.length === 0 && nodo.producedInto.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          De este lote no salió nada todavía: sigue completo en bodega.
        </p>
      )}
    </div>
  )
}

/**
 * Trazabilidad hacia adelante: "el lote L-2409 salió malo, ¿a dónde se fue?".
 *
 * Para una galletería la respuesta casi nunca es directa. El bulto de harina no
 * se vendió: se horneó, y lo que llegó al cliente fueron galletas con otro
 * lote. Por eso la pantalla dibuja la CADENA y no una lista: quien está
 * llamando a los clientes tiene que ver el camino completo.
 */
export function TrazabilidadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [codigo, setCodigo] = React.useState("")
  const [buscando, setBuscando] = React.useState(false)
  const [candidatos, setCandidatos] = React.useState<TraceLotMatch[] | null>(
    null,
  )
  const [cargando, setCargando] = React.useState(false)
  const [resultado, setResultado] = React.useState<TraceResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  function reiniciar() {
    setCodigo("")
    setCandidatos(null)
    setResultado(null)
    setError(null)
  }

  function cerrar() {
    onOpenChange(false)
    reiniciar()
  }

  async function buscar() {
    if (!codigo.trim()) return
    setBuscando(true)
    setError(null)
    setResultado(null)
    try {
      const lotes = await findTraceLots(codigo.trim())
      setCandidatos(lotes)
      // Un solo resultado: no tiene sentido hacer elegir.
      if (lotes.length === 1 && lotes[0]) await rastrear(lotes[0].lotId)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBuscando(false)
    }
  }

  async function rastrear(lotId: string) {
    setCargando(true)
    setError(null)
    try {
      setResultado(await traceLot(lotId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cerrar()
        else onOpenChange(v)
      }}
      size="3xl"
      icon={Search}
      title="Rastrear un lote"
      description="Si un lote salió malo, aquí ves a qué ventas y a qué clientes se fue — incluso si pasó por producción."
      footer={<Button onClick={cerrar}>Cerrar</Button>}
    >
      {error && <FormAlert>{error}</FormAlert>}

      <FormSection title="Qué lote">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Código del lote, por ejemplo L-2409"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void buscar()
                }
              }}
            />
          </div>
          <Button onClick={() => void buscar()} disabled={buscando || !codigo.trim()}>
            {buscando ? <Loader2 className="animate-spin" /> : <Search />}
            Buscar
          </Button>
        </div>

        {/* El código no es único entre productos: dos proveedores pueden usar
            la misma numeración, así que a veces toca elegir. */}
        {candidatos !== null && candidatos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay ningún lote con ese código.
          </p>
        )}
        {candidatos !== null && candidatos.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">
              Hay {candidatos.length} lotes con ese código. ¿Cuál?
            </p>
            {candidatos.map((c) => (
              <button
                key={c.lotId}
                type="button"
                onClick={() => void rastrear(c.lotId)}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  resultado?.lotId === c.lotId
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40"
                    : "border-border",
                )}
              >
                <span className="font-medium">{c.productName}</span>
                <Badge variant="outline">{c.lotCode}</Badge>
                <span className="text-xs text-muted-foreground">
                  recibido {fecha(c.receivedAt)}
                  {c.supplier ? ` · ${c.supplier}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </FormSection>

      {cargando && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {resultado && !cargando && (
        <>
          <FormSection title="A dónde se fue">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <ShoppingCart className="size-4 text-muted-foreground" />
                <div className="leading-tight">
                  <p className="font-medium">{nf.format(resultado.soldQty)}</p>
                  <p className="text-xs text-muted-foreground">
                    unidades vendidas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Users className="size-4 text-muted-foreground" />
                <div className="leading-tight">
                  <p className="font-medium">{resultado.customers.length}</p>
                  <p className="text-xs text-muted-foreground">
                    cliente(s) identificados
                  </p>
                </div>
              </div>
            </div>

            {resultado.truncated && (
              <FormAlert tone="warning" icon={TriangleAlert}>
                La cadena es más larga de lo que se puede seguir de una vez.
                Rastrea a mano el último lote que aparezca abajo para ver el
                resto.
              </FormAlert>
            )}

            {resultado.customers.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1.5 text-sm font-medium">
                  A quién hay que llamar
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {resultado.customers.map((c, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="font-medium">
                        {c.name ?? "Sin nombre"}
                      </span>
                      {c.idNumber && (
                        <span className="text-muted-foreground">
                          {c.idNumber}
                        </span>
                      )}
                      {c.phone && (
                        <span className="text-muted-foreground">{c.phone}</span>
                      )}
                      {c.email && (
                        <span className="text-muted-foreground">{c.email}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.soldQty > 0 && resultado.customers.length === 0 && (
              <FormAlert tone="warning" icon={TriangleAlert}>
                Se vendieron {nf.format(resultado.soldQty)} unidades pero
                ninguna venta guardó datos del cliente: fueron de mostrador. No
                hay a quién avisar.
              </FormAlert>
            )}
          </FormSection>

          <FormSection
            title="El camino"
            description="De arriba abajo: dónde empezó, por dónde pasó y en qué terminó."
          >
            <Eslabon nodo={resultado} nivel={0} />
          </FormSection>
        </>
      )}
    </FormDialog>
  )
}
