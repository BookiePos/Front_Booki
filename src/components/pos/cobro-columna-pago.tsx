"use client"

import * as React from "react"
import { Banknote, HandCoins, CalendarClock, Split } from "lucide-react"
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/pos/api-sales"
import {
  type Customer as RegCustomer,
  type EmployeeLookup,
} from "@/lib/pos/api-customers"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { NativeSelect } from "@/components/ui/field"
import {
  initialSplitRows,
  type SplitRow,
  type SplitSummary,
} from "@/lib/pos/split-payment"
import { Termino } from "@/components/ui/help-tip"
import { CheckoutColumn, OptionGroup } from "@/components/pos/checkout-layout"
import { cn } from "@/lib/utils"
import { PAYMENT_ICONS } from "@/components/pos/venta-helpers"
import { SplitPaymentEditor } from "@/components/pos/split-payment-editor"
import { PagoDigitalDetalle } from "@/components/pos/pago-digital-detalle"
import type { DigitalDetail } from "@/lib/pos/pago-digital"
import type { CobroDigital } from "@/lib/pos/api-inventory"

interface CobroColumnaPagoProps {
  method: PaymentMethod
  setMethod: React.Dispatch<React.SetStateAction<PaymentMethod>>
  received: number | null
  setReceived: React.Dispatch<React.SetStateAction<number | null>>
  splitOn: boolean
  setSplitOn: React.Dispatch<React.SetStateAction<boolean>>
  splitRows: SplitRow[]
  setSplitRows: React.Dispatch<React.SetStateAction<SplitRow[]>>
  usesCredit: boolean
  creditDue: string
  setCreditDue: React.Dispatch<React.SetStateAction<string>>
  debtorType: "customer" | "employee"
  setDebtorType: React.Dispatch<React.SetStateAction<"customer" | "employee">>
  custId: string
  empId: string
  setEmpId: React.Dispatch<React.SetStateAction<string>>
  regCustomers: RegCustomer[]
  empList: EmployeeLookup[]
  ncOpen: boolean
  setNcOpen: React.Dispatch<React.SetStateAction<boolean>>
  ncName: string
  setNcName: React.Dispatch<React.SetStateAction<string>>
  ncDoc: string
  setNcDoc: React.Dispatch<React.SetStateAction<string>>
  ncPhone: string
  setNcPhone: React.Dispatch<React.SetStateAction<string>>
  ncBusy: boolean
  elegirCliente: (id: string, lista?: RegCustomer[]) => void
  quickAddCustomer: () => Promise<void>
  netTotal: number
  receivedNum: number | undefined
  change: number | undefined
  suggestions: number[]
  split: SplitSummary | null
  /** Detalle del medio digital elegido (ítem 6.4). */
  digital: DigitalDetail
  setDigital: (d: DigitalDetail) => void
  /** QR / llave Bre-B de la sede. */
  cobro?: CobroDigital
}

