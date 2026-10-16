"use client"

import * as React from "react"
import {
  Check,
  TriangleAlert,
  Download,
  CheckCircle2,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  ClipboardList,
} from "lucide-react"
import {
  getStock,
  applyStockCount,
  type Sede,
  type InvProduct,
  type StockCountResult,
} from "@/lib/erp/api-inventory"
import { unidadCorta } from "@/lib/erp/unidades"
import { serializeCsv, downloadCsv } from "@/lib/erp/csv"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { QuantityInput } from "@/components/ui/money-input"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import {
  nf,
  money,
  normalizeName,
  errorMessage,
} from "@/components/inventario/helpers"
import { LIMITE_FILAS } from "@/components/inventario/precios-dialog"

/**
 * Una fila de la planilla de conteo. Memorizada por lo mismo que las de
 * precios: al escribir en una casilla se re-renderiza el diálogo entero, y con
 * ciento veinte insumos cada tecla se sentiría pegajosa.
 */
export const FilaConteo = React.memo(function FilaConteo({
  p,
  esperado,
  valor,
  onChange,
}: {
  p: InvProduct
  esperado: number
  valor: string
  onChange: (id: string, valor: string) => void
}) {
  const n = Number(valor)
  const contado = valor.trim() !== "" && Number.isFinite(n) && n >= 0
  const diferencia = contado ? n - esperado : null
  const cuadra = diferencia !== null && Math.abs(diferencia) < 0.0005

  return (
    <TableRow
      className={
        contado && !cuadra ? "bg-brand-50/60 dark:bg-brand-950/30" : ""
      }
    >
      <TableCell className="py-2">
        <p className="font-medium leading-tight">{p.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {p.sku} · {unidadCorta(p.unit)}
        </p>
      </TableCell>
      <TableCell className="tnum py-2 text-right text-muted-foreground">
        {nf.format(esperado)}
      </TableCell>
      <TableCell className="py-2">
        {/* Sigue guardándose como texto: una casilla en blanco significa "no
            lo conté", y convertirla a cero vaciaría la sede de un plumazo. */}
        <QuantityInput
          className="h-9 w-32 text-right"
          aria-label={`Cantidad contada de ${p.name}`}
          placeholder="—"
          sufijo={unidadCorta(p.unit)}
          value={valor.trim() === "" ? null : n}
          onValueChange={(v) => onChange(p._id, v === null ? "" : String(v))}
        />
      </TableCell>
      <TableCell className="tnum py-2 text-right">
        {diferencia === null ? (
          <span className="text-muted-foreground">—</span>
        ) : cuadra ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-ink">
            <Check className="size-3.5" />
            Cuadra
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              diferencia > 0 ? "text-success-ink" : "text-destructive",
            )}
          >
            {diferencia > 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {diferencia > 0 ? "+" : ""}
            {nf.format(diferencia)}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
})

/**
 * Conteo físico de una sede: la planilla del domingo al cerrar.
 *
 * Deja la existencia en lo CONTADO. No suma — esa es toda la diferencia con la
 * carga masiva de existencias, que registra cada fila como entrada de
 * mercancía: usar aquella para contar duplica el inventario.
 *
 * La regla que gobierna esta pantalla: **solo viaja lo que alguien escribió**.
 * Una casilla en blanco significa "no lo conté", nunca "hay cero". Mandarlas
 * como cero vaciaría el inventario entero de una sede con un solo clic, y
 * quedaría registrado como un conteo legítimo.
 */
export function ConteoFisicoDialog({
  open,
  onOpenChange,
  products,
  sedes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: InvProduct[]
  sedes: Sede[]
  onSaved: () => void
}) {
  const [sedeId, setSedeId] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [note, setNote] = React.useState("")
  const [contados, setContados] = React.useState<Record<string, string>>({})
  const [esperados, setEsperados] = React.useState<Map<string, number>>(
    new Map(),
  )
  const [cargando, setCargando] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<StockCountResult | null>(null)

  function reiniciar() {
    setSearch("")
    setNote("")
    setContados({})
    setEsperados(new Map())
    setError(null)
    setResult(null)
  }

  function cerrar() {
    onOpenChange(false)
    reiniciar()
  }

  // Con una sola sede no hay nada que elegir: se da por escogida. Derivado y
  // no un efecto que la escriba, para no encadenar un render de más.
  const sedeActiva = sedeId || (sedes.length === 1 ? (sedes[0]?._id ?? "") : "")

  /**
   * Trae lo que el sistema cree que hay en la sede. Se pide aparte de la tabla
   * de existencias de la página porque aquella respeta el filtro de sede de la
   * pantalla, y aquí la sede la manda la planilla.
   */
  React.useEffect(() => {
    let vivo = true
    // El `await` de entrada saca los setState del cuerpo del efecto, que si no
    // encadena renders. Mismo patrón que las fichas de esta pantalla.
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !open || !sedeActiva) return
      setCargando(true)
      setError(null)
      try {
        const rows = await getStock(sedeActiva)
        if (vivo) setEsperados(new Map(rows.map((r) => [r.product._id, r.qty])))
      } catch (err) {
        if (vivo) setError(errorMessage(err))
      } finally {
        if (vivo) setCargando(false)
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [open, sedeActiva])

  const onChangeFila = React.useCallback((id: string, valor: string) => {
    setContados((prev) => ({ ...prev, [id]: valor }))
  }, [])

  /**
   * Lo que se puede contar: activos y sin las plantillas de variantes, que no
   * tienen existencias propias (las tienen sus hijas, que sí aparecen).
   */
  const contables = React.useMemo(
    () =>
      products
        .filter((p) => p.active && !p.variantAxes)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [products],
  )

  const visibles = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return contables
    return contables.filter(
      (p) =>
        normalizeName(p.name).includes(q) || normalizeName(p.sku).includes(q),
    )
  }, [contables, search])

  /**
   * Solo lo que alguien escribió de verdad. Una casilla en blanco es "no lo
   * conté" y se queda fuera: mandarla como cero vaciaría ese producto.
   */
  const contadas = React.useMemo(() => {
    const out: { p: InvProduct; esperado: number; contado: number }[] = []
    for (const p of contables) {
      const texto = contados[p._id]
      if (texto === undefined || texto.trim() === "") continue
      const n = Number(texto)
      if (!Number.isFinite(n) || n < 0) continue
      out.push({ p, esperado: esperados.get(p._id) ?? 0, contado: n })
    }
    return out
  }, [contables, contados, esperados])

  /** De lo contado, lo que no cuadra: es lo que va a mover existencias. */
  const descuadres = React.useMemo(
    () => contadas.filter((c) => Math.abs(c.contado - c.esperado) >= 0.0005),
    [contadas],
  )

  const sobran = descuadres.filter((c) => c.contado > c.esperado)
  const faltan = descuadres.filter((c) => c.contado < c.esperado)
  // Estimación de lo que vale el faltante, con el costo del producto. Es para
  // que nadie aplique un conteo grande sin ver antes cuánta plata mueve.
  const valorFaltante = faltan.reduce(
    (sum, c) => sum + (c.esperado - c.contado) * (c.p.cost ?? 0),
    0,
  )

  async function guardar() {
    if (contadas.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await applyStockCount({
        sedeId: sedeActiva,
        // Viajan TODAS las contadas, no solo las que descuadran: el conteo es
        // el registro de qué se revisó, y el backend informa cuántas cuadraban.
        rows: contadas.map((c) => ({
          productId: c.p._id,
          counted: c.contado,
          expected: c.esperado,
        })),
        note: note.trim() || undefined,
      })
      setResult(res)
      setContados({})
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /** Planilla en blanco para imprimir y recorrer la bodega con un lápiz. */
  function descargarPlanilla() {
    const sede = sedes.find((s) => s._id === sedeActiva)
    downloadCsv(
      `conteo-${sede?.code ?? "sede"}-${new Date().toLocaleDateString("en-CA")}.csv`,
      serializeCsv(
        ["sku", "nombre", "unidad", "sistema", "contado"],
        contables.map((p) => [
          p.sku,
          p.name,
          p.unit,
          esperados.get(p._id) ?? 0,
          "",
        ]),
      ),
    )
  }

  const mostradas = visibles.slice(0, LIMITE_FILAS)

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reiniciar()
      }}
      size="3xl"
      icon={ClipboardList}
      title="Conteo físico"
      description="Recorre la bodega y escribe lo que de verdad hay. Lo que no cuentes se queda como está."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          <Button
            onClick={guardar}
            disabled={contadas.length === 0 || saving || !sedeActiva}
            className="sm:min-w-52"
          >
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {saving
              ? "Aplicando…"
              : descuadres.length === 0
                ? "Aplicar conteo"
                : `Ajustar ${descuadres.length} producto${descuadres.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {result && (
        <FormAlert tone="success" icon={CheckCircle2}>
          Conteo aplicado: <strong>{result.adjusted}</strong> producto(s)
          ajustados y {result.unchanged} que ya cuadraban.
          {result.removedQty > 0 && (
            <span className="mt-1 block">
              Faltaban {nf.format(result.removedQty)} unidad(es), unos{" "}
              <strong>{money.format(result.removedValue)}</strong>.
            </span>
          )}
          {result.addedQty > 0 && (
            <span className="mt-1 block">
              Sobraban {nf.format(result.addedQty)} unidad(es), unos{" "}
              {money.format(result.addedValue)}.
            </span>
          )}
          {result.moved.length > 0 && (
            <span className="mt-1 block">
              Ojo: {result.moved.length} producto(s) se movieron mientras
              contabas (
              {result.moved
                .slice(0, 3)
                .map((m) => m.name)
                .join(", ")}
              ). Se ajustaron contra lo que había al aplicar, que es lo
              correcto, pero vale la pena mirar si hubo una venta de por medio.
            </span>
          )}
          {result.errors.length > 0 && (
            <span className="mt-1 block">
              No se pudieron ajustar {result.errors.length}:{" "}
              {result.errors
                .slice(0, 3)
                .map((e) => `${e.name} (${e.message})`)
                .join("; ")}
              .
            </span>
          )}
        </FormAlert>
      )}

      <FormSection title="Dónde cuentas">
        <FieldGrid cols={2}>
          <Field id="cf-sede" label="Sede" required help={{ term: "sede" }}>
            <NativeSelect
              id="cf-sede"
              value={sedeActiva}
              onChange={(v) => {
                setSedeId(v)
                setContados({})
                setResult(null)
              }}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
              placeholder="Seleccionar sede"
            />
          </Field>
          <Field
            id="cf-note"
            label="Nota"
            hint="Queda en cada movimiento del kárdex."
          >
            <Input
              id="cf-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Conteo del domingo"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      {sedeActiva && (
        <FormSection
          title="Qué encontraste"
          description="Escribe solo lo que contaste. La casilla en blanco significa que no lo revisaste, no que haya cero."
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={descargarPlanilla}
              disabled={cargando || contables.length === 0}
            >
              <Download />
              Planilla para imprimir
            </Button>
          </div>

          {descuadres.length > 0 && (
            <FormAlert tone="warning" icon={TriangleAlert}>
              Vas a ajustar <strong>{descuadres.length}</strong> producto(s):{" "}
              {faltan.length} con faltante y {sobran.length} con sobrante.
              {valorFaltante > 0 && (
                <>
                  {" "}
                  El faltante vale unos{" "}
                  <strong>{money.format(valorFaltante)}</strong>.
                </>
              )}{" "}
              Los otros {contadas.length - descuadres.length} que contaste ya
              cuadran y no se tocan.
            </FormAlert>
          )}

          <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Según el sistema</TableHead>
                  <TableHead>Contaste</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!cargando &&
                  mostradas.map((p) => (
                    <FilaConteo
                      key={p._id}
                      p={p}
                      esperado={esperados.get(p._id) ?? 0}
                      valor={contados[p._id] ?? ""}
                      onChange={onChangeFila}
                    />
                  ))}
                {!cargando && mostradas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No hay productos que coincidan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {visibles.length > LIMITE_FILAS && (
            <p className="text-xs text-muted-foreground">
              Se muestran {LIMITE_FILAS} de {visibles.length}. Usa el buscador
              para llegar al resto; lo que ya escribiste no se pierde.
            </p>
          )}
        </FormSection>
      )}
    </FormDialog>
  )
}
