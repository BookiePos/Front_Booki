import { AlertTriangle, Clock, FileCheck2, Loader2 } from "lucide-react"
import type { DocumentoFiscalVenta } from "@/lib/pos/api-sales"
import { avisoDocumentoFiscal, type TonoAviso } from "@/lib/pos/documento-fiscal"
import { cn } from "@/lib/utils"

const ESTILO: Record<TonoAviso, string> = {
  ok: "bg-success/10 text-success-ink",
  progreso: "bg-accent text-accent-foreground",
  atencion: "border border-warning/40 bg-warning/10 text-warning-ink",
  error: "bg-destructive/10 text-destructive",
}

const ICONO = {
  ok: FileCheck2,
  progreso: Loader2,
  atencion: Clock,
  error: AlertTriangle,
} as const

/**
 * Estado del documento fiscal tras cobrar. Es un aviso SEPARADO del «Venta
 * registrada»: un error de la DIAN no es un error del cobro, y el cajero no
 * debe volver a cobrar por verlo en rojo. El icono y el título dicen el estado
 * además del color (el color nunca va solo).
 */
export function AvisoDocumentoFiscal({
  documentoFiscal,
  className,
}: {
  documentoFiscal: DocumentoFiscalVenta | undefined
  className?: string
}) {
  const aviso = avisoDocumentoFiscal(documentoFiscal)
  if (!aviso) return null
  const Icono = ICONO[aviso.tono]
  return (
    <div
      role={aviso.tono === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
        ESTILO[aviso.tono],
        className,
      )}
    >
      <Icono
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          aviso.tono === "progreso" && "animate-spin motion-reduce:animate-none",
        )}
      />
      <span className="min-w-0">
        <span className="block font-medium">{aviso.titulo}</span>
        {aviso.detalle && <span className="mt-0.5 block text-xs">{aviso.detalle}</span>}
      </span>
    </div>
  )
}
