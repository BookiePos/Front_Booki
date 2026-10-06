import { AlertTriangle, CheckCircle2 } from "lucide-react"

import {
  DIAN_TONE_CLASS,
  dianStatusInfo,
  type DianStatusInput,
} from "@/lib/einvoicing-status"
import { cn } from "@/lib/utils"

/** Lo que el bloque necesita del documento (vale para el del POS y el del panel). */
export interface DianDetailDoc extends DianStatusInput {
  dianMessage?: string
  dianErrors?: string[]
  nextAttemptAt?: string
}

/**
 * Estado del documento ante la DIAN, con lo que respondió. Es lo que hace
 * falta para saber si la factura vale y, si la rechazaron, qué corregir.
 */
export function DianDetail({
  doc,
  className,
}: {
  doc: DianDetailDoc
  className?: string
}) {
  const info = dianStatusInfo(doc)
  const errores = doc.dianErrors ?? []
  return (
    <div
      className={cn(
        "no-print rounded-xl px-4 py-3 text-sm",
        DIAN_TONE_CLASS[info.tone],
        className,
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {info.fiscal ? (
          <CheckCircle2 className="size-4 shrink-0" />
        ) : (
          <AlertTriangle className="size-4 shrink-0" />
        )}
        {info.label}
      </p>
      <p className="mt-1">{info.note}</p>
      {doc.dianMessage && doc.dianStatus !== "accepted" && (
        <p className="mt-1">Respuesta: {doc.dianMessage}</p>
      )}
      {errores.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {doc.dianStatus === "pending" && doc.nextAttemptAt && (
        <p className="mt-1 text-xs">
          Próximo intento:{" "}
          {new Date(doc.nextAttemptAt).toLocaleString("es-CO")}
        </p>
      )}
    </div>
  )
}
