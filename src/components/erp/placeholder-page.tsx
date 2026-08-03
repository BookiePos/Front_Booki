import { Construction } from "lucide-react"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"

export function PlaceholderPage({
  title,
  section,
  description,
}: {
  title: string
  section?: string
  description?: string
}) {
  return (
    <>
      <PageHeader title={title} section={section} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Construction className="size-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              En construcción
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Este módulo estará disponible próximamente. La navegación y el
              diseño ya están listos.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
