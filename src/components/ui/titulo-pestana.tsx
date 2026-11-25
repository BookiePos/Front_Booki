"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { dashboardItem, navSections } from "@/lib/erp/navigation"
import { navItems as navPos } from "@/lib/pos/navigation"
import { nombreDeRuta, tituloPestana, type RutaConNombre } from "@/lib/titulo-pestana"

const RUTAS: Record<"panel" | "pos", RutaConNombre[]> = {
  panel: [dashboardItem, ...navSections.flatMap((s) => s.items)],
  pos: navPos,
}

/** Nombre de la sección abierta, tal como sale en el menú (o null). */
export function nombreSeccion(pathname: string): string | null {
  const zona = pathname.startsWith("/pos") ? "pos" : "panel"
  return nombreDeRuta(pathname, RUTAS[zona])
}

/**
 * Pone en la pestaña del navegador el nombre de la sección abierta. No pinta
 * nada. Ver `lib/titulo-pestana.ts` para el porqué.
 */
export function TituloPestana({ zona }: { zona: "panel" | "pos" }) {
  const pathname = usePathname()
  React.useEffect(() => {
    const deseado = tituloPestana(nombreDeRuta(pathname, RUTAS[zona]))
    const poner = () => {
      if (document.title !== deseado) document.title = deseado
    }
    poner()
    // Al navegar dentro de la app, Next vuelve a escribir el título del
    // layout DESPUÉS de este efecto. Se vigila el <head> y se repone; al
    // ponerlo igual no hay cambio, así que no se queda en un ciclo.
    const vigia = new MutationObserver(poner)
    vigia.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => vigia.disconnect()
  }, [pathname, zona])
  return null
}
