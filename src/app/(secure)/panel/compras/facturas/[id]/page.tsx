"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  Save,
  ScanLine,
  ShieldOff,
  Split,
  TriangleAlert,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  applyInvoiceScan,
  getInvoiceScan,
  splitInvoiceScan,
  updateInvoiceScan,
  LINE_TARGET_LABELS,
  type ExtractedInvoice,
  type InvoiceScan,
  type LineDecision,
  type LineTarget,
} from "@/lib/erp/api-invoice-scans"
import { listSedes, listProducts, type InvProduct, type Sede } from "@/lib/erp/api-inventory"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { listCategories as listFinanceCategories, type FinanceCategory } from "@/lib/erp/api-finance"
import { errorMessage, fmtDate, money } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"

/** Diferencia aceptable entre la suma de las líneas y el total impreso. */
const TOLERANCIA = 100

const TARGETS: LineTarget[] = ["inventory", "expense", "ignore"]

/** Etiqueta de cómo se emparejó la línea, para que se vea de dónde sale. */
const MATCH_LABELS: Record<string, string> = {
  alias: "Emparejado por historial",
  barcode: "Por código de barras",
  sku: "Por SKU",
  name: "Por nombre parecido",
  manual: "Elegido a mano",
  none: "Sin emparejar",
}

