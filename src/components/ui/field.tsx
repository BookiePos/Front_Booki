"use client"

import * as React from "react"
import { ChevronDown, CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { HelpTip, type HelpTipProps } from "@/components/ui/help-tip"
import { SearchableSelect } from "@/components/ui/searchable-select"

/**
 * A partir de cuántas opciones la lista se vuelve buscable. Con cinco o seis
 * (tipo de documento, IVA) el `<select>` nativo es lo más rápido, sobre todo en
 * el celular; con la lista de productos o proveedores del negocio hay que
 * poder escribir para encontrar.
 */
const SEARCHABLE_FROM = 8

/**
 * Campo de formulario: etiqueta, ayuda, control, pista y error.
 *
 * Antes cada ficha montaba a mano un `div` con `flex flex-col gap-1.5`, un
 * `Label` y el control. Salía bien mientras el campo no necesitara nada más;
 * en cuanto hacía falta explicar qué es un SKU o avisar de un valor inválido,
 * cada pantalla lo resolvía distinto y ninguna quedaba igual que la de al
 * lado. Aquí está resuelto una vez: la pista va SIEMPRE debajo del control
 * (leerla antes de saber qué se pide no ayuda) y el error la sustituye, para
 * no apilar dos líneas de texto pequeño que compiten.
 *
 * El `id` se propaga al control con `htmlFor` + `aria-describedby`, así que el
 * lector de pantalla anuncia etiqueta, pista y error como un solo campo.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  help,
  className,
  children,
}: {
  /** Id del control. Necesario para que la etiqueta lo enfoque al pulsarla. */
  id?: string
  label: React.ReactNode
  /** Explicación corta bajo el campo ("Se genera solo si lo dejas vacío"). */
  hint?: React.ReactNode
  /** Mensaje de validación. Sustituye a la pista mientras esté presente. */
  error?: string | null
  required?: boolean
  /** Interrogación de ayuda junto a la etiqueta (glosario o texto suelto). */
  help?: HelpTipProps
  className?: string
  children: React.ReactNode
}) {
  const describedBy = error
    ? `${id ?? ""}-error`
    : hint
      ? `${id ?? ""}-hint`
      : undefined

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
        {help && <HelpTip {...help} />}
      </Label>

      {/* El control se clona solo si es un elemento: así `Field` sirve igual
          para un Input, un Select de Base UI o un bloque compuesto. */}
      {React.isValidElement(children) && describedBy
        ? React.cloneElement(
            children as React.ReactElement<{
              "aria-describedby"?: string
              "aria-invalid"?: boolean
            }>,
            {
              "aria-describedby": describedBy,
              ...(error ? { "aria-invalid": true } : {}),
            },
          )
        : children}

      {error ? (
        <p
          id={`${id ?? ""}-error`}
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id ?? ""}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Rejilla de campos. `cols` es el máximo en escritorio; siempre arranca en una
 * sola columna, que es como se rellena un formulario en un celular.
 */
export function FieldGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4
  className?: string
  children: React.ReactNode
}) {
  const grid = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols]
  return (
    <div className={cn("grid grid-cols-1 gap-x-4 gap-y-3.5", grid, className)}>
      {children}
    </div>
  )
}

/**
 * Fila de campos de ancho desigual dentro de una `FieldGrid`.
 *
 * Un "Tipo doc." y un "Número de documento" no merecen la misma mitad de la
 * rejilla: el primero cabe en cuatro caracteres y el segundo necesita diez.
 * `span` deja que un campo ocupe dos o tres columnas sin sacar `col-span-*` a
 * mano en cada página (y sin que Tailwind tenga que ver la clase construida).
 */
export function FieldSpan({
  span = 2,
  className,
  children,
}: {
  span?: 2 | 3 | 4
  className?: string
  children: React.ReactNode
}) {
  const cls = {
    2: "sm:col-span-2",
    3: "sm:col-span-2 lg:col-span-3",
    4: "sm:col-span-2 lg:col-span-4",
  }[span]
  return <div className={cn("min-w-0", cls, className)}>{children}</div>
}

/**
 * Desplegable nativo con el lenguaje visual de `Input`.
 *
 * Nativo a propósito y no el `Select` de Base UI: en celular y tablet —que es
 * donde se usa el POS— el `<select>` abre la rueda del sistema operativo, que
 * se maneja con el pulgar y no se sale de la pantalla. Un desplegable dibujado
 * a mano dentro de una tarjeta flotante tiene que pelear con el scroll del
 * cuerpo del formulario y casi siempre pierde.
 *
 * La flecha se dibuja aparte porque `appearance-none` borra la del navegador;
 * sin ella el campo parece un cuadro de texto que no responde al clic.
 */
export function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  ...props
}: Omit<React.ComponentProps<"select">, "onChange" | "value"> & {
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string; disabled?: boolean }[]
  /** Opción vacía inicial ("Sin cargo", "Todas las sedes"). */
  placeholder?: string
}) {
  if (options.length > SEARCHABLE_FROM) {
    return (
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        className={className}
        id={props.id}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={props["aria-describedby"]}
      />
    )
  }
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        data-slot="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-xl border border-input bg-card py-1 pr-9 pl-3 text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none",
          "hover:border-ring/45",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "md:text-sm dark:bg-input/25 dark:hover:bg-input/35",
          // Las opciones las pinta el sistema operativo. Con el fondo
          // semitransparente del campo en oscuro, Windows las dejaba en letra
          // clara sobre blanco: ilegibles. Se les da el color del menú.
          "[&_option]:bg-popover [&_option]:text-popover-foreground",
          // Sin valor elegido el texto va en gris, como el placeholder de Input.
          value === "" && placeholder && "text-muted-foreground",
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

/**
 * Casilla con su explicación, sobre una superficie propia.
 *
 * Una casilla suelta con tres palabras al lado se pierde entre campos de texto
 * y nadie la lee; encerrada y con una frase debajo se convierte en una decisión
 * consciente ("¿este producto se vence?"). Toda la caja es el área pulsable,
 * que es lo que pide un dedo.
 */
export function CheckboxField({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  help,
  disabled = false,
  className,
}: {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  help?: HelpTipProps
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors",
        "hover:border-primary/35 hover:bg-primary/[0.03]",
        "has-data-checked:border-primary/45 has-data-checked:bg-primary/[0.05]",
        disabled && "pointer-events-none opacity-55",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[0.8125rem] leading-none font-semibold text-foreground">
          {label}
          {help && <HelpTip {...help} />}
        </span>
        {hint && (
          <span className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  )
}
