"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, Compass, MessageCircle, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { ayudaParaRuta, type TareaAyuda } from "@/lib/ayuda/modulos"
import { cerrarAyuda, useAyudaAbierta } from "@/lib/ayuda/panel-store"
import { guideForPath } from "@/lib/onboarding/guides"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { buscarGlosario, obtenerEntrada, type TerminoGlosario } from "@/lib/glosario"
import { enlaceWhatsapp, SOPORTE } from "@/lib/soporte"
import { nombreSeccion } from "@/components/ui/titulo-pestana"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Panel de Ayuda: se despliega a la derecha, sin tapar la pantalla.
 *
 * Responde las dos preguntas de todos los días —"¿cómo hago para…?" y
 * "¿qué es esto?"— de la sección abierta. La persona lee el paso y lo hace
 * ahí mismo, con la pantalla a la vista; por eso no es un diálogo con fondo
 * oscuro sino una hoja lateral que convive con la página.
 *
 * El recorrido guiado sigue existiendo y se lanza desde aquí: enseña DÓNDE
 * está cada cosa, una vez. El panel queda para consultar siempre.
 */
export function PanelAyuda() {
  const abierto = useAyudaAbierta()
  const pathname = usePathname()
  const { startGuide } = useOnboarding()
  const [busqueda, setBusqueda] = React.useState("")
  const [abierta, setAbierta] = React.useState(0)
  const panelRef = React.useRef<HTMLElement>(null)

  const ayuda = ayudaParaRuta(pathname)
  const guia = guideForPath(pathname)
  const titulo = ayuda?.titulo ?? nombreSeccion(pathname) ?? "Esta pantalla"

  // Al cambiar de sección, se vuelve al inicio: la primera tarea abierta y
  // sin búsqueda vieja. El panel sigue abierto, así acompaña la navegación.
  const [rutaVista, setRutaVista] = React.useState(pathname)
  if (rutaVista !== pathname) {
    setRutaVista(pathname)
    setAbierta(0)
    setBusqueda("")
  }

  // Escape cierra. Al abrir, el foco va al panel para que el lector de
  // pantalla lo anuncie y el teclado quede adentro.
  React.useEffect(() => {
    if (!abierto) return
    panelRef.current?.focus()
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarAyuda()
    }
    document.addEventListener("keydown", alPulsar)
    return () => document.removeEventListener("keydown", alPulsar)
  }, [abierto])

  const encontrados = busqueda.trim().length >= 2 ? buscarGlosario(busqueda).slice(0, 8) : null
  const terminos: TerminoGlosario[] = encontrados ?? ayuda?.terminos ?? []
  const whatsapp = SOPORTE.whatsapp ? enlaceWhatsapp(`Hola, necesito ayuda con ${titulo} en BookiPos`) : null

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={`Ayuda: ${titulo}`}
      aria-hidden={!abierto}
      inert={!abierto}
      className={cn(
        "fixed inset-y-0 right-0 z-[60] flex w-full max-w-[26rem] flex-col border-l border-border bg-card text-card-foreground outline-none",
        "shadow-[-12px_0_32px_-16px_rgba(20,16,30,0.22)] transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "motion-reduce:transition-none",
        abierto ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0",
      )}
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 pt-4 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted-foreground">Ayuda</p>
          <h2 className="mt-0.5 text-[1.25rem] leading-tight font-semibold tracking-[-0.015em]">{titulo}</h2>
        </div>
        <button
          type="button"
          onClick={cerrarAyuda}
          aria-label="Cerrar la ayuda"
          className="-mr-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-[18px]" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        {ayuda && <p className="text-[15px] leading-relaxed text-pretty">{ayuda.paraQue}</p>}

        {guia && (
          <Button
            variant="outline"
            className="mt-4 w-full justify-start gap-2"
            onClick={() => {
              cerrarAyuda()
              startGuide(guia.id)
            }}
          >
            <Compass className="size-4 text-primary" aria-hidden />
            Muéstrame dónde está cada cosa
            <span className="ml-auto text-xs font-normal text-muted-foreground">1 min</span>
          </Button>
        )}

        {/* ── Cómo se hace ── */}
        {ayuda && ayuda.tareas.length > 0 && (
          <section className="mt-7">
            <h3 className="text-[13px] font-medium text-muted-foreground">Cómo se hace</h3>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {ayuda.tareas.map((t, i) => (
                <Tarea
                  key={t.titulo}
                  tarea={t}
                  abierta={abierta === i}
                  onAlternar={() => setAbierta(abierta === i ? -1 : i)}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Sin ayuda escrita: lo que enseña el recorrido, para leerlo de corrido. */}
        {!ayuda && guia && (
          <section className="mt-7">
            <h3 className="text-[13px] font-medium text-muted-foreground">Lo que hay en esta pantalla</h3>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {guia
                .build()
                .filter((p) => p.target)
                .map((p) => (
                  <li key={p.title} className="py-3">
                    <p className="text-[15px] font-medium">{p.title}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{p.body}</p>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {ayuda?.consejo && (
          <p className="mt-6 border-l-2 border-primary/50 pl-3 text-[14px] leading-relaxed text-pretty">
            {ayuda.consejo}
          </p>
        )}

        {/* ── Palabras ── */}
        <section className="mt-7">
          <h3 className="text-[13px] font-medium text-muted-foreground">
            {encontrados ? "Lo que encontré" : "Palabras de esta pantalla"}
          </h3>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca una palabra: IVA, arqueo, lote…"
              aria-label="Buscar una palabra en el glosario"
              className="pl-9"
            />
          </div>
          {terminos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {encontrados ? "No encontré esa palabra. Prueba con otra parecida." : "Escribe una palabra que no entiendas."}
            </p>
          ) : (
            <dl className="mt-1 divide-y divide-border">
              {terminos.map((t) => {
                const e = obtenerEntrada(t)
                return (
                  <div key={t} className="py-3">
                    <dt className="text-[15px] font-medium">{e.titulo}</dt>
                    <dd className="mt-0.5 text-[14px] leading-relaxed text-pretty text-muted-foreground">{e.texto}</dd>
                  </div>
                )
              })}
            </dl>
          )}
        </section>
      </div>

      {whatsapp && (
        <footer className="shrink-0 border-t border-border px-5 py-3">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <MessageCircle className="size-4" aria-hidden />
            ¿No lo encuentras? Escríbenos por WhatsApp
          </a>
          {SOPORTE.horario && <p className="mt-0.5 text-xs text-muted-foreground">{SOPORTE.horario}</p>}
        </footer>
      )}
    </aside>
  )
}

function Tarea({
  tarea,
  abierta,
  onAlternar,
}: {
  tarea: TareaAyuda
  abierta: boolean
  onAlternar: () => void
}) {
  const id = React.useId()
  return (
    <li>
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={onAlternar}
        className="flex w-full items-center gap-3 py-3 text-left text-[15px] font-medium transition-colors hover:text-primary"
      >
        <span className="min-w-0 flex-1">{tarea.titulo}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", abierta && "rotate-180")}
          aria-hidden
        />
      </button>
      {/* La altura se anima con grid-rows 0fr → 1fr: sin medir en JS y sin
          saltos, y el contenido sigue en el DOM para el lector de pantalla. */}
      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows] duration-250 ease-out motion-reduce:transition-none",
          abierta ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <ol className="min-h-0 overflow-hidden">
          {tarea.pasos.map((p, i) => (
            <li key={p} className="flex gap-3 pb-3 last:pb-4">
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="text-[14.5px] leading-relaxed text-pretty">{p}</span>
            </li>
          ))}
        </ol>
      </div>
    </li>
  )
}
