"use client"

import { usePathname } from "next/navigation"
import { SoporteWhatsapp } from "./soporte-whatsapp"

/** Igual que `SoporteWhatsapp`, pero oculto en /estado, que ya trae el enlace en línea. */
export function SoporteWhatsappRuta() {
  const ruta = usePathname()
  if (ruta === "/estado" || ruta?.startsWith("/estado/")) return null
  return <SoporteWhatsapp />
}
