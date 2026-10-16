"use client"

import * as React from "react"
import { ClipboardList } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/field"
import { FormDialog, FormActions } from "@/components/ui/form-dialog"

interface NuevaCuentaDialogProps {
  sedeId: string
  orderBusy: boolean
  newOrderOpen: boolean
  setNewOrderOpen: React.Dispatch<React.SetStateAction<boolean>>
  newOrderName: string
  setNewOrderName: React.Dispatch<React.SetStateAction<string>>
  newOrderRef: React.RefObject<HTMLInputElement | null>
  newOrder: (name: string) => Promise<void>
}

export function NuevaCuentaDialog({
  sedeId,
  orderBusy,
  newOrderOpen,
  setNewOrderOpen,
  newOrderName,
  setNewOrderName,
  newOrderRef,
  newOrder,
}: NuevaCuentaDialogProps) {
  return (
    <FormDialog
      open={newOrderOpen}
      onOpenChange={(abierto) => {
        if (!abierto && orderBusy) return
        setNewOrderOpen(abierto)
      }}
      title="Nueva cuenta"
      description="Para dejar el consumo de una mesa o un cliente pendiente de cobrar."
      icon={ClipboardList}
      size="md"
      footer={
        <FormActions
          onCancel={() => setNewOrderOpen(false)}
          onSubmit={() => void newOrder(newOrderName)}
          submitLabel="Crear cuenta"
          busy={orderBusy}
          disabled={!sedeId}
        />
      }
    >
      <Field
        id="new-order-name"
        label="Nombre de la cuenta"
        hint="Puedes dejarlo en blanco y usar el número consecutivo."
      >
        <Input
          id="new-order-name"
          ref={newOrderRef}
          value={newOrderName}
          onChange={(e) => setNewOrderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void newOrder(newOrderName)
            }
          }}
          placeholder="Mesa 5, Juan, Terraza…"
        />
      </Field>
    </FormDialog>
  )
}
