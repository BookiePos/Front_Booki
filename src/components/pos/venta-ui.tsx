"use client"

import * as React from "react"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { SaveState } from "@/components/pos/venta-helpers"

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Guardando
      </span>
    )
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-success-ink">
        <Check className="size-3.5" />
        Guardado
      </span>
    )
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="size-3.5" />
        Sin guardar
      </span>
    )
  }
  return null
}

/**
 * Atajo de teclado, escrito donde se usa.
 *
 * Los dos que hay —Enter para agregar lo escaneado y Ctrl K para buscar en todo
 * el terminal— ya existían y no los descubría nadie. En un monitor ancho sobra
 * sitio a la derecha del filtro de categorías, así que se dicen ahí en vez de
 * dejar el hueco en blanco.
 */
export function Atajo({
  tecla,
  children,
}: {
  tecla: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">
        {tecla}
      </kbd>
      {children}
    </span>
  )
}

export function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function Guard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType
  title: string
  text: string
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-10 text-muted-foreground" />
        <p className="font-display text-lg text-foreground">{title}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}
