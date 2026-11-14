"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import type { GuiaPaso } from "@/lib/erp/guia-fe"

/**
 * Desplegable «qué hacer afuera» de un paso del asistente de factura
 * electrónica. Va debajo del paso, a todo el ancho, para que en el móvil el
 * texto no compita con el botón. Usa solo tokens del tema (claro y oscuro).
 */
export function GuiaPasoDetalle({
  guia,
  abiertaAlInicio = false,
}: {
  guia: GuiaPaso
  abiertaAlInicio?: boolean
}) {
  const [abierta, setAbierta] = React.useState(abiertaAlInicio)
  return (
    <details
      className="group basis-full rounded-md border bg-muted/40 text-xs"
      open={abierta}
      onToggle={(e) => setAbierta(e.currentTarget.open)}
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-md px-3 py-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        {guia.titulo}
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3 text-muted-foreground">
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 [overflow-wrap:anywhere]">
          {guia.pasos.map((texto) => (
            <li key={texto}>{texto}</li>
          ))}
        </ol>
        {guia.bookipos && (
          <p>
            <span className="font-medium text-foreground">Después, BookiPos: </span>
            {guia.bookipos}
          </p>
        )}
        {guia.nota && (
          <p>
            <span className="font-medium text-foreground">Ten en cuenta: </span>
            {guia.nota}
          </p>
        )}
      </div>
    </details>
  )
}
