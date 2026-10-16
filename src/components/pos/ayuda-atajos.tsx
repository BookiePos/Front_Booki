"use client"

import { Keyboard } from "lucide-react"

import { ATAJOS_POS } from "@/hooks/use-atajos-pos"
import { Button } from "@/components/ui/button"
import { FormDialog } from "@/components/ui/form-dialog"

/** Botón «Atajos» y el cuadro con la lista; también se abre con «?». */
export function AyudaAtajos({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-keyshortcuts="?"
        onClick={() => onOpenChange(true)}
      >
        <Keyboard className="size-4" aria-hidden />
        Atajos
        <kbd className="rounded border border-border bg-card px-1 font-mono text-xs">
          ?
        </kbd>
      </Button>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Atajos de teclado"
        description="Con ellos se cobra sin soltar el teclado."
        icon={Keyboard}
        size="md"
      >
        <ul className="flex flex-col divide-y divide-border">
          {ATAJOS_POS.map((a) => (
            <li
              key={a.descripcion}
              className="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <span>{a.descripcion}</span>
              <span className="flex shrink-0 items-center gap-1">
                {a.teclas.map((t, i) => (
                  <span key={t} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">o</span>
                    )}
                    <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-xs">
                      {t}
                    </kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </FormDialog>
    </>
  )
}
