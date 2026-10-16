"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export type Tab =
  "productos" | "empaques" | "existencias" | "lotes" | "movimientos"

/**
 * Qué se ve en cada pestaña, contado con las palabras del negocio.
 *
 * Las cuatro pestañas se llamaban con una sola palabra cada una y ninguna
 * decía para qué sirve: "Lotes" y "Movimientos" no significan nada para quien
 * no lleva inventarios de oficio. Y la primera se llamaba "Productos", igual
 * que la PANTALLA de Productos del menú, que es otra cosa —lo que se vende—:
 * eran dos sitios distintos con el mismo nombre.
 */
export const TAB_INFO: Record<Tab, { label: string; frase: string }> = {
  productos: {
    label: "Insumos y mercancía",
    frase:
      "Todo lo que manejas: las fichas de lo que compras, con su unidad, su presentación y su costo. Todavía no dice cuánto tienes.",
  },
  empaques: {
    label: "Empaques",
    frase:
      "Bolsas, vasos, cajas y cubiertos, con su foto para reconocerlos. Se compran y se cuentan como todo lo demás, pero se gastan al vender: en la caja se elige con cuáles sale cada pedido.",
  },
  existencias: {
    label: "Existencias",
    frase: "Cuánto tienes ahora mismo en cada sede, y qué está por acabarse.",
  },
  lotes: {
    label: "Lotes",
    frase:
      "Cada tanda que entró, con su vencimiento. Sirve para sacar primero lo que se vence antes.",
  },
  movimientos: {
    label: "Movimientos",
    frase:
      "La historia: cada entrada, salida, venta y ajuste, con su fecha y quién lo hizo. Aquí se mira cuando no cuadra algo.",
  },
}

/**
 * Una opción del menú "Herramientas", con su frase de qué hace.
 *
 * El nombre solo no basta —"Conteo" o "Merma" no le dicen nada a quien nunca
 * los ha usado— y probarlos para averiguarlo es justo lo que da miedo en una
 * pantalla que toca el inventario.
 */
export function HerramientaItem({
  icon: Icon,
  titulo,
  frase,
  onClick,
  disabled,
}: {
  icon: React.ElementType
  titulo: string
  frase: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenuItem
      className="items-start gap-2.5 px-2 py-2"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{titulo}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {frase}
        </span>
      </span>
    </DropdownMenuItem>
  )
}

/**
 * Estado vacío con salida: qué es esto, qué falta y el botón para hacerlo.
 *
 * Una pestaña vacía con "Sin movimientos registrados" y nada más deja a quien
 * empieza sin saber si el programa falló o si le toca hacer algo.
 */
export function VacioConSalida({
  icon: Icon,
  titulo,
  frase,
  accion,
}: {
  icon: React.ElementType
  titulo: string
  frase: string
  accion?: { texto: string; icon: React.ElementType; onClick: () => void }
}) {
  const AccionIcon = accion?.icon
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Icon className="size-9 text-muted-foreground" aria-hidden />
      <p className="font-display text-base text-foreground">{titulo}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {frase}
      </p>
      {accion && (
        <Button className="mt-2" onClick={accion.onClick}>
          {AccionIcon && <AccionIcon />}
          {accion.texto}
        </Button>
      )}
    </div>
  )
}
