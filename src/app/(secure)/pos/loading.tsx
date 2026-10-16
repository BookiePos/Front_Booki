import { Skeleton } from "@/components/ui/skeleton"

/** Estado de carga de la ruta mientras llega su contenido. */
export default function Loading() {
  return (
    <div className="space-y-4 p-6" role="status" aria-label="Cargando">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
