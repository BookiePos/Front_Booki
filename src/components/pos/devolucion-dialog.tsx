"use client"

import * as React from "react"
import { PackageX, Loader2, CheckCircle2, TriangleAlert } from "lucide-react"

import {
  listSaleReturns,
  createSaleReturn,
  paidForLine,
  RETURN_REASON_LABELS,
  REFUND_METHOD_LABELS,
  type Sale,
  type SaleReturn,
  type ReturnReason,
  type RestockMode,
  type RefundMethod,
} from "@/lib/pos/api-sales"
import { money } from "@/lib/pos/format"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

/**
 * Devolución parcial: el cliente se llevó diez y trae dos.
 *
 * Anular la venta sigue siendo lo correcto cuando devuelve todo; esto es para
 * lo otro, que es lo que pasa casi siempre.
 *
 * La pantalla pide tres cosas y ninguna tiene valor por defecto a propósito:
 * cuánto vuelve, si sigue sirviendo para vender, y cómo se le devuelve la
 * plata. Elegir por el cajero sería elegir mal: una gaseosa sin abrir vuelve al
 * estante y una torta manoseada no, y eso solo lo sabe quien la está
 * recibiendo.
 */
export function DevolucionDialog({
  sale,
  open,
  onOpenChange,
  onDone,
}: {
  sale: Sale | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const [previas, setPrevias] = React.useState<SaleReturn[]>([])
  const [cargando, setCargando] = React.useState(false)
  const [cantidades, setCantidades] = React.useState<Record<string, string>>({})
  const [reason, setReason] = React.useState<ReturnReason>("defectuoso")
  const [restock, setRestock] = React.useState<RestockMode>("inventory")
  const [refundMethod, setRefundMethod] = React.useState<RefundMethod>("cash")
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hecha, setHecha] = React.useState<SaleReturn | null>(null)

  const saleId = sale?._id

  function reiniciar() {
    setCantidades({})
    setReason("defectuoso")
    setRestock("inventory")
    setRefundMethod("cash")
    setNote("")
    setError(null)
    setHecha(null)
  }

  function cerrar() {
    onOpenChange(false)
    reiniciar()
  }

  /**
   * Lo ya devuelto antes. Sin esto la pantalla ofrecería devolver diez de una
   * venta de la que ya volvieron ocho, y el backend lo rechazaría con un error
   * que nadie entiende en el mostrador.
   */
  React.useEffect(() => {
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !open || !saleId) return
      setCargando(true)
      setError(null)
      try {
        const rs = await listSaleReturns(saleId)
        if (vivo) setPrevias(rs)
      } catch (err) {
        if (vivo) setError(errorMessage(err))
      } finally {
        if (vivo) setCargando(false)
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [open, saleId])

  /** Cuánto se devolvió ya de cada producto de esta venta. */
  const yaDevuelto = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of previas) {
      for (const l of r.lines) {
        m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty)
      }
    }
    return m
  }, [previas])

  /** Filas con lo que todavía se puede devolver y cuánto se reembolsaría. */
  const filas = React.useMemo(() => {
    if (!sale) return []
    return sale.lines.map((l) => {
      const devuelto = yaDevuelto.get(l.productId) ?? 0
      const disponible = l.qty - devuelto
      const texto = cantidades[l.productId] ?? ""
      const n = Number(texto)
      const pedida =
        texto.trim() !== "" && Number.isFinite(n) && n > 0 ? n : 0
      const valida = pedida > 0 && pedida <= disponible
      // Se le devuelve lo que PAGÓ por esa línea, en proporción — no el precio
      // de lista, que no tiene descontado nada.
      const reembolso = valida
        ? Math.round((paidForLine(l) * pedida) / l.qty)
        : 0
      return { line: l, devuelto, disponible, texto, pedida, valida, reembolso }
    })
  }, [sale, yaDevuelto, cantidades])

  const seleccionadas = filas.filter((f) => f.pedida > 0)
  const invalidas = seleccionadas.filter((f) => !f.valida)
  const reembolsoTotal = seleccionadas.reduce((s, f) => s + f.reembolso, 0)
  const puedeGuardar =
    seleccionadas.length > 0 && invalidas.length === 0 && !saving

  async function guardar() {
    if (!saleId || !puedeGuardar) return
    setSaving(true)
    setError(null)
    try {
      const r = await createSaleReturn(saleId, {
        lines: seleccionadas.map((f) => ({
          productId: f.line.productId,
          qty: f.pedida,
        })),
        reason,
        restock,
        refundMethod,
        note: note.trim() || undefined,
      })
      setHecha(r)
      setCantidades({})
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const sinNadaQueDevolver =
    filas.length > 0 && filas.every((f) => f.disponible <= 0)

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cerrar()
        else onOpenChange(v)
      }}
      size="3xl"
      icon={PackageX}
      title={`Devolución de ${sale?.saleNumber ?? "la venta"}`}
      description="Para cuando el cliente trae de vuelta parte de lo que se llevó. Si devuelve todo, anula la venta."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            {hecha ? "Cerrar" : "Cancelar"}
          </Button>
          {!hecha && (
            <Button
              onClick={() => void guardar()}
              disabled={!puedeGuardar}
              className="sm:min-w-52"
            >
              {saving ? <Loader2 className="animate-spin" /> : <PackageX />}
              {saving
                ? "Registrando…"
                : reembolsoTotal > 0
                  ? `Devolver ${money(reembolsoTotal)}`
                  : "Registrar devolución"}
            </Button>
          )}
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {hecha && (
        <FormAlert tone="success" icon={CheckCircle2}>
          Devolución registrada por <strong>{money(hecha.refundTotal)}</strong>.
          {hecha.refundMethod === "cash" && (
            <span className="mt-1 block">
              Sale de la caja del turno: entrégale el efectivo al cliente.
            </span>
          )}
          {hecha.restock === "waste" && !hecha.wasteRecorded && (
            <span className="mt-1 block">
              Ojo: la mercancía volvió al inventario pero no se pudo dar de baja
              como merma. Descuéntala con un ajuste para que las existencias
              queden bien.
            </span>
          )}
        </FormAlert>
      )}

      {previas.length > 0 && !hecha && (
        <FormAlert tone="info">
          Esta venta ya tuvo {previas.length} devolución(es) por{" "}
          <strong>
            {money(previas.reduce((s, r) => s + r.refundTotal, 0))}
          </strong>
          . Abajo solo puedes devolver lo que queda.
        </FormAlert>
      )}

      {sinNadaQueDevolver && (
        <FormAlert tone="warning" icon={TriangleAlert}>
          De esta venta ya se devolvió todo.
        </FormAlert>
      )}

      {!hecha && (
        <>
          <FormSection
            title="Qué trae de vuelta"
            description="Escribe solo lo que el cliente devuelve. Lo que dejes en blanco se queda como está."
          >
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Se llevó</TableHead>
                    <TableHead className="text-right">Puede devolver</TableHead>
                    <TableHead>Devuelve</TableHead>
                    <TableHead className="text-right">Se le devuelve</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargando && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!cargando &&
                    filas.map((f) => (
                      <TableRow
                        key={f.line.productId}
                        className={cn(
                          f.pedida > 0 && f.valida && "bg-brand-50/60 dark:bg-brand-950/30",
                          f.disponible <= 0 && "opacity-50",
                        )}
                      >
                        <TableCell className="py-2">
                          <p className="font-medium leading-tight">
                            {f.line.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {f.line.sku}
                          </p>
                        </TableCell>
                        <TableCell className="tnum py-2 text-right text-muted-foreground">
                          {f.line.qty}
                        </TableCell>
                        <TableCell className="tnum py-2 text-right">
                          {f.disponible}
                          {f.devuelto > 0 && (
                            <span className="block text-[11px] text-muted-foreground">
                              ya volvieron {f.devuelto}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            min="0"
                            max={f.disponible}
                            step="any"
                            inputMode="decimal"
                            className="h-9 w-24 text-right tnum"
                            aria-label={`Cantidad devuelta de ${f.line.name}`}
                            placeholder="—"
                            disabled={f.disponible <= 0}
                            value={f.texto}
                            onChange={(e) =>
                              setCantidades((prev) => ({
                                ...prev,
                                [f.line.productId]: e.target.value,
                              }))
                            }
                          />
                          {f.pedida > 0 && !f.valida && (
                            <p className="mt-1 text-[11px] font-medium text-destructive">
                              Solo quedan {f.disponible}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="tnum py-2 text-right">
                          {f.reembolso > 0 ? (
                            <span className="font-medium">
                              {money(f.reembolso)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Se le devuelve lo que pagó por cada producto. Si la venta llevaba
              descuento, el descuento también se devuelve en proporción.
            </p>
          </FormSection>

          <FormSection title="Qué se hace con lo devuelto">
            <FieldGrid cols={2}>
              <Field id="dv-reason" label="Motivo" required>
                <NativeSelect
                  id="dv-reason"
                  value={reason}
                  onChange={(v) => setReason(v as ReturnReason)}
                  options={Object.entries(RETURN_REASON_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </Field>

              <Field
                id="dv-restock"
                label="¿Se puede volver a vender?"
                required
                hint="Una gaseosa sin abrir vuelve al estante; una torta manoseada, no."
              >
                <NativeSelect
                  id="dv-restock"
                  value={restock}
                  onChange={(v) => setRestock(v as RestockMode)}
                  options={[
                    { value: "inventory", label: "Sí, vuelve al inventario" },
                    { value: "waste", label: "No, se va a la basura (merma)" },
                  ]}
                />
              </Field>

              <Field
                id="dv-refund"
                label="Cómo le devuelves la plata"
                required
                hint="Solo el efectivo sale de la caja del turno."
              >
                <NativeSelect
                  id="dv-refund"
                  value={refundMethod}
                  onChange={(v) => setRefundMethod(v as RefundMethod)}
                  options={Object.entries(REFUND_METHOD_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </Field>

              <Field id="dv-note" label="Nota" hint="Opcional, queda en el registro.">
                <Input
                  id="dv-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vino con el empaque roto"
                />
              </Field>
            </FieldGrid>

            {restock === "waste" && seleccionadas.length > 0 && (
              <FormAlert tone="warning" icon={TriangleAlert}>
                Lo devuelto se registra como <strong>merma</strong>: entra al
                inventario y se da de baja enseguida, para que quede el rastro
                de que volvió y se perdió. No se vuelve a vender.
              </FormAlert>
            )}
          </FormSection>
        </>
      )}
    </FormDialog>
  )
}
