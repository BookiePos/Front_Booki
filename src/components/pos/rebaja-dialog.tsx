"use client"

import * as React from "react"
import { BadgePercent, CheckCircle2, Loader2 } from "lucide-react"

import {
  createRebaja,
  listSaleReturns,
  paidForLine,
  type Sale,
  type SaleReturn,
} from "@/lib/pos/api-sales"
import {
  CONCEPTO_REBAJA_LABELS,
  REBATE_METHOD_LABELS,
  conceptosDisponibles,
  camposRebaja,
  huellaRebaja,
  lineasDeRebaja,
  llaveDelIntento,
  resumenNota,
  type ConceptoRebaja,
  type LlaveIntento,
  type RebateMethod,
} from "@/lib/pos/notas"
import { money } from "@/lib/pos/format"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperado"
}

/**
 * Rebaja posterior: se le reconoce al cliente un menor valor SIN que vuelva
 * mercancía (queja, descuento olvidado, error de precio, pronto pago, volumen).
 * Sale plata o baja la cartera sin nada físico que lo respalde, por eso la
 * autoriza quien puede anular ventas (`pos.void.authorize`).
 */
export function RebajaDialog({
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
  const [concepto, setConcepto] = React.useState<ConceptoRebaja>("3")
  const [montos, setMontos] = React.useState<Record<string, number | null>>({})
  const [refundMethod, setRefundMethod] = React.useState<RebateMethod>("cash")
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hecha, setHecha] = React.useState<SaleReturn | null>(null)
  const llave = React.useRef<LlaveIntento | null>(null)

  const saleId = sale?._id
  const esFev = sale?.documentoFiscal?.solicitado === "fev"

  function cerrar() {
    // Con la petición en vuelo no se cierra: la llave y el resultado siguen
    // siendo de este intento, y cerrar permitiría una segunda rebaja.
    if (saving) return
    onOpenChange(false)
    llave.current = null
    setMontos({})
    setConcepto("3")
    setRefundMethod("cash")
    setReason("")
    setError(null)
    setHecha(null)
  }

  React.useEffect(() => {
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !open || !saleId) return
      setCargando(true)
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

  /** Lo que el cliente pagó por producto y todavía conserva. */
  const filas = React.useMemo(() => {
    if (!sale) return []
    const pagado = new Map<string, { name: string; sku: string; valor: number }>()
    for (const l of sale.lines) {
      const prev = pagado.get(l.productId)
      pagado.set(l.productId, {
        name: l.name,
        sku: l.sku,
        valor: (prev?.valor ?? 0) + paidForLine(l),
      })
    }
    for (const r of previas) {
      for (const l of r.lines) {
        const p = pagado.get(l.productId)
        if (p) p.valor -= l.refund
      }
    }
    return [...pagado].map(([productId, p]) => ({
      productId,
      name: p.name,
      sku: p.sku,
      saldo: Math.max(0, Math.floor(p.valor)),
    }))
  }, [sale, previas])

  const saldos = React.useMemo(
    () => Object.fromEntries(filas.map((f) => [f.productId, f.saldo])),
    [filas],
  )
  const campos = sale
    ? camposRebaja({
        concepto,
        montos,
        saldos,
        refundMethod,
        reason,
        esFev,
        tieneCliente: Boolean(sale.customerId),
      })
    : { montos: "Sin venta" }
  const bloqueo = campos.concepto ?? campos.montos ?? campos.reason ?? campos.refundMethod ?? null
  const hayMontos = Object.values(montos).some((m) => m)
  const total = Object.values(montos).reduce<number>((a, m) => a + (m ?? 0), 0)

  async function guardar() {
    if (!saleId || bloqueo) return
    setSaving(true)
    setError(null)
    try {
      const lines = lineasDeRebaja(montos)
      const payload = { concepto, lines, refundMethod, reason: reason.trim() }
      llave.current = llaveDelIntento(llave.current, huellaRebaja({ saleId, ...payload }))
      const r = await createRebaja(saleId, {
        ...payload,
        idempotencyKey: llave.current.llave,
      })
      llave.current = null
      setHecha(r)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(v) : cerrar())}
      size="3xl"
      icon={BadgePercent}
      title={`Rebaja sobre ${sale?.saleNumber ?? "la venta"}`}
      description="Para reconocerle al cliente un menor valor sin que devuelva mercancía. No mueve el inventario."
      footer={
        <>
          <Button variant="outline" onClick={cerrar} disabled={saving}>
            {hecha ? "Cerrar" : "Cancelar"}
          </Button>
          {!hecha && (
            <Button
              onClick={() => void guardar()}
              disabled={bloqueo !== null || saving}
              className="sm:min-w-52"
            >
              {saving ? <Loader2 className="animate-spin" /> : <BadgePercent />}
              {saving ? "Registrando…" : total > 0 ? `Rebajar ${money(total)}` : "Registrar rebaja"}
            </Button>
          )}
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      {hecha && (
        <FormAlert tone="success" icon={CheckCircle2}>
          Rebaja registrada por <strong>{money(hecha.refundTotal)}</strong>.
          {resumenNota(hecha.notaFiscal) && (
            <span className="mt-1 block">
              {hecha.notaFiscal?.estado === "emitida" ? "Quedó la " : "Sin nota: "}
              {resumenNota(hecha.notaFiscal)}.
            </span>
          )}
        </FormAlert>
      )}
      {!hecha && (
        <>
          <FormSection
            title="Cuánto se rebaja de cada producto"
            description="Escribe el monto con impuesto. No puede pasar de lo que el cliente conserva (lo pagado menos lo devuelto y lo ya rebajado)."
          >
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Puede rebajar</TableHead>
                    <TableHead>Rebaja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargando && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!cargando &&
                    filas.map((f) => (
                      <TableRow key={f.productId}>
                        <TableCell className="py-2">
                          <p className="font-medium leading-tight">{f.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{f.sku}</p>
                        </TableCell>
                        <TableCell className="tnum py-2 text-right">{money(f.saldo)}</TableCell>
                        <TableCell className="py-2">
                          <MoneyInput
                            className="h-9 w-32 text-right"
                            aria-label={`Monto a rebajar de ${f.name}`}
                            placeholder="—"
                            disabled={f.saldo <= 0}
                            aria-describedby={hayMontos && campos.montos ? "rb-montos-error" : undefined}
                            value={montos[f.productId] ?? null}
                            onValueChange={(v) => setMontos((prev) => ({ ...prev, [f.productId]: v }))}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {hayMontos && campos.montos && (
              <p id="rb-montos-error" role="alert" className="text-xs font-medium text-destructive">
                {campos.montos}
              </p>
            )}
          </FormSection>

          <FormSection title="Concepto y motivo">
            <FieldGrid cols={2}>
              <Field id="rb-concepto" label="Concepto de la nota" required error={campos.concepto}>
                <NativeSelect
                  id="rb-concepto"
                  value={concepto}
                  onChange={(v) => setConcepto(v as ConceptoRebaja)}
                  options={conceptosDisponibles(esFev).map((c) => ({
                    value: c,
                    label: CONCEPTO_REBAJA_LABELS[c],
                  }))}
                />
              </Field>
              <Field id="rb-metodo" label="Cómo se le reconoce" required hint="Solo el efectivo sale de la caja del turno." error={campos.refundMethod}>
                <NativeSelect
                  id="rb-metodo"
                  value={refundMethod}
                  onChange={(v) => setRefundMethod(v as RebateMethod)}
                  options={Object.entries(REBATE_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </Field>
              <Field id="rb-motivo" label="Motivo" required hint="Va en la descripción de la nota." error={reason ? campos.reason : undefined}>
                <Input
                  id="rb-motivo"
                  value={reason}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="El pedido llegó tarde"
                />
              </Field>
            </FieldGrid>
            {!esFev && (
              <p className="text-xs text-muted-foreground">
                El descuento por pronto pago y por volumen solo existe en la
                factura electrónica: esta venta no la tiene.
              </p>
            )}
          </FormSection>
        </>
      )}
    </FormDialog>
  )
}
