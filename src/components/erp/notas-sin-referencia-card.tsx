"use client"

import * as React from "react"
import { BadgePercent, CheckCircle2, Loader2, Plus } from "lucide-react"

import {
  createNotaSinReferencia,
  listNotasSinReferencia,
  type NotaSinReferencia,
} from "@/lib/erp/api-notas"
import { listCustomers, type Customer } from "@/lib/erp/api-customers"
import {
  CONCEPTO_REBAJA_LABELS,
  REBATE_METHOD_LABELS,
  conceptosDisponibles,
  diasDelPeriodo,
  errorNotaSinReferencia,
  huellaRebaja,
  llaveDelIntento,
  resumenNota,
  type ConceptoRebaja,
  type LlaveIntento,
  type RebateMethod,
} from "@/lib/pos/notas"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { FormAlert, FormDialog } from "@/components/ui/form-dialog"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperado"
}

/**
 * Nota crédito SIN referencia (Fase 6D): el descuento por volumen o pronto
 * pago que cubre varias facturas electrónicas de un cliente en un periodo de
 * máximo 30 días dentro de un mismo mes. Solo existe para la factura
 * electrónica: un POS siempre se corrige con su nota de ajuste referida.
 *
 * Mismo permiso que la rebaja de una venta (`pos.void.authorize`): sale plata
 * o baja la cartera sin mercancía que lo respalde.
 */
