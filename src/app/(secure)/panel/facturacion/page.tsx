"use client"

import * as React from "react"
import {
  FileText,
  ShieldOff,
  Printer,
  Ban,
  CheckCircle2,
  Loader2,
  Receipt as ReceiptIcon,
  AlertTriangle,
  BookOpen,
  ChevronDown,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import { listSales, type Sale } from "@/lib/erp/api-sales"
import {
  listDocuments,
  createInvoiceFromSale,
  createCreditNote,
  type ElectronicDocument,
} from "@/lib/erp/api-einvoicing"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { FacturaElectronica } from "@/components/erp/factura-electronica"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

export default function FacturacionPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("einvoicing.issue")
  const canVoid = hasPermission("einvoicing.void")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState("")
  const [sales, setSales] = React.useState<Sale[]>([])
  const [invoiceBySale, setInvoiceBySale] = React.useState<
    Map<string, ElectronicDocument>
  >(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<ElectronicDocument | null>(null)

  const sede = sedes.find((s) => s._id === sedeId)

  // Carga inicial de sedes.
  React.useEffect(() => {
    if (!canView) return
    let active = true
    listSedes()
      .then((all) => {
        if (!active) return
        const mine = all.filter((s) => s.active)
        setSedes(mine)
        setSedeId((prev) => prev || mine[0]?._id || "")
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [canView])

  const load = React.useCallback(async () => {
    if (!sedeId) {
      setLoading(false)
      return
    }
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
      <>
        <PageHeader section="Cumplimiento" title="Facturación electrónica" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para la facturación electrónica.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const sedeSelector =
    sedes.length > 0 ? (
      <Select
        value={sedeId}
        items={Object.fromEntries(sedes.map((s) => [s._id, s.name]))}
        onValueChange={(v) => {
          if (v !== null) setSedeId(v as string)
        }}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Sede" />
        </SelectTrigger>
        <SelectContent>
          {sedes.map((s) => (
            <SelectItem key={s._id} value={s._id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : undefined

  const feReady = Boolean(sede?.resolucionFe?.claveTecnica && sede?.nit)

  return (
    <>
      <PageHeader
        section="Cumplimiento"
        title="Facturación electrónica"
        description="Genera la factura electrónica de cada venta y sus notas crédito."
        actions={sedeSelector}
      />

      {/* Normatividad DIAN (informativo) */}
      <Card className="mb-4">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium">
            <BookOpen className="size-4 text-primary" />
            Normatividad DIAN — qué exige la ley
            <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-border px-4 py-4 text-sm text-muted-foreground">
            <p>
              La <span className="font-medium text-foreground">factura
              electrónica de venta</span> es obligatoria en Colombia y se rige
              por el Estatuto Tributario (arts. 616‑1 y 617), la{" "}
              <span className="font-medium text-foreground">Resolución DIAN
              000165 de 2023</span> y el Anexo Técnico de factura electrónica
              (v1.9).
            </p>

            <div>
              <p className="mb-1 font-medium text-foreground">
                Requisitos para que sea válida
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Denominación expresa “Factura electrónica de venta”.</li>
                <li>
                  Emisor y adquiriente identificados (razón social y
                  NIT/documento; consumidor final = NIT 222222222222).
                </li>
                <li>
                  Numeración consecutiva{" "}
                  <span className="font-medium text-foreground">autorizada
                  por la DIAN</span> (resolución con prefijo, rango y vigencia).
                </li>
                <li>
                  Discriminación del IVA (e INC cuando aplique) con su tarifa.
                </li>
                <li>Formato electrónico XML estándar UBL 2.1.</li>
                <li>
                  <span className="font-medium text-foreground">CUFE</span>{" "}
                  (Código Único de Factura Electrónica), hash SHA‑384.
                </li>
                <li>
                  Firma digital con certificado de una entidad acreditada por
                  la ONAC.
                </li>
                <li>
                  <span className="font-medium text-foreground">Validación
                  previa ante la DIAN</span> (antes o al momento de entregarla
                  al cliente).
                </li>
                <li>
                  Representación gráfica con código{" "}
                  <span className="font-medium text-foreground">QR (≥ 2 cm)</span>{" "}
                  que enlaza con el CUFE.
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-1 font-medium text-foreground">Documentos</p>
              <p>
                Factura electrónica de venta, <span className="font-medium
                text-foreground">nota crédito</span> (para anular o corregir una
                factura ya emitida) y nota débito.
              </p>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <p className="mb-1 font-medium text-foreground">
                Estado en este sistema
              </p>
              <p>
                <span className="text-green-600">Listo:</span> datos fiscales del
                emisor y adquiriente, IVA discriminado, numeración por
                resolución, CUFE (Anexo 1.9) y representación gráfica con QR.
              </p>
              <p className="mt-1">
                <span className="text-amber-600">Pendiente:</span> la firma
                digital, el XML UBL 2.1 y la transmisión/validación ante la DIAN
                se habilitan al integrar un{" "}
                <span className="font-medium text-foreground">proveedor
                tecnológico (Siigo u otro)</span>. Por eso los documentos figuran
                como “sin validar DIAN”.
              </p>
            </div>

            <p className="text-xs italic">
              Resumen informativo; no sustituye la asesoría contable o
              tributaria de tu contador.
            </p>
          </div>
        </details>
      </Card>

      {sede && !feReady && (
        <Card className="mb-4 border-amber-500/40">
          <CardContent className="flex items-start gap-3 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              La sede <span className="font-medium text-foreground">{sede.name}</span>{" "}
              aún no tiene completos el NIT y la resolución de numeración DIAN
              (con clave técnica). Complétalos en{" "}
              <span className="font-medium">Sedes → editar → Facturación
              electrónica</span> para que las facturas lleven CUFE.
            </p>
          </CardContent>
        </Card>
      )}

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
                        {timeOnly(s.createdAt)} · {money.format(s.total)}
                      </p>
                    </div>

                    {invoice ? (
                      <>
                        <Badge className="border-transparent bg-green-500/10 text-green-600">
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
        <SheetContent side="right" className="overflow-y-auto sm:max-w-2xl">
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
    </>
  )
}
