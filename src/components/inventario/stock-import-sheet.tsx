"use client"

import * as React from "react"
import {
  TriangleAlert,
  Download,
  Upload,
  FileUp,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import {
  importStock,
  type ImportStockRow,
  type ImportStockResult,
} from "@/lib/erp/api-inventory"
import { parseCsv, downloadCsv } from "@/lib/erp/csv"
import { Button } from "@/components/ui/button"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { errorMessage } from "@/components/inventario/helpers"
import {
  STOCK_IMPORT_COLUMNS,
  csvToStockRows,
  stockTemplate,
} from "@/components/inventario/csv-inventario"

export function StockImportSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ImportStockRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<ImportStockResult | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFileName(null)
    setRows([])
    setParseError(null)
    setResult(null)
    setImporting(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setParseError(null)
    try {
      const parsed = csvToStockRows(parseCsv(await file.text()))
      setFileName(file.name)
      setRows(parsed)
      if (parsed.length === 0) {
        setParseError(
          "No se detectaron filas válidas. La primera fila debe tener los encabezados (sku, sede, qty, …).",
        )
      }
    } catch {
      setParseError("No se pudo leer el archivo CSV.")
      setRows([])
    }
  }

  async function doImport() {
    if (rows.length === 0) return
    setImporting(true)
    setParseError(null)
    try {
      const res = await importStock(rows)
      setResult(res)
      onImported()
    } catch (err) {
      setParseError(errorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
      size="2xl"
      icon={Upload}
      title="Cargar existencias (CSV)"
      description="Cada fila registra una entrada de mercancía del producto (por SKU) en la sede (por nombre o código)."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button
              onClick={doImport}
              disabled={rows.length === 0 || importing}
            >
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              {importing ? "Cargando…" : "Cargar"}
            </Button>
          )}
        </>
      }
    >
      <FormAlert tone="warning" icon={TriangleAlert}>
        Importar <strong>suma</strong> las cantidades como entradas; no
        reemplaza el stock actual. Úsalo para carga inicial o recepción masiva.
      </FormAlert>

      {parseError && <FormAlert>{parseError}</FormAlert>}

      <FormSection
        title="El archivo"
        description="Descarga la plantilla, llénala en Excel y vuelve a subirla."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv("plantilla-existencias.csv", stockTemplate())
            }
          >
            <Download />
            Descargar plantilla
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp />
          <span className="truncate">{fileName ?? "Elegir archivo CSV…"}</span>
        </Button>

        {rows.length > 0 && !result && (
          <FormAlert tone="info" icon={FileUp}>
            <strong>{rows.length}</strong> entrada(s) listas para cargar.
          </FormAlert>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Columnas: {STOCK_IMPORT_COLUMNS.join(", ")}. Obligatorias:{" "}
          <code>sku</code>, <code>sede</code> y <code>qty</code>. Los
          perecederos requieren <code>expiresAt</code>.
        </p>
      </FormSection>

      {result && (
        <FormSection title="Resultado" boxed>
          <FormAlert tone="success" icon={CheckCircle2}>
            Carga completada. Entradas <strong>{result.imported}</strong>, con
            error <strong>{result.errors.length}</strong>.
          </FormAlert>
          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
              {result.errors.slice(0, 50).map((er, i) => (
                <li key={i}>
                  Fila {er.row}
                  {er.sku ? ` (${er.sku}` : ""}
                  {er.sku && er.sede
                    ? ` · ${er.sede})`
                    : er.sku
                      ? ")"
                      : ""}: {er.message}
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      )}
    </FormDialog>
  )
}
