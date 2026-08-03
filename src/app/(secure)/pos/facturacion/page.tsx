"use client"

import * as React from "react"
import {
  FileText,
  ShieldOff,
  MapPin,
  Printer,
  Ban,
  CheckCircle2,
  Loader2,
  Receipt as ReceiptIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import { listSales, type Sale } from "@/lib/pos/api-sales"
import {
  listDocuments,
  createInvoiceFromSale,
  createCreditNote,
  type ElectronicDocument,
} from "@/lib/pos/api-einvoicing"
import { money, timeOnly } from "@/lib/pos/format"
import { FacturaElectronica } from "@/components/pos/factura-electronica"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

export default function FacturacionPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("pos.sell")
  const canVoid = hasPermission("pos.void.authorize")
  const { sedeId, sede } = useSede()

  const [sales, setSales] = React.useState<Sale[]>([])
  const [invoiceBySale, setInvoiceBySale] = React.useState<
    Map<string, ElectronicDocument>
  >(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<ElectronicDocument | null>(null)

  const load = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const [page, docs] = await Promise.all([
        listSales(sedeId, 1, 50),
        listDocuments(sedeId),
      ])
      setSales(page.rows)
      const map = new Map<string, ElectronicDocument>()
      for (const d of docs) {
        if (d.type === "invoice" && d.saleId) map.set(d.saleId, d)
      }
      setInvoiceBySale(map)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  async function handleGenerate(sale: Sale) {
    setBusyId(sale._id)
    try {
      const doc = await createInvoiceFromSale(sale._id)
      await load()
      setSelected(doc)
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreditNote(invoice: ElectronicDocument) {
    const reason = window.prompt(
      `Motivo de la nota crédito para ${invoice.fullNumber}:`,
    )
    if (!reason || reason.trim().length < 3) return
    setBusyId(invoice._id)
    try {
      const note = await createCreditNote(invoice._id, reason.trim())
      await load()
      setSelected(note)
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldOff className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin acceso</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            No tienes permiso para la facturación. Contacta al administrador.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!sedeId) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin sede</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Selecciona una sede para facturar sus ventas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Factura electrónica</h1>
        <p className="text-sm text-muted-foreground">
          Genera la factura electrónica de cada venta{sede ? ` de ${sede.name}` : ""}.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <ReceiptIcon className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay ventas para facturar en esta sede.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sales.map((s) => {
                const invoice = invoiceBySale.get(s._id)
                const isVoid = s.status === "void"
                return (
                  <li key={s._id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.saleNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {timeOnly(s.createdAt)} · {money(s.total)}
                        {s.customer?.name ? ` · ${s.customer.name}` : ""}
                      </p>
                    </div>

                    {invoice ? (
                      <>
                        <Badge className="border-transparent bg-success/10 text-success">
                          {invoice.fullNumber}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelected(invoice)}
                        >
                          Ver
                        </Button>
                        {canVoid && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busyId === invoice._id}
                            onClick={() => void handleCreditNote(invoice)}
                          >
                            <Ban className="size-4" />
                            Nota crédito
                          </Button>
                        )}
                      </>
                    ) : isVoid ? (
                      <Badge variant="destructive">Anulada</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busyId === s._id}
                        onClick={() => void handleGenerate(s)}
                      >
                        {busyId === s._id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                        Generar factura
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Representación del documento */}
      <Sheet open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          {selected && (
            <div className="flex flex-col gap-4 px-4 py-2">
              <SheetHeader className="px-0">
                <SheetTitle className="font-display text-lg">
                  {selected.fullNumber}
                </SheetTitle>
                <SheetDescription>
                  Representación gráfica de la factura electrónica.
                </SheetDescription>
              </SheetHeader>

              <FacturaElectronica doc={selected} />

              <div className="no-print flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" />
                  Imprimir / PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled
                  title="Requiere integración con proveedor (Siigo u otro)"
                >
                  <CheckCircle2 className="size-4" />
                  Enviar a DIAN
                </Button>
                <Button className="flex-1" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
              </div>
              <p className="no-print text-center text-xs text-muted-foreground">
                El envío y validación ante la DIAN se habilitan al integrar el
                proveedor tecnológico.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
