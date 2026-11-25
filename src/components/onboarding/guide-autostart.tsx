"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"

import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { guideForPath } from "@/lib/onboarding/guides"
import { abrirAyuda, useAyudaAbierta } from "@/lib/ayuda/panel-store"
import { ayudaParaRuta } from "@/lib/ayuda/modulos"
import { nombreSeccion } from "@/components/ui/titulo-pestana"
import { Button } from "@/components/ui/button"

/**
 * La primera vez que alguien entra a un módulo, una invitación pequeña en la
 * esquina: "¿Te muestro?". Una sola vez por módulo (se recuerda en el
 * navegador) y nunca más.
 *
 * Antes el recorrido se lanzaba solo y oscurecía la pantalla en cada módulo
 * nuevo: quien entraba a registrar una compra con el proveedor esperando se
 * encontraba con un tour que tenía que cerrar antes de hacer nada. Ahora la
 * pantalla queda usable; el recorrido es para quien lo pida.
 *
 * Se va sola al cambiar de sección. No sale si hay una bienvenida o un
 * recorrido en curso, ni con el panel de Ayuda ya abierto.
 */
export function GuideAutoStart() {
  const pathname = usePathname()
  const { ready, guide, welcomeOpen, hasSeenGuide, markGuideSeen, startGuide } = useOnboarding()
  const ayudaAbierta = useAyudaAbierta()
  const [invitacion, setInvitacion] = React.useState<{ id: string; ruta: string } | null>(null)

  React.useEffect(() => {
    // Espera a que se cargue lo ya visto: sin esto, cada login leería el
    // estado vacío e invitaría otra vez en módulos ya conocidos.
    if (!ready || guide !== null || welcomeOpen) return
    const match = guideForPath(pathname)
    if (!match || hasSeenGuide(match.id)) return
    markGuideSeen(match.id)
    // Diferido: que la invitación no aparezca en el mismo cuadro en que se
    // pinta la página, sino un instante después, ya con todo en su sitio.
    // Sin limpiar el temporizador a propósito: marcarla como vista cambia
    // `hasSeenGuide` y vuelve a correr este efecto, y limpiarlo ahí la
    // cancelaría antes de salir. Si la persona ya se fue de la sección, la
    // comparación de `ruta` de abajo la deja sin mostrar.
    //
    // Y espera a que no haya ningún diálogo abierto (las novedades al entrar,
    // por ejemplo): dos cosas pidiendo atención a la vez es una de más.
    const ruta = pathname
    const intentar = () => {
      if (window.location.pathname !== ruta) return
      if (document.querySelector("[aria-modal=\"true\"]")) {
        window.setTimeout(intentar, 800)
        return
      }
      setInvitacion({ id: match.id, ruta })
    }
    window.setTimeout(intentar, 700)
  }, [ready, pathname, guide, welcomeOpen, hasSeenGuide, markGuideSeen])

  const visible = invitacion !== null && invitacion.ruta === pathname && guide === null && !ayudaAbierta
  if (!visible) return null

  const titulo = ayudaParaRuta(pathname)?.titulo ?? nombreSeccion(pathname) ?? "esta sección"

  return (
    <div
      role="status"
      className="fixed right-4 bottom-20 z-[55] w-[min(22rem,calc(100vw-2rem))] rounded-[8px] border border-border bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(20,16,30,0.06),0_16px_40px_-14px_rgba(20,16,30,0.3)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 lg:bottom-5"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Primera vez en {titulo}</p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">
            Te muestro en un minuto dónde está cada cosa, o lees cómo se hace cada tarea.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInvitacion(null)}
          aria-label="No, gracias"
          className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setInvitacion(null)
            startGuide(invitacion.id)
          }}
        >
          Muéstrame
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInvitacion(null)
            abrirAyuda()
          }}
        >
          Ver la ayuda
        </Button>
      </div>
    </div>
  )
}
