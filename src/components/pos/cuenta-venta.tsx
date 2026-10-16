"use client"

import * as React from "react"
import Image from "next/image"
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ClipboardList,
  X,
  ChevronDown,
  Tag,
  HandCoins,
  ImageOff,
} from "lucide-react"
import { type Order, type Discount } from "@/lib/pos/api-sales"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import { Termino } from "@/components/ui/help-tip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { CartItem, SaveState } from "@/components/pos/venta-helpers"
import { SaveIndicator } from "@/components/pos/venta-ui"

interface CuentaVentaProps {
  isRestaurant: boolean
  sedeId: string
  cart: CartItem[]
  tip: number | null
  setTip: React.Dispatch<React.SetStateAction<number | null>>
  discounts: Discount[]
  cuentaAbierta: boolean
  setCuentaAbierta: React.Dispatch<React.SetStateAction<boolean>>
  label: string
  setLabel: React.Dispatch<React.SetStateAction<string>>
  saveState: SaveState
  orderBusy: boolean
  setQty: (productId: string, next: number) => void
  changeQty: (productId: string, delta: number) => void
  removeFromCart: (productId: string) => void
  setLineDiscount: (productId: string, discountId: string | null) => void
  clearCart: () => void
  saveAsOrder: () => Promise<void>
  closeActiveOrder: () => Promise<void>
  unitPrice: (item: CartItem) => number
  discountById: Map<string, Discount>
  lineDiscount: (item: CartItem) => number
  total: number
  itemCount: number
  cartShowImages: boolean
  tipAmount: number
  suggestedTip: number
  openCheckout: () => void
  activeOrder: Order | null
  netTotal: number
  lineaActiva: CartItem | undefined
  isOrder: boolean
}

