"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/** Para comparar al buscar: sin tildes ni mayúsculas ("Café" encuentra "cafe"). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

/** Todas las palabras escritas deben aparecer, en cualquier orden. */
function matches(option: SelectOption, query: string): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const label = normalizeSearch(option.label)
  return words.every((word) => label.includes(word))
}

/**
 * Lista desplegable en la que se escribe para filtrar.
 *
 * Existe porque un `<select>` nativo con doscientos productos obliga a bajar
 * con la rueda buscando uno, y en un celular es todavía peor. Aquí se escribe
 * "coca" y quedan las tres Coca-Cola. Las palabras se buscan sueltas y sin
 * tildes: "cola 400" encuentra "Coca Cola Original 400 ml".
 *
 * La interfaz es la misma que la de `NativeSelect` (valor como texto, cadena
 * vacía = nada elegido), así que se puede cambiar una por otra sin tocar el
 * estado del formulario.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "Sin coincidencias",
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  /** Opción vacía inicial ("Sin proveedor", "Crear producto nuevo"). */
  placeholder?: string
  emptyText?: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  "aria-describedby"?: string
}) {
  // La opción vacía va dentro de la lista para que "quitar la elección" sea
  // una opción más y no un botón escondido.
  const items = React.useMemo<SelectOption[]>(
    () =>
      placeholder !== undefined
        ? [{ value: "", label: placeholder }, ...options]
        : [...options],
    [options, placeholder],
  )
  const selected = items.find((option) => option.value === value) ?? null

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(option) => onChange(option?.value ?? "")}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, query) => matches(option, query)}
      disabled={disabled}
    >
      <div className={cn("relative min-w-0", className)}>
        <Combobox.Input
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          placeholder={placeholder ?? "Escribe para buscar…"}
          // Al entrar se selecciona el texto: se empieza a escribir encima y
          // no hay que borrar a mano el nombre de lo que estaba elegido.
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "h-9 w-full min-w-0 truncate rounded-xl border border-input bg-card py-1 pr-9 pl-3 text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none",
            "placeholder:text-muted-foreground hover:border-ring/45",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "md:text-sm dark:bg-input/25 dark:hover:bg-input/35",
          )}
        />
        <Combobox.Trigger
          aria-label="Ver opciones"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-xl text-muted-foreground outline-none disabled:opacity-60"
        >
          <ChevronDownIcon className="size-4" aria-hidden />
        </Combobox.Trigger>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50 outline-none">
          <Combobox.Popup
            className={cn(
              "w-(--anchor-width) max-w-(--available-width) min-w-56 origin-(--transform-origin) overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              "transition-[scale,opacity] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            )}
          >
            <Combobox.Empty>
              <div className="px-3 py-2.5 text-sm text-muted-foreground">
                {emptyText}
              </div>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
              {(option: SelectOption) => (
                <Combobox.Item
                  key={option.value || "__vacio"}
                  value={option}
                  disabled={option.disabled}
                  className={cn(
                    "relative flex cursor-default items-start gap-2 rounded-lg py-1.5 pr-8 pl-2.5 text-sm outline-none select-none",
                    "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                    "data-disabled:pointer-events-none data-disabled:opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 break-words",
                      option.value === "" && "text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                  <Combobox.ItemIndicator className="absolute top-1.5 right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
