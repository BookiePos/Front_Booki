import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

/** Ruta inexistente dentro del punto de venta. */
export default function PosNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Pantalla no encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta pantalla del punto de venta no existe o fue movida.
      </p>
      <Link href="/pos" className={buttonVariants()}>Volver al punto de venta</Link>
    </div>
  )
}
