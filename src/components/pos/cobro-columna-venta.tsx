"use client"

import * as React from "react"
import Image from "next/image"
import {
  Plus,
  Minus,
  FileText,
  ClipboardList,
  X,
  UserRound,
  Users,
  Info,
  Tag,
  ImageOff,
  UserPlus,
  Package,
  Split,
  Truck,
  ReceiptText,
} from "lucide-react"
import {
  pendingTotal,
  type SugerenciaEmpaque,
  type Order,
  type Customer,
} from "@/lib/pos/api-sales"
import {
  type Customer as RegCustomer,
  type EmployeeLookup,
} from "@/lib/pos/api-customers"
import { type PriceList } from "@/lib/erp/api-catalog"
import {
  ORDER_TYPE_LABELS,
  type DeliveryZone,
  type OrderType,
} from "@/lib/pos/api-delivery"
import { money } from "@/lib/pos/format"
import { type InvProduct } from "@/lib/pos/api-inventory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import { NativeSelect } from "@/components/ui/field"
import {
  CheckoutColumn,
  CheckoutGroup,
  OptionGroup,
} from "@/components/pos/checkout-layout"
import { cn } from "@/lib/utils"
import { nfCantidad, QUIEN_COBRA } from "@/components/pos/venta-helpers"
import { type AuthUser } from "@/lib/api"

interface CobroColumnaVentaProps {
  user: AuthUser | null
  canDiscount: boolean
  splitMode: "todo" | "items" | "partes"
  setSplitMode: React.Dispatch<React.SetStateAction<"todo" | "items" | "partes">>
  splitParts: string
  setSplitParts: React.Dispatch<React.SetStateAction<string>>
  splitQty: Record<string, string>
  setSplitQty: React.Dispatch<React.SetStateAction<Record<string, string>>>
  orderType: OrderType
  setOrderType: React.Dispatch<React.SetStateAction<OrderType>>
  zones: DeliveryZone[]
  zoneId: string
  setZoneId: React.Dispatch<React.SetStateAction<string>>
  manualFee: string
  setManualFee: React.Dispatch<React.SetStateAction<string>>
  address: string
  setAddress: React.Dispatch<React.SetStateAction<string>>
  deliveryPhone: string
  setDeliveryPhone: React.Dispatch<React.SetStateAction<string>>
  deliveryNotes: string
  setDeliveryNotes: React.Dispatch<React.SetStateAction<string>>
  courier: string
  setCourier: React.Dispatch<React.SetStateAction<string>>
  usesCredit: boolean
  showCustomer: boolean
  setShowCustomer: React.Dispatch<React.SetStateAction<boolean>>
  customer: Customer
  setCustomer: React.Dispatch<React.SetStateAction<Customer>>
  clienteModo: "final" | "registrado"
  setClienteModo: React.Dispatch<React.SetStateAction<"final" | "registrado">>
  sellerKey: string
  setSellerKey: React.Dispatch<React.SetStateAction<string>>
  empaqueAbierto: boolean
  setEmpaqueAbierto: React.Dispatch<React.SetStateAction<boolean>>
  empaques: InvProduct[]
  empaqueSel: Record<string, number>
  setEmpaqueSel: React.Dispatch<React.SetStateAction<Record<string, number>>>
  sugerencia: SugerenciaEmpaque | null
  emitInvoice: boolean
  setEmitInvoice: React.Dispatch<React.SetStateAction<boolean>>
  saveCustomer: boolean
  setSaveCustomer: React.Dispatch<React.SetStateAction<boolean>>
  custId: string
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
  priceLists: PriceList[]
  manualListId: string
  setManualListId: React.Dispatch<React.SetStateAction<string>>
  elegirCliente: (id: string, lista?: RegCustomer[]) => void
  quickAddCustomer: () => Promise<void>
  listaActiva: PriceList | null
  activeOrder: Order | null
  pagadoAntes: number
  pendiente: Map<string, number>
  splitLines: { productId: string; qty: number; }[] | undefined
  chargeTotal: number
  deliveryFee: number
  invoiceDataMissing: boolean
  vendedor: EmployeeLookup | undefined
  packagingRows: { productId: string; qty: number; }[]
}

