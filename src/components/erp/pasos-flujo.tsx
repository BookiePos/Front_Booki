"use client"

/**
 * La tira de tres pasos: Inventario → Producto → Punto de venta.
 *
 * Existe porque el orden del sistema no se adivina desde ninguna pantalla.
 * Quien entra a Productos y pulsa "Nuevo" se encuentra un desplegable de
 * inventario vacío y ninguna pista de por qué: cree que el programa está
 * roto. Y no lo está — lo que se vende tiene que salir de algo que se compró,
 * porque si no, el sistema no sabe qué descontar de la bodega ni con qué
 * comparar el precio para decir cuánto se ganó.
 *
 * Se puede cerrar y se recuerda cerrada. Quien ya entendió el orden no
 * necesita que se lo repitan cada mañana; quien no, lo tiene delante.
 */

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Boxes, Package, ShoppingCart, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type PasoFlujo = "inventario" | "productos" | "pos"

const CLAVE = "bookipos.pasosFlujo.oculto"

const PASOS: {
  id: PasoFlujo
  n: number
  titulo: string
  frase: string
  href: string
  icon: React.ElementType
}[] = [
  {
    id: "inventario",
    n: 1,
    titulo: "Inventario",
    frase: "Registra lo que compras y cuánto tienes.",
    href: "/panel/inventario",
    icon: Boxes,
  },
  {
    id: "productos",
    n: 2,
    titulo: "Productos",
    frase: "Arma lo que vendes y ponle precio.",
    href: "/panel/productos",
    icon: Package,
  },
  {
    id: "pos",
    n: 3,
    titulo: "Punto de venta",
    frase: "Cobra: el stock baja solo.",
    href: "/pos",
    icon: ShoppingCart,
  },
]

export function PasosFlujo({
  activo,
  className,
}: {
  /** El paso en el que está parado quien mira. Se resalta. */
  activo: PasoFlujo
  className?: string
}) {
  const [oculto, setOculto] = React.useState(false)

  React.useEffect(() => {
    // El `await` de entrada saca el setState del cuerpo del efecto. Leer el
    // valor durante el render no sirve: en el servidor no hay localStorage y
    // la hidratación se rompería.
    async function leer() {
      await Promise.resolve()
      try {
        setOculto(window.localStorage.getItem(CLAVE) === "1")
      } catch {
        // Ventana privada o almacenamiento bloqueado: la tira se queda
        // visible, que es el mal menor.
      }
    }
    void leer()
  }, [])

  function cerrar() {
    setOculto(true)
    try {
      window.localStorage.setItem(CLAVE, "1")
    } catch {
      // Sin persistencia vuelve a salir la próxima vez. No es un error.
    }
  }

  if (oculto) return null

  return (
    <div
      className={cn(
        "relative mb-5 rounded-2xl border border-border bg-card p-3.5 sm:p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-semibold text-foreground">
          El orden de las cosas
          <span className="ml-2 font-normal text-muted-foreground">
            Lo que vendes sale de algo que compraste.
          </span>
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ocultar los pasos"
          title="Ocultar"
          onClick={cerrar}
          className="-mt-1 -mr-1 shrink-0"
        >
          <X />
        </Button>
      </div>

      <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1">
        {PASOS.map((paso, i) => {
          const Icon = paso.icon
          const esActivo = paso.id === activo
          return (
            <React.Fragment key={paso.id}>
              <li className="min-w-0 flex-1">
                <Link
                  href={paso.href}
                  className={cn(
                    "flex h-full items-start gap-2.5 rounded-xl border p-3 transition-colors",
                    esActivo
                      ? "border-primary/45 bg-primary/[0.06]"
                      : "border-border hover:border-primary/35 hover:bg-primary/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      esActivo
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {paso.n}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      {paso.titulo}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {paso.frase}
                    </span>
                  </span>
                </Link>
              </li>
              {i < PASOS.length - 1 && (
                <li
                  aria-hidden
                  className="hidden shrink-0 items-center px-0.5 sm:flex"
                >
                  <ArrowRight className="size-4 text-muted-foreground" />
                </li>
              )}
            </React.Fragment>
          )
        })}
      </ol>
    </div>
  )
}
