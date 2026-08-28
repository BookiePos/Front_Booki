import { HardHat } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/** Placeholder para secciones cuyo backend aún no existe. */
export function Construction({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-warning/15 text-warning-ink">
          <HardHat className="size-8" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="text-sm font-medium text-warning-ink">En construcción</p>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description ??
            "Esta sección estará disponible pronto. Estamos trabajando en ella."}
        </p>
      </CardContent>
    </Card>
  )
}
