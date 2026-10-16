import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

/** Ruta inexistente dentro del panel. */
export default function PanelNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Pantalla no encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta página del panel no existe o fue movida.
      </p>
      <Link href="/panel" className={buttonVariants()}>Volver al panel</Link>
    </div>
  )
}
