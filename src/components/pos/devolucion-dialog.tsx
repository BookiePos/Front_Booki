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
import { listCustomers, type Customer } from "@/lib/pos/api-customers"
import { money } from "@/lib/pos/format"
import {
  AVISO_DEVOLUCION_PARCIAL,
  clienteDeLaDevolucion,
  errorClienteDevolucion,
  huellaDevolucion,
  llaveDelIntento,
  pideClienteDevolucion,
  resumenNota,
  type LlaveIntento,
} from "@/lib/pos/notas"
import { DevolucionesVenta } from "@/components/pos/devoluciones-venta"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuantityInput } from "@/components/ui/money-input"
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
  canRefund = true,
}: {
  /** `pos.refund`: quien llega aquí ya lo tiene; se pasa explícito para el botón «Completar». */
  canRefund?: boolean
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
  /** Cliente elegido aquí, para la venta que no trae uno (a quién le queda el saldo). */
  const [clienteId, setClienteId] = React.useState("")
  /** `null`: todavía no se han pedido. Se piden solo si hace falta elegir. */
  const [clientes, setClientes] = React.useState<Customer[] | null>(null)
  const [errorClientes, setErrorClientes] = React.useState(false)
  const [intentoClientes, setIntentoClientes] = React.useState(0)

  const saleId = sale?._id
  /**
   * Llave del intento en curso: la misma mientras se reintenta lo mismo (si la
   * respuesta se perdió, el servidor devuelve la devolución ya registrada y no
   * devuelve dos veces), nueva si cambia lo que se manda.
   */
  const llave = React.useRef<LlaveIntento | null>(null)

  function reiniciar() {
    llave.current = null
    setCantidades({})
    setReason("defectuoso")
    setRestock("inventory")
    setRefundMethod("cash")
    setNote("")
    setError(null)
    setHecha(null)
    setClienteId("")
  }

  function cerrar() {
    // En vuelo no se cierra: reiniciar borraría la llave del intento y un
    // segundo clic devolvería otra vez.
    if (saving) return
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

  /** Las rebajas no devuelven mercancía: no cuentan como devoluciones. */
  const devoluciones = React.useMemo(
    () => previas.filter((r) => r.kind !== "rebaja"),
    [previas],
  )

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
  const pideCliente = sale ? pideClienteDevolucion(refundMethod, sale) : false
  const errorCliente = sale
    ? errorClienteDevolucion(refundMethod, sale, clienteId)
    : null

  /**
   * Los clientes se piden la primera vez que hay que elegir uno (la mayoría de
   * las devoluciones salen en efectivo y no los necesitan).
   */
  React.useEffect(() => {
    if (!open || !pideCliente || clientes !== null) return
    let vivo = true
    listCustomers()
      .then((cs) => {
        if (!vivo) return
        setClientes(cs.filter((c) => c.active !== false))
        setErrorClientes(false)
      })
      .catch(() => vivo && setErrorClientes(true))
    return () => {
      vivo = false
    }
  }, [open, pideCliente, clientes, intentoClientes])
  const puedeGuardar =
    seleccionadas.length > 0 &&
    invalidas.length === 0 &&
    !saving &&
    errorCliente === null

  async function guardar() {
    if (!saleId || !puedeGuardar) return
    setSaving(true)
    setError(null)
    try {
      const lines = seleccionadas.map((f) => ({
        productId: f.line.productId,
        qty: f.pedida,
      }))
      const nota = note.trim() || undefined
      const customerId = sale
        ? clienteDeLaDevolucion(refundMethod, sale, clienteId)
        : undefined
      llave.current = llaveDelIntento(
        llave.current,
        huellaDevolucion({ saleId, lines, reason, restock, refundMethod, note: nota, customerId }),
      )
      const r = await createSaleReturn(saleId, {
        lines,
        reason,
        restock,
        refundMethod,
        note: nota,
        customerId,
        idempotencyKey: llave.current.llave,
      })
      // Cerrada la operación, la siguiente lleva llave nueva.
      llave.current = null
      setHecha(r)
      setCantidades({})
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /** Nombre del cliente elegido aquí, para decir a quién le quedó el saldo. */
  const nombreElegido =
    hecha?.customerId && !sale?.customerId
      ? clientes?.find((c) => c._id === hecha.customerId)?.name
      : undefined

  const sinNadaQueDevolver =
    filas.length > 0 && filas.every((f) => f.disponible <= 0)

  return (
    <FormDialog
      busy={saving}
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
          <Button variant="outline" onClick={cerrar} disabled={saving}>
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
          {resumenNota(hecha.notaFiscal) && (
            <span className="mt-1 block">
              {hecha.notaFiscal?.estado === "emitida"
                ? "Quedó la "
                : "Sin nota: "}
              {resumenNota(hecha.notaFiscal)}.
            </span>
          )}
          {hecha.estado && hecha.estado !== "completa" && (
            <span className="mt-1 block">
              Quedó a medias (falta {hecha.estado === "pendiente_caja" ? "la salida de caja" : "algún paso"}).
              Complétala desde «Devoluciones a medias», en Ventas, o desde el
              detalle de la venta.
            </span>
          )}
          {nombreElegido && (hecha.aSaldoFavor ?? 0) > 0 && (
            <span className="mt-1 block">
              Le quedaron <strong>{money(hecha.aSaldoFavor ?? 0)}</strong> a
              favor a {nombreElegido}.
            </span>
          )}
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

      {devoluciones.length > 0 && !hecha && (
        <FormAlert tone="info">
          Esta venta ya tuvo {devoluciones.length} devolución(es) por{" "}
          <strong>
            {money(devoluciones.reduce((s, r) => s + r.refundTotal, 0))}
          </strong>
          . Abajo solo puedes devolver lo que queda.
        </FormAlert>
      )}

      {sinNadaQueDevolver && (
        <FormAlert tone="warning" icon={TriangleAlert}>
          De esta venta ya se devolvió todo.
        </FormAlert>
      )}

      {saleId && previas.some((r) => r.estado && r.estado !== "completa") && (
        <DevolucionesVenta
          saleId={saleId}
          canComplete={canRefund}
          version={hecha ? 1 : 0}
          onChanged={onDone}
        />
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
                          {/* Cantidad, no número pelado: con `type="number"`
                              un "1500" de gramos se leía como una fila de
                              dígitos que hay que contar con el dedo. */}
                          <QuantityInput
                            className="h-9 w-24 text-right"
                            aria-label={`Cantidad devuelta de ${f.line.name}`}
                            placeholder="—"
                            disabled={f.disponible <= 0}
                            value={f.texto === "" ? null : Number(f.texto)}
                            onValueChange={(v) =>
                              setCantidades((prev) => ({
                                ...prev,
                                [f.line.productId]: v === null ? "" : String(v),
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

            {pideCliente && (
              <Field
                id="dv-cliente"
                label="A quién le queda el saldo"
                required
                hint="La venta no tiene cliente registrado. El saldo queda a nombre de quien elijas y lo puede gastar en su próxima compra."
              >
                <NativeSelect
                  id="dv-cliente"
                  value={clienteId}
                  onChange={setClienteId}
                  disabled={saving || clientes === null}
                  placeholder={
                    clientes === null && !errorClientes
                      ? "Cargando clientes…"
                      : "Selecciona un cliente…"
                  }
                  options={(clientes ?? []).map((c) => ({
                    value: c._id,
                    label: `${c.name} · ${c.docType} ${c.docNumber}`,
                  }))}
                />
              </Field>
            )}

            {pideCliente && errorClientes && (
              <FormAlert tone="warning" icon={TriangleAlert}>
                No se pudieron cargar los clientes.{" "}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => setIntentoClientes((n) => n + 1)}
                >
                  Reintentar
                </button>
              </FormAlert>
            )}

            {pideCliente && clientes !== null && clientes.length === 0 && (
              <FormAlert tone="warning" icon={TriangleAlert}>
                Todavía no hay clientes registrados. Regístralo desde el cobro
                o en Clientes, o devuelve en efectivo o por transferencia.
              </FormAlert>
            )}

            <FormAlert tone="info">{AVISO_DEVOLUCION_PARCIAL}</FormAlert>

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