export function CuentaVenta({
  isRestaurant,
  sedeId,
  cart,
  tip,
  setTip,
  discounts,
  cuentaAbierta,
  setCuentaAbierta,
  label,
  setLabel,
  saveState,
  orderBusy,
  setQty,
  changeQty,
  removeFromCart,
  setLineDiscount,
  clearCart,
  saveAsOrder,
  closeActiveOrder,
  unitPrice,
  discountById,
  lineDiscount,
  total,
  itemCount,
  cartShowImages,
  tipAmount,
  suggestedTip,
  openCheckout,
  activeOrder,
  netTotal,
  lineaActiva,
  isOrder,
}: CuentaVentaProps) {
  return (
    <div
      className={cn(
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:z-40",
        "max-lg:max-h-[80dvh] max-lg:overflow-y-auto max-lg:overscroll-contain",
        "max-lg:transition-transform max-lg:duration-200",
        // Cerrada, la hoja se aparta entera hacia abajo: la barra resumen
        // de más abajo ocupa su sitio.
        !cuentaAbierta && "max-lg:pointer-events-none max-lg:translate-y-[110%]",
      )}
    >
      <Card
        data-tour="pos-carrito"
        className="h-fit max-lg:rounded-b-none max-lg:shadow-xl lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)]"
      >
      <CardContent className="flex flex-col gap-3 p-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <div className="flex shrink-0 items-center gap-2">
          <ShoppingCart className="size-5 text-muted-foreground" />
          <p className="font-display text-lg">
            {isOrder ? "Cuenta" : "Venta"}
          </p>
          {/* Cierra la hoja para volver al catálogo. Solo existe cuando la
              cuenta ES una hoja; en escritorio es una columna fija y no
              hay nada que cerrar. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-11 lg:hidden"
            aria-label="Ocultar la cuenta y volver al catálogo"
            onClick={() => setCuentaAbierta(false)}
          >
            <ChevronDown className="size-5" />
          </Button>
          {isOrder && activeOrder && (
            <Badge variant="outline" className="font-mono text-[11px]">
              {activeOrder.orderNumber}
            </Badge>
          )}
          {cart.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {itemCount} ítem(s)
            </Badge>
          )}
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearCart}
            >
              <Trash2 className="size-3.5" />
              Vaciar
            </Button>
          )}
        </div>

        {/* Cabecera de la cuenta abierta: etiqueta editable + estado */}
        {isOrder && (
          <div className="flex shrink-0 flex-col gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nombre de la cuenta (mesa / cliente)"
              className="h-9"
              aria-label="Nombre de la cuenta"
            />
            <div className="flex items-center justify-between">
              <SaveIndicator state={saveState} />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                disabled={orderBusy}
                onClick={() => void closeActiveOrder()}
              >
                <X className="size-3.5" />
                Cerrar cuenta
              </Button>
            </div>
          </div>
        )}

        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center lg:min-h-0 lg:flex-1 lg:justify-center">
            <ShoppingCart className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {isOrder
                ? "Cuenta abierta sin ítems. Agrega productos; se guardan solos."
                : "Toca un producto o escanea su código para agregarlo."}
            </p>
          </div>
        ) : (
          // El `-mr-1 pr-1` deja la barra de scroll fuera de las tarjetas,
          // que si no se comía el borde derecho de cada línea.
          <ul className="flex flex-col gap-2 lg:-mr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            {cart.map((i) => {
              const unit = unitPrice(i)
              const gross = i.qty * unit
              // Se tacha el de mostrador cuando la lista lo bajó: si no se
              // ve la diferencia, nadie nota que se está cobrando pactado.
              const conLista = unit !== Math.round(i.product.salePrice)
              const lineDisc = lineDiscount(i)
              const applied = i.discountId
                ? discountById.get(i.discountId)
                : undefined
              return (
              <li
                key={i.product._id}
                className={cn(
                  "rounded-lg border border-border p-2",
                  lineaActiva === i && "ring-2 ring-primary/40",
                )}
              >
                {/* Dos renglones y no uno: con el nombre, el botón de
                    descuento y el contador peleando por la misma fila, la
                    columna del carrito se desbordaba en un portátil de
                    1366 px y el "+" se salía de la tarjeta. */}
                <div className="flex items-start gap-2">
                  {/* Miniatura: a esta columna se le mira de reojo mientras
                      se atiende, y la foto se reconoce más rápido que el
                      nombre. Solo aparece si algún producto del carrito
                      tiene foto; si no, sería una fila de cuadros vacíos
                      comiéndose el ancho del nombre. */}
                  {cartShowImages &&
                    (i.product.imageUrl ? (
                      <Image
                        src={i.product.imageUrl}
                        width={36} height={36} sizes="36px"
                        alt=""
                        loading="lazy"
                        className="size-9 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground"
                        aria-hidden
                      >
                        <ImageOff className="size-4" />
                      </span>
                    ))}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[0.8125rem] font-medium leading-snug">
                      {i.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {conLista && (
                        <span className="mr-1 line-through">
                          {money(i.product.salePrice)}
                        </span>
                      )}
                      {money(unit)} ·{" "}
                      {lineDisc > 0 ? (
                        <>
                          <span className="text-muted-foreground line-through">
                            {money(gross)}
                          </span>{" "}
                          <span className="font-medium text-foreground">
                            {money(gross - lineDisc)}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-foreground">
                          {money(gross)}
                        </span>
                      )}
                    </p>
                    {applied && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                        <Tag className="size-3" />
                        {applied.name} (−{money(lineDisc)})
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar ${i.product.name}`}
                    onClick={() => removeFromCart(i.product._id)}
                  >
                    <Trash2 />
                  </Button>
                </div>

                <div className="mt-1.5 flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Restar uno"
                    onClick={() => changeQty(i.product._id, -1)}
                  >
                    <Minus />
                  </Button>
                  <QuantityInput
                    value={i.qty}
                    onValueChange={(v) => setQty(i.product._id, v ?? 0)}
                    aria-label={`Cantidad de ${i.product.name}`}
                    className="h-8 w-14 px-1 text-center text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Sumar uno"
                    disabled={i.qty >= i.product.stock}
                    onClick={() => changeQty(i.product._id, 1)}
                  >
                    <Plus />
                  </Button>
                  {discounts.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant={applied ? "default" : "outline"}
                            size="sm"
                            className="ml-auto gap-1"
                            aria-label={`Descuento para ${i.product.name}`}
                          />
                        }
                      >
                        <Tag />
                        {applied ? "Desc." : "Descuento"}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                          Descuento
                        </div>
                        <DropdownMenuItem
                          onClick={() =>
                            setLineDiscount(i.product._id, null)
                          }
                        >
                          Sin descuento
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {discounts.map((d) => (
                          <DropdownMenuItem
                            key={d._id}
                            onClick={() =>
                              setLineDiscount(i.product._id, d._id)
                            }
                          >
                            <span className="flex-1 truncate">{d.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {d.type === "percent"
                                ? `${d.value}%`
                                : money(d.value)}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
              )
            })}
          </ul>
        )}

        {/* Pie de la cuenta: propina, total y cobrar. Va aparte y sin
            encoger para que la lista de arriba sea la única que se mueve:
            el botón de cobrar no puede salirse de la pantalla nunca. */}
        <div className="flex shrink-0 flex-col gap-3">
          <Separator />

          {/* Propina (restaurante): voluntaria, se cobra encima del total. Se
              pone/quita con el 10% sugerido o un monto libre. Va arriba del
              total para que el cliente decida antes de ver el total a pagar. */}
          {isRestaurant && cart.length > 0 && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <HandCoins className="size-4 text-muted-foreground" />
                  <Termino>Propina</Termino>
                  <span className="text-xs font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </span>
                {tip !== null && (
                  <button
                    type="button"
                    onClick={() => setTip(null)}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Quitar
                  </button>
                )}
              </div>
              {tip === null ? (
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={total <= 0}
                    onClick={() => setTip(suggestedTip)}
                  >
                    10% · {money(suggestedTip)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setTip(0)}
                  >
                    Otro monto
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <MoneyInput
                    value={tip}
                    onValueChange={(v) => setTip(v ?? 0)}
                    placeholder="$0"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={total <= 0}
                    onClick={() => setTip(suggestedTip)}
                  >
                    10%
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* El total es la cifra que el cajero canta en voz alta y que el
              cliente mira: va en panel violeta y grande, no como una fila
              más de la lista. Con propina, el grande es el total a pagar. */}
          <div className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3">
            <div className="flex flex-col">
              <span className="font-display text-lg text-accent-foreground">
                {tipAmount > 0 ? "Total a pagar" : "Total"}
              </span>
              {tipAmount > 0 && (
                <span className="text-xs text-accent-foreground/70">
                  Bienes {money(total)} · Propina {money(tipAmount)}
                </span>
              )}
            </div>
            <span className="stat-figure text-[1.75rem] leading-none text-primary">
              {money(netTotal)}
            </span>
          </div>

          {/* 56px de alto: es el objetivo táctil que fija nuestro sistema de
              diseño para la acción principal del POS, y se pulsa con prisa. */}
          <Button
            data-tour="pos-cobrar"
            size="lg"
            className="h-14 text-base font-semibold shadow-[0_10px_26px_-12px_var(--primary)]"
            disabled={cart.length === 0 || !sedeId}
            onClick={openCheckout}
          >
            Cobrar {netTotal > 0 ? money(netTotal) : ""}
          </Button>

          {/* En venta directa se puede aparcar el carrito como cuenta. */}
          {!isOrder && cart.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={orderBusy}
              onClick={() => void saveAsOrder()}
            >
              <ClipboardList className="size-4" />
              Guardar como cuenta
            </Button>
          )}
        </div>
      </CardContent>
      </Card>
    </div>
  )
}
