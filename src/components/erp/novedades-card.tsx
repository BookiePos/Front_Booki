"use client"

import * as React from "react"
import { Sparkles, X } from "lucide-react"

import {
  NOVEDADES,
  debeMostrarse,
  leerVistaEnSesion,
  marcarVistaEnSesion,
} from "@/lib/novedades"
import { Button } from "@/components/ui/button"

/**
 * Tarjeta de novedades: qué trae la última versión, al abrir el sistema.
 *
 * Nadie lee un historial de versiones en GitHub — quien usa esto está detrás de
 * un mostrador. Una función nueva que no se anuncia dentro de la aplicación,
 * sencillamente no existe.
 *
 * Cuándo sale está en `debeMostrarse`: cada vez que se inicia sesión (o se
 * abre el navegador de nuevo), una sola vez por sesión.
 *
 * NO bloquea nada: se puede cerrar con Escape, con el botón, o tocando fuera. Si
 * alguien llega corriendo a cobrar, la tarjeta se quita de en medio sin pelear.
 */
export function NovedadesCard() {
  const [abierta, setAbierta] = React.useState(false)

  React.useEffect(() => {
    let vivo = true
    // El `await` de entrada saca el setState del cuerpo del efecto y, de paso,
    // deja que la pantalla pinte antes: la tarjeta no debe retrasar lo que la
    // persona vino a hacer.
    async function decidir() {
      await Promise.resolve()
      if (!vivo) return
      if (!debeMostrarse(leerVistaEnSesion(), NOVEDADES.version)) return
      setAbierta(true)
      // Se marca al mostrarla, no al cerrarla: navegar entre pantallas no tiene
      // por qué volver a sacarla.
      marcarVistaEnSesion(NOVEDADES.version)
    }
    void decidir()
    return () => {
      vivo = false
    }
  }, [])

  const cerrar = React.useCallback(() => setAbierta(false), [])

  // Escape la quita, como cualquier capa del sistema.
  React.useEffect(() => {
    if (!abierta) return
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar()
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [abierta, cerrar])

  if (!abierta) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="novedades-titulo"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* El fondo difuminado: deja ver que la pantalla sigue ahí detrás, así la
          tarjeta se siente como un aviso y no como una puerta cerrada. */}
      <button
        type="button"
        aria-label="Cerrar novedades"
        onClick={cerrar}
        className="absolute inset-0 cursor-default bg-brand-950/50 supports-backdrop-filter:backdrop-blur-md supports-backdrop-filter:backdrop-saturate-150"
      />

      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-brand-400/30 bg-gradient-to-br from-brand-700 to-brand-950 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-start gap-3 px-6 pb-4 pt-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Sparkles className="size-5 text-white" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-200">
              Versión {NOVEDADES.version} · {NOVEDADES.fecha}
            </p>
            <h2
              id="novedades-titulo"
              className="font-display text-2xl leading-tight text-white"
            >
              {NOVEDADES.titulo}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="-mr-2 -mt-2 rounded-lg p-2 text-brand-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <p className="px-6 text-sm text-brand-100">{NOVEDADES.resumen}</p>

        {/* La lista se desplaza sola: con varios puntos no cabe en una pantalla
            de celular sin dejar el botón fuera de alcance. */}
        <ul className="mt-4 flex flex-col gap-2 overflow-y-auto px-6 pb-2">
          {NOVEDADES.puntos.map((p) => (
            <li
              // Por el texto y no por `donde`: dos puntos pueden estar en la
              // misma pantalla.
              key={p.texto}
              className="rounded-xl bg-white/10 p-3 text-sm text-white"
            >
              <p className="font-medium text-brand-100">{p.donde}</p>
              <p className="mt-0.5 leading-snug text-white/90">{p.texto}</p>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <span className="text-xs text-brand-200">
            Sale cada vez que inicias sesión.
          </span>
          <Button
            variant="soft"
            className="bg-white text-brand-900 hover:bg-brand-50"
            onClick={cerrar}
          >
            Entendido
          </Button>
        </div>
      </div>
    </div>
  )
}
