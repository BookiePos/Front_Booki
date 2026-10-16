"use client"

import * as React from "react"
import { Download, Upload, FileUp, CheckCircle2, Loader2 } from "lucide-react"
import {
  importProducts,
  type ImportProductRow,
  type ImportResult,
} from "@/lib/erp/api-inventory"
import { parseCsv, downloadCsv } from "@/lib/erp/csv"
import { Button } from "@/components/ui/button"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { errorMessage } from "@/components/inventario/helpers"
import {
  CSV_COLUMNS,
  csvToImportRows,
  csvTemplate,
} from "@/components/inventario/csv-inventario"

// ─── Sheet de importación CSV ─────────────────────────────────────────────────

export function ImportProductsSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ImportProductRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<ImportResult | null>(null)
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
      const matrix = parseCsv(await file.text())
      const parsed = csvToImportRows(matrix)
      setFileName(file.name)
      setRows(parsed)
      if (parsed.length === 0) {
        setParseError(
          "No se detectaron filas válidas. La primera fila debe tener los encabezados (sku, name, …).",
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
      const res = await importProducts(rows)
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
      icon={FileUp}
      title="Importar productos (CSV)"
      description="Se hace match por SKU: crea los nuevos y actualiza los que ya existen. La categoría se resuelve por nombre y se crea si hace falta."
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
              {importing ? "Importando…" : "Importar"}
            </Button>
          )}
        </>
      }
    >
      {parseError && <FormAlert>{parseError}</FormAlert>}

      <FormSection
        title="El archivo"
        description="Descarga la plantilla, llénala en Excel y vuelve a subirla."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv("plantilla-inventario.csv", csvTemplate())
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
            <strong>{rows.length}</strong> fila(s) listas para importar.
          </FormAlert>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Columnas: {CSV_COLUMNS.join(", ")}. Solo <code>sku</code> y{" "}
          <code>name</code> son obligatorios; el resto es opcional.
        </p>
      </FormSection>

      {result && (
        <FormSection title="Resultado" boxed>
          <FormAlert tone="success" icon={CheckCircle2}>
            Importación completada. Creados <strong>{result.created}</strong>,
            actualizados <strong>{result.updated}</strong>, con error{" "}
            <strong>{result.errors.length}</strong>.
          </FormAlert>
          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
              {result.errors.slice(0, 50).map((er, i) => (
                <li key={i}>
                  Fila {er.row}
                  {er.sku ? ` (${er.sku})` : ""}: {er.message}
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      )}
    </FormDialog>
  )
}
