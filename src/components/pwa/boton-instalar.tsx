"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Botón "Instalar app". Chrome/Android dispara `beforeinstallprompt`; iOS no
 * tiene ese evento, así que ahí se explica el camino manual. Si la app ya está
 * instalada (modo standalone) no se muestra nada.
 */
export function BotonInstalar() {
  const [evento, setEvento] = React.useState<EventoInstalar | null>(null)
  const [ios, setIos] = React.useState(false)
  const [instalada, setInstalada] = React.useState(true)

  React.useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del navegador
    setInstalada(standalone)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const alPrompt = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstalar)
    }
    const alInstalar = () => setInstalada(true)
    window.addEventListener("beforeinstallprompt", alPrompt)
    window.addEventListener("appinstalled", alInstalar)
    return () => {
      window.removeEventListener("beforeinstallprompt", alPrompt)
      window.removeEventListener("appinstalled", alInstalar)
    }
  }, [])

  if (instalada) return null
  if (evento) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await evento.prompt()
          await evento.userChoice
          setEvento(null)
        }}
      >
        <Download />
        Instalar app
      </Button>
    )
  }
  if (ios) {
    return (
      <p className="text-xs text-muted-foreground">
        Para instalar: toca Compartir y luego «Agregar a pantalla de inicio».
      </p>
    )
  }
  return null
}
