import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BookiPosMark } from "@/components/marketing/bookipos-logo"

/**
 * Panel de marca fijo de las pantallas cortas de acceso (login, recuperar
 * contraseña). Es markup estático —sin estado ni handlers—, así que no lleva
 * `"use client"`: puede renderizarse en servidor cuando lo use una página que
 * no sea de cliente.
 *
 * El registro usa `auth/brand-panel` en su lugar: aquel formulario es largo y
 * necesita un panel `sticky` que acompañe al scroll, con el coste de re-render
 * por frame que eso implica. Aquí no hay scroll que acompañar.
 */
export function AuthBrandAside({
  titulo,
  bajada,
}: {
  titulo: string
  bajada: string
}) {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-950 p-12 lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/4 h-[34rem] w-[34rem] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-brand-500) 0%, transparent 68%)",
        }}
      />
      <Link
        href="/"
        className="relative inline-flex items-center gap-2 text-sm font-medium text-brand-200 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a bookipos.com
      </Link>

      <div className="relative">
        <BookiPosMark className="h-16 w-16" tone="light" />
        <p className="mt-8 max-w-md text-balance font-display text-4xl font-semibold leading-tight text-white">
          {titulo}
        </p>
        <p className="mt-5 max-w-sm leading-relaxed text-brand-200">{bajada}</p>
      </div>

      <p className="relative text-sm text-brand-300">
        Punto de venta y sistema operacional · Colombia
      </p>
    </aside>
  )
}
