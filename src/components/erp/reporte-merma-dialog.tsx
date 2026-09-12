"use client"

import * as React from "react"
import { Trash2, Loader2, TriangleAlert, Download } from "lucide-react"

import { ApiError } from "@/lib/api"
import {
  getWasteReport,
  type Sede,
  type WasteReport,
} from "@/lib/erp/api-inventory"
import { serializeCsv, downloadCsv } from "@/lib/erp/csv"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})
const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

/** Cómo se lee cada razón de baja en pantalla. */
const RAZONES: Record<string, string> = {
  vencimiento: "Se venció",
  dano: "Se dañó",
  merma: "Merma de proceso",
  otro: "Otro",
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

/** Primer día del mes pasado y último, en YYYY-MM-DD. */
function mesPasado(): { from: string; to: string } {
  const hoy = new Date()
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  const iso = (d: Date) => d.toLocaleDateString("en-CA")
  return { from: iso(inicio), to: iso(fin) }
}

/**
 * Reporte de merma: qué se botó, por qué y cuánto costó.
 *
 * La merma es la plata que se pierde sin que nadie la vea salir. Cada baja
 * queda en el kárdex desde siempre, pero una a una no dice nada: lo que revela
 * el problema es el acumulado — "el mes pasado se botaron $340.000 de leche por
 * vencimiento". Eso hasta hoy tocaba armarlo a mano.
 *
 * Arranca en el mes pasado porque es el periodo que ya se puede juzgar: el mes
 * en curso siempre se ve mejor de lo que va a terminar.
 */
export function ReporteMermaDialog({
  open,
  onOpenChange,
  sedes,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedes: Sede[]
}) {
  const inicial = React.useMemo(() => mesPasado(), [])
  const [sedeId, setSedeId] = React.useState("")
  const [from, setFrom] = React.useState(inicial.from)
  const [to, setTo] = React.useState(inicial.to)
  const [data, setData] = React.useState<WasteReport | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const consultar = React.useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setData(
        await getWasteReport({
          sedeId: sedeId || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }, [sedeId, from, to])

  React.useEffect(() => {
    let vivo = true
    async function arrancar() {
      await Promise.resolve()
      if (!vivo || !open) return
      await consultar()
    }
    void arrancar()
    return () => {
      vivo = false
    }
    // A propósito solo al abrir: los filtros se aplican con el botón, para no
    // disparar una consulta por cada tecla de una fecha a medio escribir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function cerrar() {
    onOpenChange(false)
    setData(null)
    setError(null)
  }

  function exportar() {
    if (!data) return
    downloadCsv(
      `merma-${data.from ?? "inicio"}-a-${data.to ?? "hoy"}.csv`,
      serializeCsv(
        ["sku", "producto", "unidad", "cantidad", "valor", "razones"],
        data.rows.map((r) => [
          r.sku,
          r.name,
          r.unit,
          r.qty,
          r.value,
          Object.entries(r.byReason)
            .map(([k, v]) => `${RAZONES[k] ?? k}: ${nf.format(v.qty)}`)
            .join(" · "),
        ]),
      ),
    )
  }

  const razones = data
    ? Object.entries(data.byReason).sort((a, b) => b[1].value - a[1].value)
    : []

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cerrar()
        else onOpenChange(v)
      }}
      size="3xl"
      icon={Trash2}
      title="Qué se botó"
      description="La plata que se pierde sin que nadie la vea salir. Solo cuenta lo dado de baja: los ajustes por conteo no son merma."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            Cerrar
          </Button>
          <Button
            variant="outline"
            onClick={exportar}
            disabled={!data || data.rows.length === 0}
          >
            <Download />
            Exportar
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <FormSection title="Qué periodo">
        <FieldGrid cols={3}>
          <Field id="m-sede" label="Sede">
            <NativeSelect
              id="m-sede"
              value={sedeId}
              onChange={setSedeId}
              options={[
                { value: "", label: "Todas" },
                ...sedes.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
          </Field>
          <Field id="m-from" label="Desde">
            <Input
              id="m-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field id="m-to" label="Hasta" hint="Incluido.">
            <Input
              id="m-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </FieldGrid>
        <Button onClick={() => void consultar()} disabled={cargando}>
          {cargando ? <Loader2 className="animate-spin" /> : null}
          {cargando ? "Consultando…" : "Ver"}
        </Button>
      </FormSection>

      {data && !cargando && (
        <>
          <FormSection title="Cuánto se perdió">
            {data.totalValue === 0 ? (
              <p className="text-sm text-muted-foreground">
                En ese periodo no se dio de baja nada. Si esperabas ver algo,
                revisa que las bajas se estén registrando con su motivo y no
                como ajuste de conteo.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="stat-figure text-2xl">
                    {money.format(data.totalValue)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    en {nf.format(data.totalQty)} unidad(es), repartidas en{" "}
                    {data.movements} baja(s)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {razones.map(([razon, v]) => (
                    <Badge key={razon} variant="secondary">
                      {RAZONES[razon] ?? razon}: {money.format(v.value)}
                    </Badge>
                  ))}
                </div>

                {razones[0] && razones[0][1].value > data.totalValue / 2 && (
                  <FormAlert tone="warning" icon={TriangleAlert}>
                    Más de la mitad de lo que se perdió fue por{" "}
                    <strong>
                      {(RAZONES[razones[0][0]] ?? razones[0][0]).toLowerCase()}
                    </strong>
                    . Ahí es donde está la plata.
                  </FormAlert>
                )}
              </>
            )}
          </FormSection>

          {data.rows.length > 0 && (
            <FormSection
              title="Por producto"
              description="De mayor a menor plata perdida: lo primero que hay que mirar es lo que más cuesta, no lo que más veces pasó."
            >
              <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costó</TableHead>
                      <TableHead>Por qué</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow key={r.productId}>
                        <TableCell className="py-2">
                          <p className="font-medium leading-tight">{r.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {r.sku}
                          </p>
                        </TableCell>
                        <TableCell className="tnum py-2 text-right">
                          {nf.format(r.qty)} {r.unit}
                        </TableCell>
                        <TableCell className="tnum py-2 text-right font-medium">
                          {money.format(r.value)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {Object.entries(r.byReason)
                            .sort((a, b) => b[1].value - a[1].value)
                            .map(
                              ([k, v]) =>
                                `${RAZONES[k] ?? k} (${nf.format(v.qty)})`,
                            )
                            .join(" · ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </FormSection>
          )}
        </>
      )}
    </FormDialog>
  )
}
