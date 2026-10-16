import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

/** 404 global: cualquier URL que no cae en /pos ni en /panel. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        La dirección que buscas no existe o fue movida.
      </p>
      <Link href="/" className={buttonVariants()}>Ir al inicio</Link>
    </main>
  )
}