export function CobroColumnaPago({
  method,
  setMethod,
  received,
  setReceived,
  splitOn,
  setSplitOn,
  splitRows,
  setSplitRows,
  usesCredit,
  creditDue,
  setCreditDue,
  debtorType,
  setDebtorType,
  custId,
  empId,
  setEmpId,
  regCustomers,
  empList,
  ncOpen,
  setNcOpen,
  ncName,
  setNcName,
  ncDoc,
  setNcDoc,
  ncPhone,
  setNcPhone,
  ncBusy,
  elegirCliente,
  quickAddCustomer,
  netTotal,
  receivedNum,
  change,
  suggestions,
  split,
  digital,
  setDigital,
  cobro,
}: CobroColumnaPagoProps) {
  return (
    <CheckoutColumn
      title="Cómo paga"
      icon={Banknote}
      className="max-lg:order-1 lg:bg-muted/20"
    >
      {!splitOn ? (
        <OptionGroup
          ariaLabel="Medio de pago"
          value={method}
          onChange={setMethod}
          size="lg"
          columns={2}
          options={(
            Object.entries(PAYMENT_METHOD_LABELS) as [
              PaymentMethod,
              string,
            ][]
          ).map(([key, lbl]) => ({
            value: key,
            label: lbl,
            icon: PAYMENT_ICONS[key],
          }))}
        />
      ) : (
        <SplitPaymentEditor
          rows={splitRows}
          onChange={setSplitRows}
          due={netTotal}
          remaining={split?.remaining ?? 0}
          change={split?.change ?? 0}
          error={split?.error ?? null}
          cobro={cobro}
        />
      )}

      {/* Dividir pago (ítem 6.9): efectivo + tarjeta, etc., en el
          mismo tiquete. No divide la cuenta: eso es por productos. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          if (splitOn) {
            setSplitOn(false)
            setSplitRows([])
          } else {
            setSplitRows(initialSplitRows(method))
            setSplitOn(true)
          }
        }}
      >
        <Split className="size-4" />
        {splitOn ? "Un solo medio de pago" : "Dividir pago"}
      </Button>

      {/* ¿Con cuánto paga? Con la devuelta enorme: es la cuenta que
          el cajero hace de cabeza con el cliente esperando, y antes
          quedaba al fondo de un formulario de catorce bloques. */}
      {!splitOn && method === "cash" && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
          <Label htmlFor="pos-received" className="text-[0.8125rem]">
            ¿Con cuánto paga?
          </Label>
          <MoneyInput
            id="pos-received"
            value={received}
            onValueChange={setReceived}
            placeholder={new Intl.NumberFormat("es-CO").format(netTotal)}
            className="h-14 text-xl"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant={receivedNum === netTotal ? "default" : "outline"}
              size="sm"
              onClick={() => setReceived(netTotal)}
            >
              Exacto
            </Button>
            {suggestions.map((s) => (
              <Button
                key={s}
                type="button"
                variant={receivedNum === s ? "default" : "outline"}
                size="sm"
                onClick={() => setReceived(s)}
              >
                {money(s)}
              </Button>
            ))}
          </div>
          <div
            role="status"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-5 text-center",
              change !== undefined
                ? "bg-success/10 text-success-ink"
                : receivedNum !== undefined && receivedNum < netTotal
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {change !== undefined ? (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Devuelta
                </span>
                <span className="stat-figure text-4xl leading-none sm:text-5xl">
                  {money(change)}
                </span>
              </>
            ) : receivedNum !== undefined && receivedNum < netTotal ? (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Faltan
                </span>
                <span className="stat-figure text-3xl leading-none">
                  {money(netTotal - receivedNum)}
                </span>
              </>
            ) : (
              <span className="text-sm">
                Escribe con cuánto paga y aquí sale la devuelta.
              </span>
            )}
          </div>
        </div>
      )}

      {!splitOn && (method === "card" || method === "transfer") && (
        <PagoDigitalDetalle
          method={method}
          detail={digital}
          onChange={setDigital}
          cobro={cobro}
          idBase="pos-digital"
        />
      )}

      {/* Fiado: quién queda debiendo. Va en esta columna y no en la
          de al lado porque es parte de CÓMO se paga, no un dato de
          la venta: sin deudor no hay cobro. */}
      {usesCredit && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-warning-ink">
            <HandCoins className="size-4" />
            <Termino term="credito">Venta a crédito (fiado)</Termino>
          </p>

          <OptionGroup
            ariaLabel="Quién queda debiendo"
            value={debtorType}
            onChange={setDebtorType}
            columns={2}
            className="bg-warning/15"
            options={[
              { value: "customer" as const, label: "Cliente" },
              { value: "employee" as const, label: "Empleado (nómina)" },
            ]}
          />

          {debtorType === "customer" ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-warning-ink">
                  Cliente registrado
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-warning-ink underline"
                  onClick={() => setNcOpen((v) => !v)}
                >
                  {ncOpen ? "Cancelar" : "+ Registrar"}
                </button>
              </div>
              {!ncOpen ? (
                <NativeSelect
                  value={custId}
                  onChange={(v) => elegirCliente(v)}
                  placeholder="Selecciona un cliente…"
                  aria-label="Cliente al que se le fía"
                  options={regCustomers.map((c) => ({
                    value: c._id,
                    label: `${c.name} · ${c.docType} ${c.docNumber}`,
                  }))}
                />
              ) : (
                <div className="flex flex-col gap-1.5 rounded-xl border border-warning/30 bg-background p-2">
                  <Input
                    placeholder="Nombre"
                    aria-label="Nombre del cliente nuevo"
                    value={ncName}
                    onChange={(e) => setNcName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input
                      placeholder="Cédula / NIT"
                      aria-label="Documento del cliente nuevo"
                      value={ncDoc}
                      onChange={(e) => setNcDoc(e.target.value)}
                    />
                    <Input
                      placeholder="Teléfono"
                      aria-label="Teléfono del cliente nuevo"
                      inputMode="tel"
                      value={ncPhone}
                      onChange={(e) => setNcPhone(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={ncBusy || !ncName.trim() || !ncDoc.trim()}
                    onClick={() => void quickAddCustomer()}
                  >
                    {ncBusy ? "Guardando…" : "Registrar y usar"}
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-warning-ink">
                Queda como cuenta por cobrar (CxC) del cliente.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-warning-ink">Empleado</Label>
              <NativeSelect
                value={empId}
                onChange={setEmpId}
                placeholder="Selecciona un empleado…"
                aria-label="Empleado al que se le fía"
                options={empList.map((e) => ({
                  value: e._id,
                  label: `${e.firstName} ${e.lastName} · ${e.docNumber}`,
                }))}
              />
              <p className="text-[11px] text-warning-ink">
                Se descuenta por nómina (pendiente de aprobación) y
                aparece en la colilla.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="pos-credit-due"
              className="gap-1.5 text-xs text-warning-ink"
            >
              <CalendarClock className="size-3.5" />
              Vence (opcional)
            </Label>
            <Input
              id="pos-credit-due"
              type="date"
              value={creditDue}
              onChange={(e) => setCreditDue(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
      )}
    </CheckoutColumn>
  )
}