export default function RevisarFacturaPage() {
  const params = useParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")

  const [scan, setScan] = React.useState<InvoiceScan | null>(null)
  const [draft, setDraft] = React.useState<ExtractedInvoice | null>(null)
  const [decisions, setDecisions] = React.useState<LineDecision[]>([])
  const [supplierId, setSupplierId] = React.useState<string>("")
  const [sedeId, setSedeId] = React.useState<string>("")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<InvProduct[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [applying, setApplying] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, sedeList, supplierList, productList, categoryList] =
        await Promise.all([
          getInvoiceScan(id),
          listSedes().catch(() => []),
          listSuppliers().catch(() => []),
          listProducts().catch(() => []),
          listFinanceCategories().catch(() => []),
        ])
      setScan(data)
      setDraft(data.draft ?? null)
      setDecisions(data.lineDecisions ?? [])
      setSupplierId(data.supplierId ?? "")
      setSedeId(data.sedeId ?? "")
      setSedes(sedeList)
      setSuppliers(supplierList)
      setProducts(productList)
      // Los ingresos no son destino de un gasto de compra.
      setCategories(categoryList.filter((c) => c.kind !== "income"))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  // ─── Edición local ────────────────────────────────────────────────────────

  function patchLine(index: number, patch: Record<string, unknown>) {
    setDraft((current) => {
      if (!current) return current
      const lines = current.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      )
      return { ...current, lines }
    })
  }

  function patchDecision(lineIndex: number, patch: Partial<LineDecision>) {
    setDecisions((current) => {
      const found = current.find((d) => d.lineIndex === lineIndex)
      if (!found) {
        return [
          ...current,
          { lineIndex, target: "inventory", createProduct: false, ...patch },
        ]
      }
      return current.map((d) =>
        d.lineIndex === lineIndex ? { ...d, ...patch, matchedBy: "manual" } : d,
      )
    })
  }

  function decisionFor(lineIndex: number): LineDecision {
    return (
      decisions.find((d) => d.lineIndex === lineIndex) ?? {
        lineIndex,
        target: "ignore",
        createProduct: false,
      }
    )
  }

  async function handleSave(): Promise<boolean> {
    if (!scan || !draft) return false
    setSaving(true)
    try {
      const updated = await updateInvoiceScan(scan._id, {
        draft,
        supplierId: supplierId || null,
        sedeId: sedeId || null,
        lineDecisions: decisions,
      })
      setScan(updated)
      toast.success("Cambios guardados")
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleApply() {
    if (!scan) return
    const ok = await confirm({
      title: "¿Aplicar esta factura?",
      description:
        "Se creará la compra con su entrada de inventario y su cuenta por pagar, y los gastos de las líneas que no son mercancía.",
      confirmLabel: "Aplicar",
    })
    if (!ok) return

    setApplying(true)
    try {
      // Se guarda antes de aplicar: lo que se aplica es lo que está en el
      // servidor, no lo que se ve en pantalla.
      if (!(await handleSave())) return
      await applyInvoiceScan(scan._id)
      toast.success("Factura aplicada al inventario y a la contabilidad")
      router.push("/panel/compras/facturas")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setApplying(false)
    }
  }

  async function handleSplit(pageIndex: number) {
    if (!scan) return
    try {
      await splitInvoiceScan(scan._id, pageIndex)
      toast.success("Página separada en una factura aparte")
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  // ─── Cálculos de apoyo ────────────────────────────────────────────────────

  const sumaLineas = React.useMemo(() => {
    if (!draft) return 0
    return draft.lines.reduce((total, line, index) => {
      if (decisionFor(index).target === "ignore") return total
      const valor = line.lineTotal ?? (line.unitCost ?? 0) * (line.qty ?? 1)
      return total + valor
    }, 0)
  }, [draft, decisions]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalLeido = draft?.totals?.total
  const descuadre =
    totalLeido != null && Math.abs(totalLeido - sumaLineas) > TOLERANCIA

  if (!canView) {
    return (
      <>
        <PageHeader section="Comercial" title="Revisar factura" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
          </CardContent>
        </Card>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader section="Comercial" title="Revisar factura" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!scan || !draft) {
    return (
      <>
        <PageHeader section="Comercial" title="Revisar factura" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ScanLine className="size-9 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Esta factura todavía no se ha leído o no existe.
            </p>
            <Button render={<Link href="/panel/compras/facturas" />}>
              Volver al listado
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const aplicada = scan.status === "applied"
  const editable = canManage && !aplicada

  return (
    <>
      <PageHeader
        section="Comercial"
        title="Revisar factura"
        description="Corrige lo que haga falta y aprueba. Nada entra al inventario hasta que lo apliques."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" render={<Link href="/panel/compras/facturas" />}>
              <ArrowLeft className="size-4" aria-hidden />
              Volver
            </Button>
            {editable && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  Guardar
                </Button>
                <Button onClick={handleApply} disabled={applying}>
                  {applying ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  Aplicar
                </Button>
              </>
            )}
          </div>
        }
      />

      {aplicada && (
        <Card className="mb-4 border-success/40">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="size-5 text-success-ink" aria-hidden />
            <p className="text-sm">
              Esta factura ya se aplicó. Queda como historial y no se puede
              modificar.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* ── Proveedor ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Proveedor</CardTitle>
              <CardDescription>
                {scan.supplierMatch === "matched"
                  ? "Reconocido por el NIT de la factura."
                  : draft.supplier?.name
                    ? "No está registrado: al aplicar se creará con estos datos, o elige uno existente."
                    : "No se pudo leer el proveedor: elige uno o completa sus datos."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-supplier">Proveedor registrado</Label>
                <Select
                  value={supplierId || "none"}
                  items={{
                    none: "Crear con los datos leídos",
                    ...Object.fromEntries(suppliers.map((s) => [s._id, s.name])),
                  }}
                  onValueChange={(v) => {
                    if (v !== null) setSupplierId(v === "none" ? "" : v)
                  }}
                  disabled={!editable}
                >
                  <SelectTrigger id="f-supplier" className="w-full">
                    <SelectValue placeholder="Elige un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Crear con los datos leídos
                    </SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name} · {s.docNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-sede">Sede de destino</Label>
                <Select
                  value={sedeId || "none"}
                  items={{
                    none: "Elige la sede",
                    ...Object.fromEntries(sedes.map((s) => [s._id, s.name])),
                  }}
                  onValueChange={(v) => {
                    if (v !== null) setSedeId(v === "none" ? "" : v)
                  }}
                  disabled={!editable}
                >
                  <SelectTrigger id="f-sede" className="w-full">
                    <SelectValue placeholder="Elige la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Elige la sede</SelectItem>
                    {sedes.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-supname">Nombre leído</Label>
                <Input
                  id="f-supname"
                  value={draft.supplier?.name ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      supplier: { ...draft.supplier, name: e.target.value },
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-nit">NIT leído</Label>
                <Input
                  id="f-nit"
                  value={draft.supplier?.docNumber ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      supplier: { ...draft.supplier, docNumber: e.target.value },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Datos del documento ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Datos de la factura
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-number">Número</Label>
                <Input
                  id="f-number"
                  value={draft.invoice?.number ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      invoice: { ...draft.invoice, number: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-date">Fecha</Label>
                <Input
                  id="f-date"
                  type="date"
                  value={draft.invoice?.issueDate ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      invoice: { ...draft.invoice, issueDate: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-terms">Pago</Label>
                <Select
                  value={draft.invoice?.paymentTerms ?? "credito"}
                  items={{ contado: "De contado", credito: "A crédito" }}
                  onValueChange={(v) => {
                    if (v !== null) {
                      setDraft({
                        ...draft,
                        invoice: {
                          ...draft.invoice,
                          paymentTerms: v as "contado" | "credito",
                        },
                      })
                    }
                  }}
                  disabled={!editable}
                >
                  <SelectTrigger id="f-terms" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">De contado</SelectItem>
                    <SelectItem value="credito">A crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Líneas ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Renglones ({draft.lines.length})
              </CardTitle>
              <CardDescription>
                Lo que va <strong>a inventario</strong> entra como compra y suma
                stock. Lo que va <strong>a gasto</strong> (fletes, servicios) se
                registra en Finanzas. La deuda total queda como cuenta por pagar
                al proveedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-56">Descripción</TableHead>
                      <TableHead className="w-20">Cant.</TableHead>
                      <TableHead className="w-32">V/r unitario</TableHead>
                      <TableHead className="w-28">Destino</TableHead>
                      <TableHead className="min-w-56">
                        Producto / categoría
                      </TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draft.lines.map((line, index) => {
                      const decision = decisionFor(index)
                      const total =
                        line.lineTotal ?? (line.unitCost ?? 0) * (line.qty ?? 1)
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={line.description}
                              disabled={!editable}
                              onChange={(e) =>
                                patchLine(index, { description: e.target.value })
                              }
                            />
                            {decision.matchedBy && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {MATCH_LABELS[decision.matchedBy] ??
                                  decision.matchedBy}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              value={line.qty ?? ""}
                              disabled={!editable}
                              onChange={(e) =>
                                patchLine(index, {
                                  qty: e.target.value
                                    ? Number(e.target.value.replace(",", "."))
                                    : undefined,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {editable ? (
                              <MoneyInput
                                value={line.unitCost ?? null}
                                onValueChange={(v) =>
                                  patchLine(index, { unitCost: v ?? undefined })
                                }
                              />
                            ) : (
                              <span className="text-sm">
                                {line.unitCost != null
                                  ? money.format(line.unitCost)
                                  : "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={decision.target}
                              items={LINE_TARGET_LABELS}
                              onValueChange={(v) => {
                                if (v !== null) {
                                  patchDecision(index, { target: v as LineTarget })
                                }
                              }}
                              disabled={!editable}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TARGETS.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {LINE_TARGET_LABELS[t]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {decision.target === "inventory" ? (
                              <Select
                                value={decision.productId ?? "new"}
                                items={{
                                  new: "Crear producto nuevo",
                                  ...Object.fromEntries(
                                    products.map((p) => [
                                      p._id,
                                      `${p.name} · ${p.sku}`,
                                    ]),
                                  ),
                                }}
                                onValueChange={(v) => {
                                  if (v === null) return
                                  patchDecision(index, {
                                    productId: v === "new" ? null : v,
                                    createProduct: v === "new",
                                  })
                                }}
                                disabled={!editable}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Crear producto nuevo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">
                                    Crear producto nuevo
                                  </SelectItem>
                                  {products.map((p) => (
                                    <SelectItem key={p._id} value={p._id}>
                                      {p.name} · {p.sku}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : decision.target === "expense" ? (
                              <Select
                                value={decision.categoryId ?? "none"}
                                items={{
                                  none: "Elige la categoría",
                                  ...Object.fromEntries(
                                    categories.map((c) => [c._id, c.name]),
                                  ),
                                }}
                                onValueChange={(v) => {
                                  if (v === null) return
                                  patchDecision(index, {
                                    categoryId: v === "none" ? null : v,
                                  })
                                }}
                                disabled={!editable}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Elige la categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    Elige la categoría
                                  </SelectItem>
                                  {categories.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No se registra
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {money.format(total)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Cuadre ── */}
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Suma de renglones</span>
                <span className="font-medium">{money.format(sumaLineas)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Total impreso en la factura
                </span>
                <span className="font-medium">
                  {totalLeido != null ? money.format(totalLeido) : "—"}
                </span>
              </div>
              {descuadre && (
                <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  La suma de los renglones no coincide con el total de la
                  factura. Revisa cantidades y valores: puede faltar un renglón o
                  haberse leído mal un número. Puedes aplicarla igual si sabes
                  por qué difiere (descuentos o impuestos del pie).
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Columna lateral: imágenes e historial ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Imágenes ({scan.pages.length})
              </CardTitle>
              <CardDescription>
                El soporte queda guardado con la compra.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {scan.pages.map((page, index) => (
                <div key={page.imagePathname} className="flex flex-col gap-1">
                  <a href={page.imageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.imageUrl}
                      alt={`Página ${index + 1} de la factura`}
                      loading="lazy"
                      className="w-full rounded-lg border border-border object-contain"
                    />
                  </a>
                  {editable && scan.pages.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSplit(index)}
                    >
                      <Split className="size-4" aria-hidden />
                      Separar esta página
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <History className="size-4" aria-hidden />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {scan.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                [...scan.history].reverse().map((entry, index) => (
                  <div key={index} className="flex flex-col border-l-2 border-border pl-3">
                    <span className="text-sm font-medium">
                      {entry.detail ?? entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(entry.at)} · {entry.userEmail ?? "sistema"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {scan.appliedTo?.purchaseOrderId && (
            <Card>
              <CardContent className="flex flex-col gap-2 py-4 text-sm">
                <Badge variant="outline" className="w-fit">
                  Resultado
                </Badge>
                <Link
                  href="/panel/compras"
                  className="text-primary underline underline-offset-4"
                >
                  Ver la orden de compra generada
                </Link>
                {scan.appliedTo.expenseIds?.length > 0 && (
                  <Link
                    href="/panel/finanzas/gastos"
                    className="text-primary underline underline-offset-4"
                  >
                    Ver los {scan.appliedTo.expenseIds.length} gasto(s)
                    registrados
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
