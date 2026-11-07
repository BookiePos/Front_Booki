import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react"

import {
  TIPO_CONTINGENCIA_LABELS,
  plazoVisible,
  type ContingenciaDoc,
  type TonoPlazo,
} from "@/lib/contingencia-fe"
import { cn } from "@/lib/utils"

const ESTILO: Record<TonoPlazo, string> = {
  ok: "bg-success/10 text-success-ink",
  aviso: "border border-warning/40 bg-warning/10 text-warning-ink",
  error: "bg-destructive/10 text-destructive",
  neutro: "bg-muted text-muted-foreground",
}

const ICONO = {
  ok: CheckCircle2,
  aviso: Clock,
  error: AlertTriangle,
  neutro: Info,
} as const

/**
 * Plazo legal de 48 h de un documento de contingencia y, cuando la DIAN ya
 * tenía el original, la marca «la contingencia no aplicó». El icono y el texto
 * dicen el estado además del color. No pinta nada si el documento no es de
 * contingencia.
 */
export function PlazoContingencia({
  dianStatus,
  contingencia,
  className,
}: {
  dianStatus: string
  contingencia?: ContingenciaDoc | null
  className?: string
}) {
  const plazo = plazoVisible({ dianStatus, contingencia })
  if (!plazo || !contingencia) return null
  const Icono = ICONO[plazo.tono]
  return (
    <div
      role={plazo.tono === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-xl px-4 py-3 text-sm", ESTILO[plazo.tono], className)}
    >
      <Icono aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block font-medium">
          {TIPO_CONTINGENCIA_LABELS[contingencia.tipo]}
        </span>
        <span className="mt-0.5 block text-xs">{plazo.texto}</span>
        {contingencia.noAplico && contingencia.motivoNoAplico && (
          <span className="mt-0.5 block text-xs">{contingencia.motivoNoAplico}</span>
        )}
      </span>
    </div>
  )
}
