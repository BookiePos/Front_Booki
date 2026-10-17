"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Loader2, PackagePlus } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import {
  aplicarPlantilla,
  getEstadoOnboarding,
  quitarPlantilla,
  type EstadoOnboarding,
  type ResultadoPlantilla,
} from "@/lib/erp/api-onboarding"
import { errorMessage } from "@/lib/erp/finance-format"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Qué plantilla sugerir primero según el giro de la empresa. */
const SUGERIDA = { restaurante: "restaurante", retail: "tienda" } as const

/**
 * «Empezar con un catálogo de ejemplo» (ítem 6.6). Solo lo ve quien puede
 * cargarlo (Dueño y Administrador); para el resto no existe. Deja claro que
 * todo se edita o se borra después, que las existencias son de ejemplo y SIN
 * costo (no son una compra), y permite quitar los datos de ejemplo.
 */
export function CatalogoEjemplo({ onDone }: { onDone: () => void }) {
  const { hasPermission } = useAuth()
  const puede = hasPermission("onboarding.template")

  const [abierto, setAbierto] = React.useState(false)
  const [estado, setEstado] = React.useState<EstadoOnboarding | null>(null)
  const [tipo, setTipo] = React.useState<string | null>(null)
  const [confirmar, setConfirmar] = React.useState(false)
  // El servidor rechazó con 409: se muestra la casilla aunque `ajenos` dijera 0.
  const [pideConfirmar, setPideConfirmar] = React.useState(false)
  const [cargando, setCargando] = React.useState(false)
  const [resultado, setResultado] = React.useState<ResultadoPlantilla | null>(null)

  const abrir = async () => {
    setAbierto(true)
    if (estado) return
    try {
      const e = await getEstadoOnboarding()
      setEstado(e)
      const sugerida = e.tipoNegocio ? SUGERIDA[e.tipoNegocio] : null
      setTipo((t) => t ?? sugerida)
    } catch (err) {
      toast.error(errorMessage(err))
      setAbierto(false)
    }
  }

  if (!puede) return null

  const elegida = estado?.plantillas.find((p) => p.tipo === tipo) ?? null
  const necesitaConfirmar =
    pideConfirmar || (elegida?.ajenos ?? 0) > 0 || (estado?.productosPropios ?? 0) > 0
  const ajenos = Math.max(elegida?.ajenos ?? 0, estado?.productosPropios ?? 0)

  const elegir = (t: string) => {
    setTipo(t)
    setConfirmar(false)
    setPideConfirmar(false)
  }

  const cargar = async () => {
    if (!tipo) return
    setCargando(true)
    try {
      const r = await aplicarPlantilla({ tipo, confirmar })
      setResultado(r)
      toast.success("Catálogo de ejemplo cargado")
    } catch (err) {
      // 409: ya hay productos. Se explica y se ofrece confirmar, no un callejón.
      if (err instanceof ApiError && err.status === 409) setPideConfirmar(true)
      toast.error(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }

  const quitar = async () => {
    if (!resultado) return
    setCargando(true)
    try {
      const r = await quitarPlantilla(resultado.tipo)
      toast.success(
        r.conservados > 0
          ? `Quitados ${r.vendiblesQuitados} productos de ejemplo; ${r.conservados} se conservan porque ya tienen compras`
          : `Quitados ${r.vendiblesQuitados} productos de ejemplo`,
      )
      setResultado(null)
      setAbierto(false)
      setEstado(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }

  if (resultado) {
    return (
      <div className="rounded-xl border border-border bg-accent/40 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Check className="size-4 text-primary" />
          Listo: {resultado.productos.creados} productos
          {resultado.mesas.creadas > 0 ? ` y ${resultado.mesas.creadas} mesas` : ""}
        </p>
        <p className="mt-1 text-muted-foreground">
          Cada uno quedó con {resultado.stockInicial} unidades de ejemplo{" "}
          <strong>sin costo</strong> (no son una compra y no valorizan tu
          inventario) y con su impuesto según tu negocio. Ajusta precios, o
          borra lo que no uses, desde Productos e Inventario.
        </p>
        {resultado.aviso && (
          <p className="mt-2 text-muted-foreground">{resultado.aviso}</p>
        )}
        <p className="mt-2 text-muted-foreground">
          Para llevar el costo real, registra tu{" "}
          <Link href="/panel/inventario" className="font-medium text-primary underline">
            inventario inicial
          </Link>{" "}
          o una compra.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button render={<Link href="/pos" />} className="sm:flex-1" onClick={onDone}>
            Ir a vender
          </Button>
          <Button variant="outline" className="sm:flex-1" disabled={cargando} onClick={quitar}>
            Quitar datos de ejemplo
          </Button>
        </div>
      </div>
    )
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed border-primary/50 bg-accent/40 p-4 text-left transition-colors hover:bg-accent"
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <PackagePlus className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">
            Empezar con un catálogo de ejemplo
          </span>
          <span className="block text-sm text-muted-foreground">
            Productos, precios e impuestos listos para tu tipo de negocio. Vende
            en minutos y cámbialo después.
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-semibold text-foreground">¿Qué tipo de negocio es?</p>
      {!estado ? (
        <Loader2 className="mt-3 size-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div role="radiogroup" aria-label="Tipo de negocio" className="mt-2 flex flex-col gap-2">
            {estado.plantillas.map((p) => (
              <button
                key={p.tipo}
                type="button"
                role="radio"
                aria-checked={tipo === p.tipo}
                aria-disabled={!p.aplica}
                disabled={!p.aplica}
                onClick={() => elegir(p.tipo)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  tipo === p.tipo
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-muted/50 disabled:hover:bg-transparent",
                )}
              >
                <span className="font-medium text-foreground">{p.nombre}</span>
                <span className="text-muted-foreground">
                  {" "}· {p.productos} productos{p.mesas > 0 ? `, ${p.mesas} mesas` : ""}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {p.aplica ? `${p.ejemplos.join(", ")}…` : p.motivo}
                </span>
              </button>
            ))}
          </div>

          {necesitaConfirmar && (
            <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmar}
                onChange={(e) => setConfirmar(e.target.checked)}
              />
              {ajenos > 0
                ? `Ya tengo ${ajenos} productos (propios o de otra plantilla). Súmalos sin tocar los míos.`
                : "Ya tengo productos. Súmalos sin tocar los míos."}
            </label>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Son datos de ejemplo: podrás editar o borrar cualquier producto,
            precio o mesa cuando quieras, o quitarlos todos de una vez. Las
            existencias entran sin costo y los impuestos son de referencia:
            revísalos con tu contador.
          </p>
          <Button
            className="mt-3 w-full"
            disabled={!tipo || cargando || (necesitaConfirmar && !confirmar)}
            onClick={cargar}
          >
            {cargando && <Loader2 className="size-4 animate-spin" />}
            Cargar catálogo de ejemplo
          </Button>
        </>
      )}
    </div>
  )
}
