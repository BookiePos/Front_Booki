"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Campo de dinero en pesos colombianos: el punto de los miles se escribe solo.
 *
 * Quien teclea 45000 ve **$45.000** mientras escribe, sin poner ni un punto. Es
 * la diferencia entre revisar una cifra de un vistazo y contar ceros con el
 * dedo en la pantalla — que es justo lo que pasaba en los campos de precio que
 * eran un `<input type="number">` pelado: 45000 y 450000 se ven casi iguales, y
 * un cero de más en el precio de venta no lo ve nadie hasta que se cobró mal.
 *
 * El valor SIEMPRE se maneja como número (`null` = vacío), nunca como texto: la
 * pantalla es la única que sabe de puntos, y lo que sale hacia el servidor es
 * un número limpio.
 *
 * **Decimales.** Por defecto no los admite, porque un precio de venta en pesos
 * no los lleva. `decimales` los habilita para el único sitio donde sí hacen
 * falta: el costo por unidad de consumo, donde un bulto de $95.000 con 25.000 g
 * da $3,80 el gramo y redondear a $4 infla cada receta. La coma decimal es la
 * de aquí (`,`), y el punto que traen los teclados numéricos se acepta como si
 * fuera coma para que nadie tenga que pelear con su teclado.
 */
export function MoneyInput({
  id,
  value,
  onValueChange,
  placeholder,
  autoFocus,
  className,
  onKeyDown,
  onBlur,
  disabled,
  readOnly,
  name,
  /** Cuántos decimales admite. 0 = solo pesos enteros, que es lo normal. */
  decimales = 0,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string
  value: number | null
  onValueChange: (value: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  disabled?: boolean
  readOnly?: boolean
  name?: string
  decimales?: number
  "aria-label"?: string
  "aria-describedby"?: string
}) {
  // Mientras se escribe manda lo tecleado; el formateo completo se aplica al
  // salir del campo. Si no, escribir "3," es imposible: el formateador borra la
  // coma en cuanto no hay dígito detrás y el decimal nunca se puede teclear.
  const [borrador, setBorrador] = React.useState<string | null>(null)

  const formatear = React.useCallback(
    (n: number) =>
      new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: decimales,
      }).format(n),
    [decimales],
  )

  const display =
    borrador !== null
      ? borrador
      : value === null || Number.isNaN(value)
        ? ""
        : formatear(value)

  /**
   * De lo tecleado al número. Se quedan los dígitos y, si hay decimales
   * permitidos, la primera coma; todo lo demás —puntos de miles, espacios, el
   * símbolo de peso que alguien pegue— se cae.
   */
  function aNumero(texto: string): number | null {
    const limpio =
      decimales > 0
        ? texto
            .replace(/\./g, ",")
            .replace(/[^\d,]/g, "")
            .replace(/,(?=.*,)/g, "")
            .replace(",", ".")
        : texto.replace(/\D/g, "")
    if (limpio === "" || limpio === ".") return null
    const n = Number(limpio)
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm",
          disabled ? "text-muted-foreground/50" : "text-muted-foreground",
        )}
      >
        $
      </span>
      <Input
        id={id}
        name={name}
        inputMode={decimales > 0 ? "decimal" : "numeric"}
        value={display}
        onChange={(e) => {
          const crudo = e.target.value
          const n = aNumero(crudo)
          // El borrador conserva lo tecleado tal cual solo cuando termina en
          // coma o en ceros decimales ("3," o "3,0"), que es lo que el
          // formateador se comería. En cualquier otro caso se pinta formateado
          // ya mismo, para que el punto de los miles aparezca al teclear.
          const enCurso = decimales > 0 && /[,.]\d*$/.test(crudo)
          setBorrador(enCurso ? crudo.replace(/[^\d,.]/g, "") : null)
          onValueChange(n)
        }}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          setBorrador(null)
          onBlur?.(e)
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn("pl-7 tabular-nums", className)}
      />
    </div>
  )
}

/**
 * Campo de cantidad con separador de miles, sin el símbolo de peso.
 *
 * Es el mismo problema del dinero en el otro lado del formulario: escribir el
 * contenido de un bulto —25000 gramos— en un `type="number"` deja una fila de
 * ceros que nadie puede contar. Aquí se lee **25.000** mientras se teclea.
 *
 * Lleva `sufijo` para pintar la unidad dentro del campo ("g", "kg", "und"), que
 * es lo que quita la duda de en qué se está escribiendo.
 */
export function QuantityInput({
  id,
  value,
  onValueChange,
  placeholder,
  autoFocus,
  className,
  onKeyDown,
  onBlur,
  disabled,
  sufijo,
  /** Los pesos y volúmenes llevan decimales: 1,5 kg. Por eso 3 por defecto. */
  decimales = 3,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string
  value: number | null
  onValueChange: (value: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  disabled?: boolean
  sufijo?: React.ReactNode
  decimales?: number
  "aria-label"?: string
  "aria-describedby"?: string
}) {
  const [borrador, setBorrador] = React.useState<string | null>(null)

  const display =
    borrador !== null
      ? borrador
      : value === null || Number.isNaN(value)
        ? ""
        : new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: decimales,
          }).format(value)

  function aNumero(texto: string): number | null {
    const limpio =
      decimales > 0
        ? texto
            .replace(/\./g, ",")
            .replace(/[^\d,]/g, "")
            .replace(/,(?=.*,)/g, "")
            .replace(",", ".")
        : texto.replace(/\D/g, "")
    if (limpio === "" || limpio === ".") return null
    const n = Number(limpio)
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode={decimales > 0 ? "decimal" : "numeric"}
        value={display}
        onChange={(e) => {
          const crudo = e.target.value
          const enCurso = decimales > 0 && /[,.]\d*$/.test(crudo)
          setBorrador(enCurso ? crudo.replace(/[^\d,.]/g, "") : null)
          onValueChange(aNumero(crudo))
        }}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          setBorrador(null)
          onBlur?.(e)
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn("tabular-nums", sufijo ? "pr-14" : undefined, className)}
      />
      {sufijo && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 max-w-12 -translate-y-1/2 truncate text-xs font-medium text-muted-foreground"
        >
          {sufijo}
        </span>
      )}
    </div>
  )
}
