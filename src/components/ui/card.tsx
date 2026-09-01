import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tarjeta: la superficie sobre la que se apoya todo el panel.
 *
 * El borde es un poco más presente que antes y la esquina más redonda (20 px):
 * con el lienzo violeta claro del tema, un borde al 70 % desaparecía y las
 * tablas parecían flotar sin marco. `tone` tiñe la tarjeta cuando comunica un
 * estado —aviso de stock, lote vencido, explicación de un módulo— para no
 * tener que repetir la misma combinación de clases en cada página.
 */
function Card({
  className,
  size = "default",
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  tone?: "default" | "brand" | "warning" | "danger" | "success"
}) {
  const tones = {
    default: "border-border bg-card",
    brand: "border-primary/25 bg-primary/[0.045]",
    warning: "border-warning/35 bg-warning/[0.07]",
    danger: "border-destructive/35 bg-destructive/[0.06]",
    success: "border-success/35 bg-success/[0.06]",
  }[tone]

  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-2xl border py-(--card-spacing) text-sm text-card-foreground shadow-sm",
        "[--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
        "data-[size=sm]:[--card-spacing:--spacing(4)] data-[size=sm]:has-data-[slot=card-footer]:pb-0",
        "*:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl",
        tones,
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-2xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-display text-[1.0625rem] leading-snug tracking-[-0.01em] text-foreground group-data-[size=sm]/card:text-[0.9375rem]",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[0.8125rem] leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex flex-wrap items-center justify-end gap-2 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-2xl border-t bg-muted/40 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
