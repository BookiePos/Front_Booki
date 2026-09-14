"use client"

/**
 * Los dos campos que deciden cómo se mide un insumo.
 *
 * Van juntos en un archivo porque el problema que resuelven es uno solo y es
 * el que más confunde de todo el inventario: **la unidad y la presentación de
 * compra no son lo mismo, y quien llena la ficha cree que sí**. Escribe
 * "bulto" en la unidad, el sistema guarda "tres bultos" de harina y ya no hay
 * forma de saber cuántos gramos hay ni de descontar una receta.
 *
 * Aquí se separan a la vista: arriba se elige en qué se CUENTA (gramos), abajo
 * se dice cómo LLEGA (bultos de 25 kg). Y donde antes había un campo de texto
 * vacío esperando adivinanza, ahora hay botones con las presentaciones reales
 * del país —bulto, arroba, garrafa, canasta— que además rellenan solos cuánto
 * trae cada una.
 *
 * La lista de unidades y de presentaciones vive en `lib/erp/unidades.ts`; aquí
 * solo está lo que se pinta.
 */

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { QuantityInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { convertUnits } from "@/lib/erp/purchase-unit"
import {
  FAMILIAS,
  UNIDADES,
  presentacionesPara,
  unidad,
  unidadCorta,
  type PresentacionSugerida,
} from "@/lib/erp/unidades"

/**
 * Desplegable de unidad de medida, agrupado por familia.
 *
 * Es un `<select>` nativo por lo mismo que `NativeSelect` del kit: en tablet
 * abre la rueda del sistema y se maneja con el pulgar. Se escribe aquí y no
 * allá porque `NativeSelect` no sabe de `<optgroup>`, y sin los grupos la
 * lista es otra vez siete abreviaturas en fila donde "lb" y "l" se confunden.
 */
export function UnidadSelect({
  id,
  value,
  onChange,
  className,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  "aria-label"?: string
  "aria-describedby"?: string
}) {
  const conocida = unidad(value)

  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        id={id}
        data-slot="select"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-xl border border-input bg-card py-1 pr-9 pl-3 text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none",
          "hover:border-ring/45",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          "md:text-sm dark:bg-input/25 dark:hover:bg-input/35",
        )}
      >
        {FAMILIAS.map((f) => (
          <optgroup key={f.familia} label={f.titulo}>
            {UNIDADES.filter((u) => u.familia === f.familia).map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </optgroup>
        ))}
        {/* Una unidad vieja escrita a mano ("paquete", "caja") no puede
            desaparecer del desplegable: el campo saldría en blanco y al
            guardar se perdería sin que nadie lo note. */}
        {!conocida && value && (
          <optgroup label="Lo que ya tenías escrito">
            <option value={value}>{value}</option>
          </optgroup>
        )}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

/** El ejemplo de la unidad elegida, para poner bajo el desplegable. */
export function ejemploDeUnidad(value: string): string | undefined {
  return unidad(value)?.ejemplo
}

/** Unidad base en la que viene el `contenido` de cada presentación sugerida. */
const BASE_DE_FAMILIA: Record<string, string> = {
  conteo: "und",
  masa: "g",
  volumen: "ml",
}

/**
 * Cuánto trae una presentación, ya pasado a la unidad en que se consume.
 *
 * Las sugerencias guardan el contenido en la unidad base de su familia —una
 * arroba son 12.500 g— pero el insumo puede llevarse en kilos, y meter 12.500
 * en el factor de un insumo que va en kg convertiría cada arroba en doce mil
 * kilos de harina. Aquí se convierte antes de tocar el formulario.
 */
export function contenidoEnUnidadDeConsumo(
  pres: PresentacionSugerida,
  unidadConsumo: string,
): number | null {
  if (pres.contenido == null) return null
  const familia = unidad(unidadConsumo)?.familia
  const base = familia ? BASE_DE_FAMILIA[familia] : undefined
  if (!base) return pres.contenido
  return convertUnits(pres.contenido, base, unidadConsumo)
}

/** Botón-pastilla de las sugerencias. Mismo lenguaje que el resto del panel. */
function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
        activa
          ? "border-primary/45 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/45 hover:bg-primary/8 hover:text-primary",
      )}
    >
      {children}
    </button>
  )
}