export function NotasSinReferenciaCard({
  sedeId,
  sedeName,
}: {
  sedeId: string
  sedeName?: string
}) {
  const [notas, setNotas] = React.useState<NotaSinReferencia[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [abierto, setAbierto] = React.useState(false)

  const cargar = React.useCallback(async () => {
    if (!sedeId) return
    try {
      setNotas(await listNotasSinReferencia(sedeId))
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [sedeId])

  React.useEffect(() => {
    let vivo = true
    async function leer() {
      await Promise.resolve()
      if (!vivo) return
      await cargar()
    }
    void leer()
    return () => {
      vivo = false
    }
  }, [cargar])

  return (
    <Card className="mt-4" data-tour="facturacion-sin-referencia">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg">Notas crédito sin referencia</h2>
            <p className="text-xs text-muted-foreground">
              Descuento por volumen o pronto pago sobre las facturas de un
              cliente en un periodo. Solo factura electrónica.
            </p>
          </div>
          <Button onClick={() => setAbierto(true)}>
            <Plus />
            Nueva nota
          </Button>
        </div>

        {error && <FormAlert>{error}</FormAlert>}

        {notas === null && !error ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label="Cargando" />
        ) : notas && notas.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aún no hay notas sin referencia en {sedeName ?? "esta sede"}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(notas ?? []).map((n) => (
              <li key={n._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{n.customerName ?? n.docNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.desde} a {n.hasta} · {CONCEPTO_REBAJA_LABELS[n.concepto]} ·{" "}
                    {REBATE_METHOD_LABELS[n.refundMethod]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {n.notaFiscal?.estado === "emitida"
                      ? resumenNota(n.notaFiscal)
                      : "Sin número de nota todavía"}
                  </p>
                </div>
                <span className="stat-figure">{money.format(n.amount)}</span>
                {n.estado !== "completa" && (
                  <Badge variant="destructive" className="text-[11px]">
                    {n.estado === "pendiente_caja" ? "Falta la salida de caja" : "En curso"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <NuevaNotaDialog
        open={abierto}
        onOpenChange={setAbierto}
        sedeId={sedeId}
        onDone={() => void cargar()}
      />
    </Card>
  )
}

function NuevaNotaDialog({
  open,
  onOpenChange,
  sedeId,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedeId: string
  onDone: () => void
}) {
  const [clientes, setClientes] = React.useState<Customer[]>([])
  const [customerId, setCustomerId] = React.useState("")
  const [concepto, setConcepto] = React.useState<ConceptoRebaja>("6")
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  const [amount, setAmount] = React.useState<number | null>(null)
  const [refundMethod, setRefundMethod] = React.useState<RebateMethod>("credit_note")
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hecha, setHecha] = React.useState<NotaSinReferencia | null>(null)
  const llave = React.useRef<LlaveIntento | null>(null)

  React.useEffect(() => {
    let vivo = true
    async function leer() {
      await Promise.resolve()
      if (!vivo || !open) return
      try {
        const cs = await listCustomers()
        if (vivo) setClientes(cs.filter((c) => c.active))
      } catch (err) {
        if (vivo) setError(errorMessage(err))
      }
    }
    void leer()
    return () => {
      vivo = false
    }
  }, [open])

  function cerrar() {
    onOpenChange(false)
    llave.current = null
    setCustomerId("")
    setConcepto("6")
    setDesde("")
    setHasta("")
    setAmount(null)
    setRefundMethod("credit_note")
    setReason("")
    setError(null)
    setHecha(null)
  }

  const bloqueo = errorNotaSinReferencia({
    customerId,
    concepto,
    desde,
    hasta,
    amount,
    refundMethod,
    reason,
  })
  const dias = diasDelPeriodo(desde, hasta)

  async function guardar() {
    if (bloqueo || amount === null) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        sedeId,
        customerId,
        concepto,
        desde,
        hasta,
        amount,
        refundMethod,
        reason: reason.trim(),
      }
      llave.current = llaveDelIntento(llave.current, huellaRebaja(payload))
      const nota = await createNotaSinReferencia({
        ...payload,
        idempotencyKey: llave.current.llave,
      })
      llave.current = null
      setHecha(nota)
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
      size="2xl"
      icon={BadgePercent}
      title="Nota crédito sin referencia"
      description="Descuento sobre las facturas electrónicas de un cliente en un periodo de máximo 30 días dentro de un mismo mes."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            {hecha ? "Cerrar" : "Cancelar"}
          </Button>
          {!hecha && (
            <Button onClick={() => void guardar()} disabled={bloqueo !== null || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <BadgePercent />}
              {saving ? "Emitiendo…" : "Emitir nota"}
            </Button>
          )}
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      {hecha ? (
        <FormAlert tone="success" icon={CheckCircle2}>
          Nota registrada por <strong>{money.format(hecha.amount)}</strong>.
          {resumenNota(hecha.notaFiscal) && (
            <span className="mt-1 block">Quedó la {resumenNota(hecha.notaFiscal)}.</span>
          )}
        </FormAlert>
      ) : (
        <FieldGrid cols={2}>
          <Field id="nsr-cliente" label="Cliente" required hint="Debe tener facturas electrónicas en el periodo.">
            <NativeSelect
              id="nsr-cliente"
              value={customerId}
              onChange={setCustomerId}
              placeholder="Elige un cliente…"
              options={clientes.map((c) => ({
                value: c._id,
                label: `${c.name} · ${c.docType} ${c.docNumber}`,
              }))}
            />
          </Field>
          <Field id="nsr-concepto" label="Concepto" required>
            <NativeSelect
              id="nsr-concepto"
              value={concepto}
              onChange={(v) => setConcepto(v as ConceptoRebaja)}
              options={conceptosDisponibles(true).map((c) => ({
                value: c,
                label: CONCEPTO_REBAJA_LABELS[c],
              }))}
            />
          </Field>
          <Field id="nsr-desde" label="Desde" required>
            <Input id="nsr-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Field>
          <Field
            id="nsr-hasta"
            label="Hasta"
            required
            hint={dias !== null && dias > 0 ? `${dias} día(s) en el periodo.` : undefined}
          >
            <Input id="nsr-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Field>
          <Field id="nsr-monto" label="Monto con impuesto" required hint="Pesos enteros.">
            <MoneyInput id="nsr-monto" value={amount} onValueChange={setAmount} />
          </Field>
          <Field id="nsr-metodo" label="Cómo se le reconoce" required>
            <NativeSelect
              id="nsr-metodo"
              value={refundMethod}
              onChange={(v) => setRefundMethod(v as RebateMethod)}
              options={Object.entries(REBATE_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field id="nsr-motivo" label="Motivo" required hint="Va en la descripción de la nota.">
            <Input
              id="nsr-motivo"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descuento por volumen de octubre"
            />
          </Field>
          {bloqueo && (customerId || desde || hasta || amount !== null || reason) && (
            <p role="status" className="text-xs text-destructive sm:col-span-2">
              {bloqueo}
            </p>
          )}
        </FieldGrid>
      )}
    </FormDialog>
  )
}