export function CobroColumnaVenta({
  user,
  canDiscount,
  splitMode,
  setSplitMode,
  splitParts,
  setSplitParts,
  splitQty,
  setSplitQty,
  orderType,
  setOrderType,
  zones,
  zoneId,
  setZoneId,
  manualFee,
  setManualFee,
  address,
  setAddress,
  deliveryPhone,
  setDeliveryPhone,
  deliveryNotes,
  setDeliveryNotes,
  courier,
  setCourier,
  usesCredit,
  showCustomer,
  setShowCustomer,
  customer,
  setCustomer,
  clienteModo,
  setClienteModo,
  sellerKey,
  setSellerKey,
  empaqueAbierto,
  setEmpaqueAbierto,
  empaques,
  empaqueSel,
  setEmpaqueSel,
  sugerencia,
  emitInvoice,
  setEmitInvoice,
  saveCustomer,
  setSaveCustomer,
  custId,
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
  priceLists,
  manualListId,
  setManualListId,
  elegirCliente,
  quickAddCustomer,
  listaActiva,
  activeOrder,
  pagadoAntes,
  pendiente,
  splitLines,
  chargeTotal,
  deliveryFee,
  invoiceDataMissing,
  vendedor,
  packagingRows,
}: CobroColumnaVentaProps) {
  return (
    <CheckoutColumn
      title="De la venta"
      icon={ClipboardList}
      className="max-lg:order-3 max-lg:border-t max-lg:border-border"
    >
      {!usesCredit ? (
        <CheckoutGroup
          title="Cliente"
          icon={UserRound}
          defaultOpen={clienteModo === "registrado"}
          summary={
            clienteModo === "final"
              ? "Consumidor final"
              : customer.name
                ? listaActiva
                  ? `${customer.name} · lista ${listaActiva.name}`
                  : customer.name
                : "Sin elegir"
          }
        >
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">A quién se le vende</Label>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              onClick={() => {
                setClienteModo("registrado")
                setNcOpen((v) => !v)
              }}
            >
              {ncOpen ? (
                "Cancelar"
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  Agregar cliente
                </>
              )}
            </button>
          </div>
          <OptionGroup
            ariaLabel="A quién se le vende"
            value={clienteModo}
            onChange={(v) => {
              setClienteModo(v)
              if (v === "final") {
                setNcOpen(false)
                elegirCliente("")
              }
            }}
            columns={2}
            options={[
              { value: "final" as const, label: "Consumidor final" },
              { value: "registrado" as const, label: "Cliente registrado" },
            ]}
          />

          {ncOpen ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-2">
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
                {ncBusy ? "Guardando…" : "Guardar y usar en esta venta"}
              </Button>
            </div>
          ) : clienteModo === "registrado" ? (
            <NativeSelect
              value={custId}
              onChange={(v) => elegirCliente(v)}
              placeholder="Selecciona un cliente…"
              aria-label="Cliente registrado"
              options={regCustomers.map((c) => ({
                value: c._id,
                label: `${c.name} · ${c.docType} ${c.docNumber}`,
              }))}
            />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Venta sin datos del cliente. El recibo y la factura
              salen a nombre de consumidor final.
            </p>
          )}

          {/* Sin cliente registrado, el cajero puede elegir la lista
              a mano. Es decidir cobrar menos, así que va con el
              mismo permiso que un descuento. */}
          {!custId && canDiscount && priceLists.length > 0 && (
            <NativeSelect
              value={manualListId}
              onChange={setManualListId}
              placeholder="Precio de mostrador"
              aria-label="Lista de precios"
              options={priceLists.map((l) => ({
                value: l._id,
                label: `Lista: ${l.name}`,
              }))}
            />
          )}

          {listaActiva && (
            <p className="inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
              <Tag className="size-3" />
              Se cobra con la lista {listaActiva.name}.
            </p>
          )}
        </CheckoutGroup>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          En el fiado el cliente se elige junto al medio de pago: es
          quien queda debiendo.
        </p>
      )}

      {/* Quién vendió. Por omisión, quien cobra; si atendió otra
          persona se escoge aquí y la venta queda a su nombre. */}
      <CheckoutGroup
        title="Vendedor"
        icon={Users}
        summary={
          vendedor
            ? `${vendedor.firstName} ${vendedor.lastName}`
            : user?.name
              ? `${user.name} (quien cobra)`
              : "Quien cobra"
        }
      >
        <NativeSelect
          id="pos-seller"
          value={vendedor ? sellerKey : QUIEN_COBRA}
          onChange={setSellerKey}
          aria-label="Vendedor"
          options={[
            {
              value: QUIEN_COBRA,
              label: user?.name
                ? `${user.name} (quien cobra)`
                : "Quien cobra",
            },
            ...empList.map((e) => ({
              value: e._id,
              label: `${e.firstName} ${e.lastName}`,
            })),
          ]}
        />
        {empList.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Para escoger a otra persona, regístrala primero como
            empleado.
          </p>
        )}
      </CheckoutGroup>

      {/* Cómo sale el pedido. Con domicilio aparece a dónde va y
          cuánto se cobra por llevarlo, que se suma ENCIMA del total
          y sin IVA — igual que la propina. El bloque deja de
          plegarse mientras falte la dirección: esconder el campo que
          bloquea el botón de cobrar deja al cajero adivinando. */}
      <CheckoutGroup
        title="Tipo de pedido"
        icon={Truck}
        forceOpen={orderType === "domicilio" && !address.trim()}
        requiredHint="Falta la dirección"
        summary={
          orderType === "domicilio"
            ? `Domicilio · ${address.trim() || "sin dirección"}`
            : ORDER_TYPE_LABELS[orderType]
        }
      >
        <OptionGroup
          ariaLabel="Tipo de pedido"
          value={orderType}
          onChange={setOrderType}
          columns={4}
          options={(
            Object.entries(ORDER_TYPE_LABELS) as [OrderType, string][]
          ).map(([key, lbl]) => ({ value: key, label: lbl }))}
        />

        {orderType === "domicilio" && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Dirección de entrega</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle 33 #70-20, apto 302"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="300 123 4567"
                  inputMode="tel"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Quién lo lleva</Label>
                <Input
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="Nombre del repartidor"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Indicaciones</Label>
              <Input
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Timbre dañado, llamar al llegar"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Zona</Label>
              <NativeSelect
                value={zoneId}
                onChange={setZoneId}
                aria-label="Zona del domicilio"
                placeholder={
                  zones.length === 0
                    ? "No hay zonas configuradas"
                    : "Otra zona (escribo el valor)"
                }
                options={zones.map((z) => ({
                  value: z._id,
                  label: `${z.name} · ${money(z.fee)}`,
                }))}
              />
              {/* El valor a mano es para el pedido que no cae en
                  ninguna zona: es lo que se acordó en vez de
                  calcular por kilómetros. */}
              {!zoneId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Cobro del domicilio
                  </span>
                  <MoneyInput
                    value={manualFee === "" ? null : Number(manualFee)}
                    onValueChange={(v) =>
                      setManualFee(v === null ? "" : String(v))
                    }
                    aria-label="Valor del domicilio"
                    placeholder="0"
                    className="h-9 w-32 text-right"
                  />
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {deliveryFee > 0
                ? `Se cobran ${money(deliveryFee)} encima del total. El domicilio no lleva IVA.`
                : "Domicilio sin costo para el cliente."}
            </p>
          </div>
        )}
      </CheckoutGroup>

      {/* Dividir la cuenta de una mesa. Solo aparece con una cuenta
          abierta: una venta directa se cobra completa siempre. */}
      {activeOrder && (
        <CheckoutGroup
          title="Dividir la cuenta"
          icon={Split}
          summary={
            splitMode === "todo"
              ? pagadoAntes > 0
                ? `Completa · ya pagaron ${money(pagadoAntes)}`
                : "Completa"
              : splitMode === "items"
                ? "Por ítem"
                : `Entre ${splitParts || "?"} partes`
          }
        >
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Cómo se paga la cuenta</Label>
            {pagadoAntes > 0 && (
              <span className="text-[11px] text-muted-foreground">
                ya pagaron {money(pagadoAntes)}
              </span>
            )}
          </div>
          <OptionGroup
            ariaLabel="Cómo se paga la cuenta"
            value={splitMode}
            onChange={setSplitMode}
            columns={3}
            options={[
              { value: "todo" as const, label: "Completa" },
              { value: "items" as const, label: "Por ítem" },
              { value: "partes" as const, label: "Partes iguales" },
            ]}
          />

          {splitMode === "partes" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                ¿Entre cuántos se divide lo que falta?
              </Label>
              <QuantityInput
                value={splitParts === "" ? null : Number(splitParts)}
                onValueChange={(v) =>
                  setSplitParts(v === null ? "" : String(v))
                }
                decimales={0}
                aria-label="Entre cuántos se divide la cuenta"
                className="h-9 w-24 text-right"
              />
              <p className="text-[11px] text-muted-foreground">
                {Number(splitParts) > 1
                  ? "Se cobra una parte y la cuenta queda abierta con el resto. Al último ponle 1: se lleva lo que sobre."
                  : "Con 1 se cobra todo lo que falta."}
              </p>
            </div>
          )}

          {splitMode === "items" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Qué paga esta persona</Label>
              {[...pendiente.entries()]
                .filter(([, falta]) => falta > 0.0005)
                .map(([productId, falta]) => {
                  const l = activeOrder.lines.find(
                    (x) => x.productId === productId,
                  )
                  const texto = splitQty[productId] ?? ""
                  return (
                    <div
                      key={productId}
                      className="flex items-center gap-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {l?.name ?? productId}
                        <span className="text-muted-foreground">
                          {" "}
                          · faltan {nfCantidad.format(falta)}
                        </span>
                      </span>
                      <QuantityInput
                        value={texto === "" ? null : Number(texto)}
                        onValueChange={(v) =>
                          setSplitQty((prev) => ({
                            ...prev,
                            [productId]: v === null ? "" : String(v),
                          }))
                        }
                        aria-label={`Cuánto paga de ${l?.name ?? ""}`}
                        placeholder="—"
                        className="h-8 w-20 text-right"
                      />
                    </div>
                  )
                })}
              <p className="text-[11px] text-muted-foreground">
                Lo que dejes en blanco se queda pendiente para el
                siguiente.
              </p>
            </div>
          )}

          {splitLines && (
            <p className="text-[11px] font-medium text-success-ink">
              Este pago cubre {money(chargeTotal)} de{" "}
              {money(pendingTotal(activeOrder))} que faltan. La cuenta
              queda abierta.
            </p>
          )}
        </CheckoutGroup>
      )}

      {/* ── Factura electrónica ──
          Interruptor explícito, no un trámite aparte: si el cliente
          la pide, se marca aquí y sale con la venta. */}
      <CheckoutGroup
        title="Factura electrónica DIAN"
        icon={FileText}
        defaultOpen={emitInvoice}
        summary={
          emitInvoice
            ? "Se emite al confirmar"
            : "Sin factura electrónica"
        }
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={emitInvoice}
            onChange={(e) => {
              setEmitInvoice(e.target.checked)
              if (e.target.checked) setShowCustomer(true)
            }}
            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
          />
          <span className="min-w-0 text-[0.8125rem]">
            <span className="block font-medium text-foreground">
              Emitir factura electrónica
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              {emitInvoice
                ? "Se emite al confirmar. Necesitamos nombre y documento del cliente."
                : "Márcala si el cliente pide factura."}
            </span>
          </span>
        </label>

        {emitInvoice && (
          <label className="flex cursor-pointer items-center gap-3 border-t border-border pt-2.5">
            <input
              type="checkbox"
              checked={saveCustomer}
              onChange={(e) => setSaveCustomer(e.target.checked)}
              className="size-5 shrink-0 accent-[var(--primary)]"
            />
            <span className="text-[0.8125rem] text-foreground">
              Guardar el cliente para próximas facturas
            </span>
          </label>
        )}
      </CheckoutGroup>

      {/* Datos del cliente para el papel. Se abren solos al pedir
          factura y dejan de plegarse mientras falten: descubrirlo
          después de cobrar obligaría a anular la venta. */}
      <CheckoutGroup
        title="Datos para la factura"
        icon={ReceiptText}
        open={showCustomer}
        onOpenChange={setShowCustomer}
        forceOpen={invoiceDataMissing}
        requiredHint="Faltan datos"
        summary={
          customer.name
            ? `${customer.name}${customer.idNumber ? ` · ${customer.idNumber}` : ""}`
            : "Sin datos del cliente"
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={customer.name ?? ""}
            onChange={(e) =>
              setCustomer((c) => ({ ...c, name: e.target.value }))
            }
            placeholder="Nombre"
            aria-label="Nombre del cliente"
          />
          <Input
            value={customer.idNumber ?? ""}
            onChange={(e) =>
              setCustomer((c) => ({
                ...c,
                idNumber: e.target.value,
              }))
            }
            placeholder="Cédula / NIT"
            aria-label="Identificación del cliente"
          />
          <Input
            value={customer.phone ?? ""}
            onChange={(e) =>
              setCustomer((c) => ({ ...c, phone: e.target.value }))
            }
            placeholder="Teléfono"
            aria-label="Teléfono del cliente"
          />
          <Input
            value={customer.email ?? ""}
            onChange={(e) =>
              setCustomer((c) => ({ ...c, email: e.target.value }))
            }
            placeholder="Correo"
            aria-label="Correo del cliente"
          />
        </div>
        {invoiceDataMissing && (
          <p className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Para la factura electrónica hace falta el nombre y la
            cédula o NIT del cliente.
          </p>
        )}
      </CheckoutGroup>

      {/* Con qué empaque sale la venta. Lo que quede marcado aquí
          es EXACTAMENTE lo que baja del inventario: la ficha del
          producto ya no descuenta por su cuenta. Por eso abre con
          la sugerencia puesta y no vacío. */}
      <CheckoutGroup
        title="Empaques"
        icon={Package}
        open={empaqueAbierto}
        onOpenChange={setEmpaqueAbierto}
        summary={
          packagingRows.length > 0
            ? packagingRows
                .map((r) => {
                  const e = empaques.find(
                    (p) => p._id === r.productId,
                  )
                  return `${r.qty} ${e?.name ?? "empaque"}`
                })
                .join(" · ")
            : "Sin empaques"
        }
      >
        <p className="text-[11px] text-muted-foreground">
          Lo que quede marcado sale del inventario y suma al costo
          de la venta; al cliente no se le cobra.
        </p>

        {/* De dónde salió lo que está marcado. Importa decirlo: es
            la diferencia entre "el sistema se acordó" y "el sistema
            se lo inventó", y quien cobra decide distinto según
            cuál de las dos sea. */}
        {sugerencia && sugerencia.origen !== "ninguno" && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {sugerencia.origen === "historial"
              ? `Como las últimas ${sugerencia.apoyo} ${
                  sugerencia.apoyo === 1 ? "vez" : "veces"
                } que vendiste esto.`
              : "Según el empaque de la ficha de cada producto."}
          </p>
        )}

        {empaques.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Todavía no hay empaques registrados. Se cargan en
            Inventario → Empaques.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {empaques.map((e) => {
                const qty = empaqueSel[e._id] ?? 0
                return (
                  <div
                    key={e._id}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl border p-2 transition-colors",
                      qty > 0
                        ? "border-primary/50 bg-primary/5"
                        : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 text-left"
                      aria-label={`Agregar ${e.name}`}
                      onClick={() =>
                        setEmpaqueSel((s) => ({
                          ...s,
                          [e._id]: (s[e._id] ?? 0) + 1,
                        }))
                      }
                    >
                      {e.imageUrl ? (
                        <Image
                          src={e.imageUrl}
                          width={40} height={40} sizes="40px"
                          alt=""
                          loading="lazy"
                          className="size-10 shrink-0 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"
                          aria-hidden
                        >
                          <ImageOff className="size-4" />
                        </span>
                      )}
                      <span className="line-clamp-2 min-w-0 text-[0.8125rem] leading-snug font-medium text-balance">
                        {e.name}
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={qty === 0}
                        aria-label={`Quitar uno de ${e.name}`}
                        onClick={() =>
                          setEmpaqueSel((s) => ({
                            ...s,
                            [e._id]: Math.max((s[e._id] ?? 0) - 1, 0),
                          }))
                        }
                      >
                        <Minus />
                      </Button>
                      <QuantityInput
                        value={qty}
                        decimales={0}
                        aria-label={`Cantidad de ${e.name}`}
                        className="h-8 flex-1 text-center"
                        onValueChange={(v) =>
                          setEmpaqueSel((s) => ({
                            ...s,
                            [e._id]: Math.max(v ?? 0, 0),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Agregar uno de ${e.name}`}
                        onClick={() =>
                          setEmpaqueSel((s) => ({
                            ...s,
                            [e._id]: (s[e._id] ?? 0) + 1,
                          }))
                        }
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={packagingRows.length === 0}
              onClick={() => setEmpaqueSel({})}
            >
              <X className="size-4" />
              Sin empaques
            </Button>
          </>
        )}
      </CheckoutGroup>
    </CheckoutColumn>
  )
}
