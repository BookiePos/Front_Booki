"use client"

import * as React from "react"
import {
  ShieldOff,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  HandCoins,
  CheckCircle2,
  MapPin,
  PackageX,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  posProducts,
  createSale,
  PAYMENT_METHOD_LABELS,
  type PosProduct,
  type PaymentMethod,
  type Sale,
} from "@/lib/erp/api-sales"

import { PageHeader } from "@/components/erp/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

interface CartItem {
  product: PosProduct
  qty: number
}

const PAYMENT_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  credit: HandCoins,
}

/** El fiado (crédito) se cobra desde el POS de trabajadores, no del ERP. */
const ADMIN_PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "transfer"]

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PosPage() {
  const { user, hasPermission } = useAuth()
  const canSell = hasPermission("pos.sell")
  const confirm = useConfirm()

  // Sedes del usuario (JWT ∩ sedes activas de la BD).
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState("")
  const sede = sedes.find((s) => s._id === sedeId)

  const [products, setProducts] = React.useState<PosProduct[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  const [cart, setCart] = React.useState<CartItem[]>([])

  // Cobro
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)
  const [method, setMethod] = React.useState<PaymentMethod>("cash")
  const [received, setReceived] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null)
  const [completedSale, setCompletedSale] = React.useState<Sale | null>(null)

  const userSedeIds = React.useMemo(
    () => user?.sedeIds ?? [],
    [user],
  )

  React.useEffect(() => {
    if (!canSell) return
    void listSedes()
      .then((all) => {
        const mine = all.filter(
          (s) => s.active && userSedeIds.includes(s._id),
        )
        setSedes(mine)
        setSedeId((prev) => prev || (mine[0]?._id ?? ""))
      })
      .catch((err) => setError(errorMessage(err)))
  }, [canSell, userSedeIds])

  const fetchProducts = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      setProducts(await posProducts(sedeId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  React.useEffect(() => {
    if (!canSell) return
    void fetchProducts()
  }, [canSell, fetchProducts])

  // ── Carrito ────────────────────────────────────────────────────────────────

  function addToCart(p: PosProduct) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product._id === p._id)
      if (existing) {
        if (existing.qty >= p.stock) return prev
        return prev.map((i) =>
          i.product._id === p._id ? { ...i, qty: i.qty + 1 } : i,
        )
      }
      return [...prev, { product: p, qty: 1 }]
    })
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product._id !== productId) return i
          const next = Math.min(i.qty + delta, i.product.stock)
          return { ...i, qty: next }
        })
        .filter((i) => i.qty > 0),
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product._id !== productId))
  }

  async function handleSedeChange(next: string) {
    if (next === sedeId) return
    if (cart.length > 0) {
      const ok = await confirm({
        title: "¿Cambiar de sede?",
        description: "Cambiar de sede vacía la cuenta actual.",
        destructive: true,
      })
      if (!ok) return
    }
    setCart([])
    setSedeId(next)
  }

  const total = cart.reduce(
    (sum, i) => sum + i.qty * i.product.salePrice,
    0,
  )

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, search])

  // ── Cobro ──────────────────────────────────────────────────────────────────

  function openCheckout() {
    setMethod("cash")
    setReceived("")
    setCheckoutError(null)
    setCompletedSale(null)
    setCheckoutOpen(true)
  }

  const receivedNum = received ? Number(received) : undefined
  const change =
    method === "cash" && receivedNum !== undefined && receivedNum >= total
      ? receivedNum - total
      : undefined

  async function handleConfirm() {
    setSaving(true)
    setCheckoutError(null)
    try {
      const sale = await createSale({
        sedeId,
        lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
        payment: {
          method,
          received: method === "cash" ? receivedNum : undefined,
        },
      })
      setCompletedSale(sale)
      setCart([])
      void fetchProducts()
    } catch (err) {
      setCheckoutError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Sin permiso ────────────────────────────────────────────────────────────
  if (!canSell) {
    return (
      <>
        <PageHeader
          section="Operación"
          title="Punto de venta"
          description="Venta rápida por sede con descuento de inventario."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para vender en el punto de venta. Contacta al
              administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        section="Operación"
        title="Punto de venta"
        description="Venta rápida por sede con descuento de inventario."
        actions={
          sedes.length > 1 ? (
            <Select
              value={sedeId}
              items={Object.fromEntries(sedes.map((s) => [s._id, s.name]))}
              onValueChange={(v) => {
                if (v !== null) handleSedeChange(v)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleccionar sede" />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : sede ? (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
              <MapPin className="size-4" />
              {sede.name}
            </Badge>
          ) : null
        }
      />

      {sedes.length === 0 && !loading && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <MapPin className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">
              Sin sede asignada
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Tu usuario no tiene sedes asignadas. Pide al administrador que te
              asigne una en Configuración → Usuarios y roles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ── Catálogo ── */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o SKU…"
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-destructive">
                  {error}
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                  <PackageX className="size-9 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {products.length === 0
                      ? "No hay productos con precio de venta. Asigna precios en Inventario."
                      : "Sin resultados para la búsqueda."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map((p) => {
                  const inCart =
                    cart.find((i) => i.product._id === p._id)?.qty ?? 0
                  const out = p.stock <= 0 || inCart >= p.stock
                  return (
                    <button
                      key={p._id}
                      type="button"
                      disabled={out}
                      onClick={() => addToCart(p)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent",
                        out && "cursor-not-allowed opacity-50 hover:bg-card",
                      )}
                    >
                      <span className="line-clamp-2 font-medium leading-snug">
                        {p.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.sku}
                      </span>
                      <span className="mt-1 flex w-full items-center justify-between">
                        <span className="font-display text-lg">
                          {money.format(p.salePrice)}
                        </span>
                        <Badge
                          variant={p.stock <= 0 ? "destructive" : "outline"}
                        >
                          {p.stock <= 0
                            ? "Agotado"
                            : `${nf.format(p.stock)} ${p.unit}`}
                        </Badge>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Cuenta ── */}
          <Card className="h-fit lg:sticky lg:top-4">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-muted-foreground" />
                <p className="font-display text-lg">Cuenta</p>
                {cart.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {cart.reduce((s, i) => s + i.qty, 0)} ítem(s)
                  </Badge>
                )}
              </div>

              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Toca un producto para agregarlo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cart.map((i) => (
                    <li
                      key={i.product._id}
                      className="flex items-center gap-2 rounded-lg border border-border p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {money.format(i.product.salePrice)} ·{" "}
                          {money.format(i.qty * i.product.salePrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Restar uno"
                          onClick={() => changeQty(i.product._id, -1)}
                        >
                          <Minus />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {nf.format(i.qty)}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Sumar uno"
                          disabled={i.qty >= i.product.stock}
                          onClick={() => changeQty(i.product._id, 1)}
                        >
                          <Plus />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar ${i.product.name}`}
                          onClick={() => removeFromCart(i.product._id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-sm">{money.format(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-2xl">
                  {money.format(total)}
                </span>
              </div>

              <Button
                size="lg"
                disabled={cart.length === 0 || !sedeId}
                onClick={openCheckout}
              >
                Cobrar {total > 0 ? money.format(total) : ""}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Sheet de cobro ── */}
      <Sheet
        open={checkoutOpen}
        onOpenChange={(v) => {
          if (saving) return
          setCheckoutOpen(v)
        }}
      >
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {completedSale ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <CheckCircle2 className="size-14 text-green-600" />
              <p className="font-display text-2xl">Venta registrada</p>
              <Badge variant="outline" className="px-3 py-1.5 font-mono text-base">
                {completedSale.saleNumber}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Total {money.format(completedSale.total)} ·{" "}
                {PAYMENT_METHOD_LABELS[completedSale.payment.method]}
                {completedSale.payment.change !== undefined &&
                completedSale.payment.change > 0
                  ? ` · Cambio ${money.format(completedSale.payment.change)}`
                  : ""}
              </p>
              <Button
                size="lg"
                className="mt-2"
                onClick={() => setCheckoutOpen(false)}
              >
                Nueva venta
              </Button>
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-lg">Cobrar</SheetTitle>
                <SheetDescription>
                  {sede ? `${sede.name} · ` : ""}
                  Total a cobrar {money.format(total)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Medio de pago</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
                    {ADMIN_PAYMENT_METHODS.map((key) => {
                      const label = PAYMENT_METHOD_LABELS[key]
                      const Icon = PAYMENT_ICONS[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMethod(key)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                            method === key
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {method === "cash" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pos-received">Recibido</Label>
                    <Input
                      id="pos-received"
                      type="number"
                      min="0"
                      step="any"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder={String(total)}
                    />
                    <p className="text-sm text-muted-foreground">
                      {change !== undefined
                        ? `Cambio: ${money.format(change)}`
                        : receivedNum !== undefined && receivedNum < total
                          ? "El monto recibido no alcanza"
                          : "Ingresa cuánto entrega el cliente (opcional)"}
                    </p>
                  </div>
                )}

                {checkoutError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {checkoutError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setCheckoutOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={
                      saving ||
                      cart.length === 0 ||
                      (method === "cash" &&
                        receivedNum !== undefined &&
                        receivedNum < total)
                    }
                    onClick={() => void handleConfirm()}
                  >
                    {saving
                      ? "Registrando…"
                      : `Confirmar ${money.format(total)}`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
