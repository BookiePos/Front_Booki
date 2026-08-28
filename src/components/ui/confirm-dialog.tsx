"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Estiliza el botón principal como destructivo (borrar, anular…). */
  destructive?: boolean
}

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void
}

/**
 * Diálogo de confirmación accesible que reemplaza a `window.confirm`.
 *
 * Uso:
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title: "¿Borrar?", destructive: true })
 *   if (!ok) return
 *
 * Monta un solo <ConfirmProvider> alto en el árbol (o por página) y llama
 * `useConfirm()` donde lo necesites.
 */
const ConfirmContext = React.createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  const close = React.useCallback(
    (ok: boolean) => {
      pending?.resolve(ok)
      setPending(null)
    },
    [pending],
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogPrimitive.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close(false)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/30 dark:bg-black/60 transition-opacity duration-150",
              "data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
            )}
          />
          <DialogPrimitive.Popup
            className={cn(
              "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
              "rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-lg",
              "transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-starting-style:scale-95",
            )}
          >
            {pending && (
              <>
                <DialogPrimitive.Title className="font-display text-lg text-foreground">
                  {pending.title}
                </DialogPrimitive.Title>
                {pending.description && (
                  <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
                    {pending.description}
                  </DialogPrimitive.Description>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => close(false)}
                    autoFocus
                  >
                    {pending.cancelLabel ?? "Cancelar"}
                  </Button>
                  <Button
                    variant={pending.destructive ? "destructive" : "default"}
                    onClick={() => close(true)}
                  >
                    {pending.confirmLabel ?? "Confirmar"}
                  </Button>
                </div>
              </>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>")
  }
  return ctx
}