/**
 * Presentación de compra: cómo llega del proveedor y cuánto trae.
 *
 * El campo sigue admitiendo texto libre —nadie puede prever si un proveedor
 * despacha "pacas", "guacales" o "medias canecas"— pero ya no arranca en
 * blanco: las pastillas ofrecen lo que de verdad se compra en Colombia y, al
 * escoger una con contenido conocido, rellenan el factor convertido a la
 * unidad del insumo. Queda editable a propósito: un bulto de harina trae 25 kg
 * y uno de arroz 12,5, y eso solo lo sabe quien recibe la mercancía.
 */
export function PresentacionCompraPicker({
  unidadConsumo,
  presentacion,
  onPresentacionChange,
  factor,
  onFactorChange,
  disabled,
}: {
  /** Unidad en la que se consume el insumo: en ella se expresa el factor. */
  unidadConsumo: string
  presentacion: string
  onPresentacionChange: (value: string) => void
  factor: number | null
  onFactorChange: (value: number | null) => void
  disabled?: boolean
}) {
  const sugerencias = presentacionesPara(unidadConsumo)
  const nombre = presentacion.trim()
  const elegida = sugerencias.find(
    (s) => s.nombre === nombre.toLowerCase(),
  )
  /** "Otra…" pulsada: se muestra el campo de texto aunque aún esté vacío. */
  const [otra, setOtra] = React.useState(false)
  const mostrarTexto = otra || (nombre !== "" && !elegida)
  const corta = unidadCorta(unidadConsumo)

  function escoger(pres: PresentacionSugerida) {
    setOtra(false)
    // Volver a pulsar la misma pastilla la quita: es la única forma de decir
    // "me equivoqué, esto se compra como se consume" sin borrar a mano.
    if (elegida?.nombre === pres.nombre) {
      onPresentacionChange("")
      onFactorChange(null)
      return
    }
    onPresentacionChange(pres.nombre)
    onFactorChange(contenidoEnUnidadDeConsumo(pres, unidadConsumo))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {sugerencias.map((s) => (
          <Pastilla
            key={s.nombre}
            activa={elegida?.nombre === s.nombre}
            onClick={() => escoger(s)}
          >
            {s.nombre}
          </Pastilla>
        ))}
        <Pastilla
          activa={mostrarTexto}
          onClick={() => {
            setOtra(true)
            if (elegida) {
              onPresentacionChange("")
              onFactorChange(null)
            }
          }}
        >
          Otra…
        </Pastilla>
        {nombre !== "" && (
          <button
            type="button"
            onClick={() => {
              setOtra(false)
              onPresentacionChange("")
              onFactorChange(null)
            }}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Quitar
          </button>
        )}
      </div>

      {mostrarTexto && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presentacion-otra">Escribe cómo te llega</Label>
          <Input
            id="presentacion-otra"
            value={presentacion}
            onChange={(e) => onPresentacionChange(e.target.value)}
            placeholder="paca, guacal, media caneca…"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      )}

      {nombre === "" ? (
        <p className="text-xs text-muted-foreground">
          Sin presentación se compra igual que se consume: si lo llevas en{" "}
          {corta}, el precio lo escribes por {corta}. Déjalo así si es tu caso.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presentacion-factor">
            Cuánto trae {nombre === "" ? "" : `un ${nombre}`}
          </Label>
          <QuantityInput
            id="presentacion-factor"
            value={factor}
            onValueChange={onFactorChange}
            sufijo={corta}
            placeholder="25.000"
            disabled={disabled}
            aria-label={`Cuánto trae un ${nombre} en ${corta}`}
          />
          <p className="text-xs text-muted-foreground">
            {elegida?.nota ??
              `Escríbelo en ${corta}, que es como lo consumes.`}{" "}
            {factor != null && factor > 0
              ? `El precio lo escribes por ${nombre}, no por ${corta}.`
              : ""}
          </p>
        </div>
      )}
    </div>
  )
}
