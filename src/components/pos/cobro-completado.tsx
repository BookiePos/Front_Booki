"use client"

import * as React from "react"
import {
  CheckCircle2,
  Printer,
  AlertTriangle,
  FileText,
  Loader2,
  X,
  Info,
} from "lucide-react"
import { type Sale } from "@/lib/pos/api-sales"
import { money } from "@/lib/pos/format"
import { Receipt } from "@/components/pos/receipt"
import { Button } from "@/components/ui/button"
import {
  AbrirCajonButton,
  ImpresoraTermicaButton,
} from "@/components/pos/impresora-termica"
import { cn } from "@/lib/utils"
import { type Sede } from "@/lib/pos/api-inventory"

interface CobroCompletadoProps {
  sede: Sede | undefined
  setCheckoutOpen: React.Dispatch<React.SetStateAction<boolean>>
  completedSale: Sale
  printConfigured: boolean
  invoiceState: "idle" | "emitting" | "done" | "error"
  invoiceNumber: string | null
  invoiceError: string | null
  handlePrintReceipt: () => void | Promise<void>
  backToList: () => Promise<void>
}

export function CobroCompletado({
  sede,
  setCheckoutOpen,
  completedSale,
  printConfigured,
  invoiceState,
  invoiceNumber,
  invoiceError,
  handlePrintReceipt,
  backToList,
}: CobroCompletadoProps) {
  // Evita el doble clic mientras la tirilla viaja a la impresora.
  const [imprimiendo, setImprimiendo] = React.useState(false)
  return (
    <>
      <header className="no-print flex shrink-0 items-center gap-3 border-b border-border bg-success/10 px-5 py-4">
        <CheckCircle2 className="size-9 shrink-0 text-success-ink" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight">
            Venta registrada
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {completedSale.saleNumber}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => {
            setCheckoutOpen(false)
            void backToList()
          }}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Recibo a un lado, lo que hay que hacer ya al otro. La devuelta
          es lo urgente —el cliente está esperando su vuelto—, así que
          va primero y en grande; el recibo se consulta, no se cuenta. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-2 lg:overflow-hidden print:overflow-visible">
        <div className="flex flex-col gap-3 px-5 py-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain print:hidden">
          {/* La devuelta, grande: es lo que el cajero tiene que contar
              y entregar ya, con el cliente esperando. */}
          {/* Siempre que hubo devuelta, aunque el backend haya
              dejado un solo medio (todo con tarjeta y además se
              anotó efectivo: ese efectivo vuelve entero). */}
          {completedSale.payment.change !== undefined &&
            (completedSale.payment.method === "cash" ||
              completedSale.payment.change > 0) && (
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-success/10 px-4 py-5 text-center text-success-ink">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Devuelta
                </span>
                <span className="stat-figure text-4xl leading-none sm:text-5xl">
                  {money(completedSale.payment.change)}
                </span>
                {completedSale.payment.received !== undefined && (
                  <span className="text-xs opacity-80">
                    Pagó con {money(completedSale.payment.received)}
                  </span>
                )}
              </div>
            )}

          {/* Estado de la factura electrónica. Se muestra aparte del
              éxito de la venta a propósito: la venta está hecha aunque
              la DIAN falle, y mezclarlo haría dudar al cajero de si
              cobró o no. */}
          {invoiceState !== "idle" && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
                invoiceState === "done" && "bg-success/10 text-success-ink",
                invoiceState === "emitting" && "bg-accent text-accent-foreground",
                invoiceState === "error" &&
                  "bg-destructive/10 text-destructive",
              )}
            >
              {invoiceState === "emitting" && (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
              )}
              {invoiceState === "done" && (
                <FileText className="mt-0.5 size-4 shrink-0" />
              )}
              {invoiceState === "error" && (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              )}
              <span>
                {invoiceState === "emitting" && "Emitiendo factura electrónica…"}
                {invoiceState === "done" &&
                  `Factura electrónica emitida${invoiceNumber ? ` · ${invoiceNumber}` : ""}`}
                {invoiceState === "error" && (
                  <>
                    La venta quedó registrada, pero la factura no se pudo
                    emitir: {invoiceError}. Puedes emitirla desde{" "}
                    <strong>Factura electrónica</strong>.
                  </>
                )}
              </span>
            </div>
          )}

          {!printConfigured && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="size-3.5 text-primary" />
                Configura la impresión (solo esta vez)
              </p>
              <p className="text-muted-foreground">
                Al pulsar <span className="font-medium">Imprimir</span>,
                elige tu impresora de recibos y márcala como
                predeterminada. Para que las próximas ventas salgan sin
                diálogo, activa la impresión automática (modo kiosco) del
                navegador. Esta ayuda no volverá a aparecer.
              </p>
            </div>
          )}

          {completedSale.customer?.name && (
            <p className="text-sm text-muted-foreground">
              A nombre de{" "}
              <span className="font-medium text-foreground">
                {completedSale.customer.name}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col border-t border-border bg-muted/25 px-5 py-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-t-0 print:overflow-visible print:border-0 print:bg-transparent print:p-0">
          <Receipt sale={completedSale} sede={sede} />
        </div>
      </div>

      <footer className="no-print flex shrink-0 gap-2 border-t border-border bg-muted/40 px-5 py-3">
        <Button
          variant="outline"
          className="h-12 flex-1 gap-2"
          disabled={imprimiendo}
          onClick={async () => {
            setImprimiendo(true)
            try {
              await handlePrintReceipt()
            } finally {
              setImprimiendo(false)
            }
          }}
        >
          <Printer className="size-4" />
          Imprimir
        </Button>
        <ImpresoraTermicaButton />
        <AbrirCajonButton />
        <Button
          className="h-12 flex-1 text-base font-semibold"
          onClick={() => {
            setCheckoutOpen(false)
            void backToList()
          }}
        >
          Listo
        </Button>
      </footer>
    </>
  )
}
