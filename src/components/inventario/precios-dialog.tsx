"use client"

import * as React from "react"
import {
  TriangleAlert,
  Download,
  Upload,
  CheckCircle2,
  Search,
  Loader2,
  Package,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import {
  importProducts,
  type ImportResult,
  type InvProduct,
} from "@/lib/erp/api-inventory"
import {
  costoPorUnidad,
  precioDePresentacion,
  presentacionDeCompra,
  sugerirPresentacion,
} from "@/lib/erp/purchase-unit"
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
import { MoneyInput } from "@/components/ui/money-input"
import {
  FormDialog,
  FormDivider,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import { cn } from "@/lib/utils"
import {
  moneyUnit,
  normalizeName,
  errorMessage,
} from "@/components/inventario/helpers"

// ─── Actualizar precios de compra ─────────────────────────────────────────────

/** Cuántas filas se pintan de golpe: más allá, la lista se vuelve lenta. */
export const LIMITE_FILAS = 120

/**
 * Una fila de la lista de precios. Va memorizada porque al escribir en una
 * casilla se re-renderiza el diálogo entero, y con cien insumos cada tecla se
 * sentiría pegajosa.
 */
export const FilaPrecio = React.memo(function FilaPrecio({
  p,
  valor,
  onChange,
}: {
  p: InvProduct
  valor: string
  onChange: (id: string, valor: string) => void
}) {
  const pres = presentacionDeCompra(p)
  const actual = precioDePresentacion(p.cost, pres.factor)

  const n = Number(valor)
  const valido = valor.trim() !== "" && Number.isFinite(n) && n >= 0
  const delta = valido && actual > 0 ? ((n - actual) / actual) * 100 : null
  const cambia = valido && Math.abs(n - actual) >= 0.005

  return (
    <TableRow className={cambia ? "bg-brand-50/60 dark:bg-brand-950/30" : ""}>
      <TableCell className="py-2">
        <p className="font-medium leading-tight">{p.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {p.sku} · por {pres.unidad}
          {pres.contenido ? ` de ${pres.contenido}` : ""}
        </p>
      </TableCell>
      <TableCell className="tnum py-2 text-right text-muted-foreground">
        {moneyUnit.format(actual)}
      </TableCell>
      <TableCell className="py-2">
        {/* El estado de la lista sigue siendo texto —una casilla en blanco
            significa "no lo toqué", que no es lo mismo que cero— así que el
            número que devuelve el campo se vuelve a guardar como texto. */}
        <MoneyInput
          className="h-9 w-36 text-right"
          aria-label={`Nuevo precio de ${p.name}`}
          placeholder={String(Math.round(actual))}
          value={valor.trim() === "" ? null : n}
          onValueChange={(v) => onChange(p._id, v === null ? "" : String(v))}
        />
      </TableCell>
      <TableCell className="tnum py-2 text-right">
        {delta === null || !cambia ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              delta > 0 ? "text-destructive" : "text-success-ink",
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} %
          </span>
        )}
      </TableCell>
    </TableRow>
  )
})

/**
 * Actualización masiva de precios de compra.
 *
 * Es la pantalla que más se pide en un negocio que transforma: los insumos
 * suben cada semana y hasta ahora la única vía era abrir la ficha de cada
 * producto, una por una, o pasar por el Excel. Guarda con el mismo endpoint de
 * importación (upsert por SKU, campos parciales), así que no necesita nada
 * nuevo del backend.
 */
export function ActualizarPreciosDialog({
  open,
  onOpenChange,
  products,
  onSaved,
  onExportar,
  onImportar,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: InvProduct[]
  onSaved: () => void
  onExportar: () => void
  onImportar: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [nuevos, setNuevos] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [definiendo, setDefiniendo] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{
    actualizados: number
    subieron: number
    bajaron: number
    errores: ImportResult["errors"]
  } | null>(null)

  // Se limpia al cerrar y no con un efecto sobre `open`: así no queda un
  // render intermedio con los datos de la sesión anterior ya visibles.
  function reiniciar() {
    setSearch("")
    setNuevos({})
    setError(null)
    setResult(null)
  }

  function cerrar() {
    onOpenChange(false)
    reiniciar()
  }

  const onChangeFila = React.useCallback((id: string, valor: string) => {
    setNuevos((prev) => ({ ...prev, [id]: valor }))
  }, [])

  const activos = React.useMemo(
    () =>
      products
        .filter((p) => p.active)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [products],
  )

  const visibles = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return activos
    return activos.filter(
      (p) =>
        normalizeName(p.name).includes(q) || normalizeName(p.sku).includes(q),
    )
  }, [activos, search])

  /**
   * Insumos que esta pantalla venía tratando como si se compraran por kilo o
   * por litro sin que nadie lo hubiera dicho: lo adivinaba por la unidad.
   *
   * Ahora que la presentación se guarda en el producto, ya no se adivina, así
   * que estos se muestran por gramo hasta que alguien diga cómo se compran. El
   * botón de abajo deja por escrito justo lo que se venía suponiendo —sin
   * tocar ningún precio— para que nadie tenga que editar cien fichas a mano.
   */
  const porDefinir = React.useMemo(
    () =>
      activos.flatMap((p) => {
        if (presentacionDeCompra(p).definida) return []
        const sug = sugerirPresentacion(p.unit)
        return sug ? [{ p, sug }] : []
      }),
    [activos],
  )

  async function definirPresentaciones() {
    setDefiniendo(true)
    setError(null)
    try {
      // Solo viajan `purchaseUnit` y `purchaseFactor`: el costo por gramo se
      // queda igual, así que el precio que se ve en pantalla es el mismo de
      // siempre —el del kilo— pero ahora porque está escrito, no supuesto.
      await importProducts(
        porDefinir.map(({ p, sug }) => ({
          sku: p.sku,
          name: p.name,
          purchaseUnit: sug.unidad,
          purchaseFactor: sug.factor,
        })),
      )
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDefiniendo(false)
    }
  }

  // Solo viaja lo que cambió de verdad. Reenviar el mismo precio ensuciaría el
  // historial del producto sin que nada haya pasado.
  const cambios = React.useMemo(() => {
    const out: { p: InvProduct; actual: number; nuevo: number }[] = []
    for (const p of activos) {
      const texto = nuevos[p._id]
      if (texto === undefined || texto.trim() === "") continue
      const n = Number(texto)
      if (!Number.isFinite(n) || n < 0) continue
      const actual = precioDePresentacion(
        p.cost,
        presentacionDeCompra(p).factor,
      )
      if (Math.abs(n - actual) < 0.005) continue
      out.push({ p, actual, nuevo: n })
    }
    return out
  }, [activos, nuevos])

  async function guardar() {
    if (cambios.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await importProducts(
        cambios.map(({ p, nuevo }) => ({
          sku: p.sku,
          // El nombre viaja porque el endpoint es un upsert: si un SKU se
          // hubiera borrado mientras el diálogo estaba abierto, sin nombre el
          // producto recreado quedaría sin identificar.
          name: p.name,
          cost: costoPorUnidad(nuevo, presentacionDeCompra(p).factor),
        })),
      )
      setResult({
        actualizados: res.updated,
        subieron: cambios.filter((c) => c.nuevo > c.actual).length,
        bajaron: cambios.filter((c) => c.nuevo < c.actual).length,
        errores: res.errors,
      })
      setNuevos({})
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
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
      icon={TrendingUp}
      title="Actualizar precios de compra"
      description="Escribe el precio nuevo solo en lo que cambió y guarda todo de una. Lo que no toques se queda igual."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          <Button
            onClick={guardar}
            disabled={cambios.length === 0 || saving}
            className="sm:min-w-44"
          >
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {saving
              ? "Guardando…"
              : cambios.length === 0
                ? "Guardar precios"
                : `Guardar ${cambios.length} cambio${cambios.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {result && (
        <FormAlert tone="success" icon={CheckCircle2}>
          Listo: <strong>{result.actualizados}</strong> precio(s) actualizados
          {result.subieron > 0 && <> · subieron {result.subieron}</>}
          {result.bajaron > 0 && <> · bajaron {result.bajaron}</>}.
          {result.subieron > 0 && (
            <span className="mt-1 block">
              Como subió algún insumo, revisa el semáforo de márgenes en{" "}
              <strong>Producción → Terminados</strong>: ahí se ve de un vistazo
              si algún producto se te salió del objetivo.
            </span>
          )}
          {result.errores.length > 0 && (
            <span className="mt-1 block">
              No se pudieron actualizar {result.errores.length}:{" "}
              {result.errores
                .slice(0, 3)
                .map((e) => e.sku)
                .join(", ")}
              .
            </span>
          )}
        </FormAlert>
      )}

      {porDefinir.length > 0 && (
        <FormAlert tone="warning" icon={TriangleAlert}>
          Hay <strong>{porDefinir.length}</strong> insumo(s) que mides en gramos
          o mililitros y que todavía no dicen cómo los compras, así que aquí
          aparecen por gramo. Si los compras por kilo o por litro —lo normal—,
          déjalo escrito de una vez.
          <span className="mt-2 block">
            <Button
              size="sm"
              variant="outline"
              onClick={definirPresentaciones}
              disabled={definiendo}
            >
              {definiendo ? <Loader2 className="animate-spin" /> : <Package />}
              {definiendo
                ? "Guardando…"
                : `Los compro por kilo o litro (${porDefinir.length})`}
            </Button>
          </span>
          <span className="mt-2 block text-xs">
            No cambia ningún precio: solo deja por escrito lo que esta pantalla
            ya venía suponiendo. Al que te llegue en bulto o en caja, dile cuál
            es su presentación en su propia ficha.
          </span>
        </FormAlert>
      )}

      <FormAlert tone="info" icon={Package}>
        Si registras la compra con la <strong>foto de la factura</strong>, el
        precio se actualiza solo al entrar la mercancía. Esta pantalla es para
        cuando el proveedor te avisa un precio nuevo antes de que llegue el
        pedido.
      </FormAlert>

      <FormSection
        title="Precios"
        description="Cada precio va en la presentación con la que compras ese insumo: el bulto, la caja, el kilo o la unidad."
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead>Precio nuevo</TableHead>
                <TableHead className="text-right">Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mostradas.map((p) => (
                <FilaPrecio
                  key={p._id}
                  p={p}
                  valor={nuevos[p._id] ?? ""}
                  onChange={onChangeFila}
                />
              ))}
              {mostradas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No hay productos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {visibles.length > LIMITE_FILAS && (
          <p className="text-xs text-muted-foreground">
            Se muestran {LIMITE_FILAS} de {visibles.length}. Busca por nombre o
            SKU para llegar al resto; lo que ya escribiste se guarda igual
            aunque deje de verse.
          </p>
        )}
      </FormSection>

      <FormDivider />

      <FormSection
        title="¿Te cambiaron la lista entera?"
        description="Para muchos productos a la vez sale más rápido por Excel: descargas el catálogo, cambias la columna de costo y lo vuelves a subir."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExportar}>
            <Download />
            Descargar el catálogo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              reiniciar()
              onImportar()
            }}
          >
            <Upload />
            Subir el archivo corregido
          </Button>
        </div>
      </FormSection>
    </FormDialog>
  )
}

// ─── Conteo físico ────────────────────────────────────────────────────────────
