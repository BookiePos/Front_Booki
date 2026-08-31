"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ScanLine,
  ShieldOff,
  Trash2,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  applyInvoiceScan,
  discardInvoiceScan,
  extractInvoiceScan,
  listInvoiceScans,
  uploadInvoiceScan,
  SCAN_STATUS_LABELS,
  type InvoiceScan,
  type InvoiceScanStatus,
} from "@/lib/erp/api-invoice-scans"
import { prepareImageForUpload } from "@/lib/images"
import { errorMessage, fmtDate, money } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { InvoiceCapture } from "@/components/erp/invoice-capture"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

/** Progreso de una tanda de fotos: qué se está haciendo y por cuál va. */
interface Progress {
  phase: "subiendo" | "leyendo"
  current: number
  total: number
}

function StatusBadge({ status }: { status: InvoiceScanStatus }) {
  const label = SCAN_STATUS_LABELS[status]
  if (status === "applied") {
    return (
      <Badge className="border-transparent bg-success/15 text-success-ink">
        {label}
      </Badge>
    )
  }
  if (status === "failed") return <Badge variant="destructive">{label}</Badge>
  if (status === "extracted") return <Badge variant="secondary">{label}</Badge>
  return <Badge variant="outline">{label}</Badge>
}

export default function FacturasPorFotoPage() {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")

  const [scans, setScans] = React.useState<InvoiceScan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [progress, setProgress] = React.useState<Progress | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setScans(await listInvoiceScans())
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  /**
   * Procesa la tanda de fotos **una por una**: reescala, sube y manda a leer.
   *
   * En serie y no en paralelo por dos razones: el progreso es legible ("leyendo
   * 2 de 3") y la agrupación automática de páginas necesita que la anterior ya
   * esté leída para reconocer que la siguiente es del mismo documento.
   *
   * Un fallo no aborta la tanda: esa foto queda marcada y las demás siguen.
   */
  async function handleFiles(files: File[]) {
    let fallos = 0
    for (const [index, file] of files.entries()) {
      try {
        setProgress({ phase: "subiendo", current: index + 1, total: files.length })
        const ready = await prepareImageForUpload(file, "documento")
        const scan = await uploadInvoiceScan(ready)

        setProgress({ phase: "leyendo", current: index + 1, total: files.length })
        await extractInvoiceScan(scan._id)
      } catch (err) {
        fallos += 1
        toast.error(`${file.name}: ${errorMessage(err)}`)
      }
    }
    setProgress(null)
    await load()
    if (fallos === 0) {
      toast.success(
        files.length === 1
          ? "Factura leída: revísala antes de aplicarla"
          : `${files.length} imágenes procesadas`,
      )
    }
  }

  async function handleApply(scan: InvoiceScan) {
    const ok = await confirm({
      title: "¿Aplicar esta factura?",
      description:
        "Se creará la compra con su entrada de inventario y su cuenta por pagar, y los gastos de las líneas que no son mercancía. Esta acción no se deshace desde aquí.",
      confirmLabel: "Aplicar",
    })
    if (!ok) return
    try {
      await applyInvoiceScan(scan._id)
      toast.success("Factura aplicada")
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function handleDiscard(scan: InvoiceScan) {
    const ok = await confirm({
      title: "¿Descartar esta factura?",
      description: "Se borrarán las imágenes. No afecta a nada ya aplicado.",
      confirmLabel: "Descartar",
      destructive: true,
    })
    if (!ok) return
    try {
      await discardInvoiceScan(scan._id)
      toast.success("Factura descartada")
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (!canView) {
    return (
      <>
        <PageHeader
          section="Comercial"
          title="Facturas por foto"
          description="Carga las compras fotografiando la factura del proveedor."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver las compras. Contacta al administrador
              del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const pendientes = scans.filter((s) => s.status === "extracted").length

  return (
    <>
      <PageHeader
        section="Comercial"
        title="Facturas por foto"
        description="Fotografía la factura del proveedor: se leen los datos y tú apruebas antes de que entren al inventario."
      />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Cargar facturas
            </CardTitle>
            <CardDescription>
              Puedes subir varias a la vez. Si una factura tiene dos hojas,
              fotografía las dos: se agrupan solas por el número y el NIT.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <InvoiceCapture
              onFiles={handleFiles}
              busy={progress !== null}
              hint="La foto se reescala y comprime sola antes de subirse."
            />
            {progress && (
              <div
                aria-live="polite"
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {progress.phase === "subiendo" ? "Subiendo" : "Leyendo"}{" "}
                {progress.current} de {progress.total}…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-display text-lg">Historial</CardTitle>
          <CardDescription>
            {pendientes > 0
              ? `${pendientes} factura(s) esperando tu revisión.`
              : "Todas las facturas cargadas, la más reciente primero."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, r) => (
                <Skeleton key={r} className="h-8 w-full" />
              ))}
            </div>
          ) : scans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <ScanLine className="size-9 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Todavía no has cargado ninguna factura.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans.map((scan) => {
                    const draft = scan.draft
                    const revisable =
                      scan.status === "extracted" || scan.status === "uploaded"
                    return (
                      <TableRow
                        key={scan._id}
                        className={cn(
                          scan.status === "discarded" && "opacity-55",
                        )}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {draft?.supplier?.name ?? "Sin identificar"}
                            </span>
                            {draft?.supplier?.docNumber && (
                              <span className="font-mono text-xs text-muted-foreground">
                                NIT {draft.supplier.docNumber}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {draft?.invoice?.number ?? "—"}
                          {scan.pages.length > 1 && (
                            <Badge variant="outline" className="ml-2">
                              {scan.pages.length} páginas
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {draft?.invoice?.issueDate
                            ? fmtDate(draft.invoice.issueDate)
                            : fmtDate(scan.createdAt)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {draft?.totals?.total != null
                            ? money.format(draft.totals.total)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={scan.status} />
                          {scan.status === "failed" && scan.error && (
                            <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                              {scan.error}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {revisable && (
                              <Button
                                size="sm"
                                variant="outline"
                                render={
                                  <Link
                                    href={`/panel/compras/facturas/${scan._id}`}
                                  />
                                }
                              >
                                <FileText className="size-4" aria-hidden />
                                Revisar
                              </Button>
                            )}
                            {canManage && scan.status === "extracted" && (
                              <Button size="sm" onClick={() => handleApply(scan)}>
                                <CheckCircle2 className="size-4" aria-hidden />
                                Aplicar
                              </Button>
                            )}
                            {canManage && scan.status !== "applied" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDiscard(scan)}
                              >
                                <Trash2 className="size-4" aria-hidden />
                                <span className="sr-only">Descartar</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        Los datos los lee un modelo de inteligencia artificial y pueden traer
        errores: revisa cantidades y precios antes de aplicar. Nada entra al
        inventario ni a la contabilidad sin tu aprobación.
      </p>
    </>
  )
}
