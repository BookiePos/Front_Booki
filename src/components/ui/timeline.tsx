"use client"

// Basado en el Timeline de Hyperiux Vault (https://vault.hyperiux.com).
//
// Del original se conserva la idea: la sección se fija, la pista corre en
// horizontal con el scroll, la línea se dibuja de izquierda a derecha y cada
// hito levanta su tallo, su punto y su texto. Lo demás se rehízo para que
// quede bien encuadrado y en una sola coreografía:
//
//   · Todo se mide en vw y se conoce de antemano (ancho de pista, posición de
//     cada hito, distancia a correr), así que dos `gsap.timeline` atados al
//     scroll lo manejan todo. No hay disparadores sueltos que se adelanten o
//     se queden a medias según el ancho de pantalla.
//   · Mientras la sección sube a la pantalla se revelan, en orden, los hitos
//     que ya están a la vista; al fijarse llega dibujada. Después corre la
//     pista y cada hito se revela al cruzar el 85% del ancho. La línea llega
//     justo al tallo de cada hito cuando este aparece: nunca va adelantada ni
//     atrasada.
//   · El fijado deja libre la barra de navegación (pt-18), lleva el título de
//     la sección arriba a la izquierda (así el encuadre fijo dice de qué se
//     trata) y centra la pista en el espacio que queda.
//   · En celular no se fija: los hitos van en columna con una línea vertical.

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { cn } from "@/lib/utils"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

export type TimelineItem = {
  id: string
  /** El dolor: se muestra tachado. Un renglón (≤ 36 caracteres). */
  label: string
  /** La solución, en una frase corta. */
  content: string
  /** Lo que se ve de la solución: una pantalla. */
  media?: ReactNode
}

export type TimelineProps = {
  items: TimelineItem[]
  /** Título de la sección: va dentro del encuadre fijo, sobre la pista. */
  title?: ReactNode
  /** id del título que nombra la sección. */
  labelledBy?: string
  className?: string
  style?: CSSProperties
}

// Geometría de escritorio, en vw.
const MARGEN = 6 // aire a cada lado de la pista
const PASO = 27 // de un hito al siguiente
const ANCHO = 23 // ancho de cada hito
const UMBRAL = 85 // un hito se revela al cruzar este punto de la pantalla

// Tiempos del timeline, en "vw de recorrido": el scroll total del tramo fijado
// es la suma, así que 1 unidad = 1vw de rueda.
const INTRO = 34 // revelado de los hitos visibles, mientras la sección sube
const REVELADO = 11 // lo que dura el revelado de un hito
const RESPIRO = 10 // pausa al final, con todo a la vista, antes de soltar

export default function Timeline({ items, title, labelledBy, className, style }: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  const n = items.length
  const anchoPista = MARGEN * 2 + (n - 1) * PASO + ANCHO
  const anchoLinea = anchoPista - MARGEN * 2
  const distancia = Math.max(0, anchoPista - 100)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const pin = pinRef.current
    const track = trackRef.current
    const line = lineRef.current
    if (!section || !pin || !track || !line) return

    const mm = gsap.matchMedia(section)

    mm.add(
      {
        escritorio: "(min-width: 768px)",
        reducido: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { escritorio, reducido } = context.conditions as {
          escritorio: boolean
          reducido: boolean
        }
        const hitos = gsap.utils.toArray<HTMLElement>("[data-tl-item]", section)
        const partes = (hito: HTMLElement) => ({
          tallo: hito.querySelector("[data-tl-stem]"),
          punto: hito.querySelector("[data-tl-dot]"),
          tachado: hito.querySelector("[data-tl-strike]"),
          sube: hito.querySelectorAll("[data-tl-rise]"),
          medio: hito.querySelector("[data-tl-media]"),
        })

        // Celular: columna. Cada hito se tacha y aparece una vez al entrar.
        if (!escritorio) {
          if (reducido) return
          hitos.forEach((hito) => {
            const p = partes(hito)
            gsap
              .timeline({ scrollTrigger: { trigger: hito, start: "top 82%" } })
              .from(p.sube, { yPercent: 110, duration: 0.6, ease: "power3.out", stagger: 0.08 })
              .fromTo(
                p.tachado,
                { backgroundSize: "0% 2px" },
                { backgroundSize: "100% 2px", duration: 0.45, ease: "power2.inOut" },
                0.25,
              )
              .from(p.medio, { y: 24, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.35)
          })
          return
        }

        // Dos tramos. La intro corre mientras la sección SUBE a la pantalla
        // (del 70% al borde de arriba): revela los hitos que ya están a la
        // vista, así que al fijarse la pista ya llega dibujada y nunca se ve
        // un plano orquídea vacío. El tramo fijado solo corre la pista y
        // revela los que van entrando.
        const intro = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            start: "top 70%",
            end: "top top",
            scrub: reducido ? true : 0.9,
          },
        })
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${((reducido ? distancia : distancia + RESPIRO) * window.innerWidth) / 100}`,
            pin,
            scrub: reducido ? true : 0.9,
            invalidateOnRefresh: true,
          },
        })

        // xPercent es relativo al ancho de la pista, que está fijado en vw:
        // el desplazamiento es exacto en cualquier pantalla.
        tl.to(track, { xPercent: (-distancia / anchoPista) * 100, duration: distancia }, 0)

        if (reducido) return

        // Tiempos: la intro va de 0 a INTRO; el tramo fijado, de INTRO en
        // adelante en la misma escala (1 unidad = 1vw de recorrido).
        let lineaHasta = 0
        intro.set(line, { scaleX: 0 }, 0)
        hitos.forEach((hito, i) => {
          const x = MARGEN + i * PASO
          const visible = x < UMBRAL
          const t = visible ? (x / UMBRAL) * INTRO * 0.6 : INTRO + (x - UMBRAL)
          const p = partes(hito)
          // Cada animación va a su tramo, con su tiempo local.
          const linea = (destino: gsap.core.Timeline, desde: number, hasta: number, fraccion: number) =>
            destino.to(line, { scaleX: fraccion, duration: Math.max(0.01, hasta - desde), ease: "power1.inOut" }, desde)
          const dest = visible ? intro : tl
          const local = visible ? t : t - INTRO
          const fraccion = (x - MARGEN) / anchoLinea

          // La línea llega al tallo justo cuando este empieza a crecer. Si el
          // tramo cambia (último visible → primero de la corrida), arranca de
          // donde quedó.
          if (visible) linea(intro, lineaHasta, t, fraccion)
          else linea(tl, Math.max(0, lineaHasta - INTRO), local, fraccion)
          lineaHasta = t

          dest.fromTo(p.punto, { scale: 0 }, { scale: 1, duration: REVELADO * 0.2, ease: "back.out(2)" }, local)
            .fromTo(p.tallo, { scaleY: 0 }, { scaleY: 1, duration: REVELADO * 0.35, ease: "power2.out" }, local)
            .fromTo(p.sube, { yPercent: 110 }, { yPercent: 0, duration: REVELADO * 0.4, ease: "power3.out", stagger: REVELADO * 0.12 }, local + REVELADO * 0.2)
            .fromTo(
              p.tachado,
              { backgroundSize: "0% 2px" },
              { backgroundSize: "100% 2px", duration: REVELADO * 0.3, ease: "power2.inOut" },
              local + REVELADO * 0.45,
            )
            .fromTo(
              p.medio,
              { clipPath: "inset(0 100% 0 0)" },
              { clipPath: "inset(0 0% 0 0)", duration: REVELADO * 0.45, ease: "power3.out" },
              local + REVELADO * 0.55,
            )
        })

        // El resto de la línea, hasta el tope derecho, mientras termina la
        // corrida (tiempo local del tramo fijado); y el respiro final quieto.
        const desde = Math.max(0, lineaHasta - INTRO)
        if (distancia > desde) {
          tl.to(line, { scaleX: 1, duration: distancia - desde, ease: "power1.inOut" }, desde)
        }
        tl.to({}, { duration: RESPIRO }, distancia)
      },
    )

    return () => mm.revert()
  }, [items, anchoPista, anchoLinea, distancia])

  return (
    <section ref={sectionRef} aria-labelledby={labelledBy} className={cn("relative w-full overflow-hidden", className)} style={style}>
      <div ref={pinRef} className="md:flex md:h-svh md:flex-col md:justify-center md:pt-18">
        {title && (
          // A la misma distancia del borde que el primer hito (MARGEN).
          <div
            className="px-5 pt-24 sm:px-8 md:mb-[2.5vw] md:pt-0 md:pr-0 md:pl-[var(--tl-margen)]"
            style={{ "--tl-margen": `${MARGEN}vw` } as CSSProperties}
          >
            {title}
          </div>
        )}
        <div
          ref={trackRef}
          className="relative px-5 py-16 sm:px-8 md:h-[min(30vw,calc(100svh-17rem))] md:w-[var(--tl-pista)] md:shrink-0 md:p-0"
          style={{ "--tl-pista": `${anchoPista}vw` } as CSSProperties}
        >
          {/* Línea central (escritorio) con sus dos topes. */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 hidden h-[2px] -translate-y-1/2 md:block"
            style={{ left: `${MARGEN}vw`, width: `${anchoLinea}vw` }}
          >
            <div ref={lineRef} className="h-full w-full origin-left bg-current" />
            <span className="absolute top-1/2 -right-[0.35vw] size-[0.7vw] -translate-y-1/2 bg-current" />
          </div>

          <ol className="relative space-y-16 border-l-2 border-current pl-6 md:static md:space-y-0 md:border-0 md:pl-0">
            {items.map((item, i) => {
              const arriba = i % 2 === 0
              return (
                <li
                  key={item.id}
                  data-tl-item
                  className={cn(
                    "relative md:absolute md:h-1/2 md:w-[var(--tl-ancho)] md:left-[var(--tl-x)]",
                    arriba ? "md:top-0" : "md:top-1/2",
                  )}
                  style={
                    {
                      "--tl-x": `${MARGEN + i * PASO}vw`,
                      "--tl-ancho": `${ANCHO}vw`,
                    } as CSSProperties
                  }
                >
                  {/* Tallo y punto: del borde del hito a la línea central. */}
                  <span
                    aria-hidden="true"
                    data-tl-stem
                    className={cn(
                      "absolute left-0 hidden w-[2px] bg-current md:block",
                      arriba ? "top-[0.4vw] bottom-0 origin-bottom" : "top-0 bottom-[0.4vw] origin-top",
                    )}
                  />
                  <span
                    aria-hidden="true"
                    data-tl-dot
                    className={cn(
                      "absolute -left-[0.4vw] hidden size-[0.8vw] bg-brand-600 md:block",
                      arriba ? "top-0" : "bottom-0",
                    )}
                  />
                  {/* En celular, el punto va sobre la línea vertical. */}
                  <span aria-hidden="true" className="absolute top-1.5 -left-[calc(1.5rem+5px)] size-2 bg-brand-600 md:hidden" />

                  <div
                    className={cn(
                      "flex flex-col gap-5 md:h-full md:gap-[1vw] md:pl-[1.4vw]",
                      arriba ? "md:pb-[1.4vw]" : "md:flex-col-reverse md:justify-end md:pt-[1.4vw]",
                    )}
                  >
                    <div className={cn(!arriba && "md:mt-[0.2vw]")}>
                      <h3 className="overflow-hidden pb-[2px]">
                        <span data-tl-rise className="block font-titular text-base font-medium text-navy-950/75 md:text-[1.15vw] md:whitespace-nowrap">
                          <span className="sr-only">Antes: </span>
                          <span data-tl-strike className="tachado">
                            {item.label}
                          </span>
                        </span>
                      </h3>
                      <p className="mt-2 overflow-hidden md:mt-[0.5vw]">
                        <span data-tl-rise className="block font-titular text-xl leading-tight font-semibold tracking-[-0.02em] text-balance md:text-[1.55vw]">
                          <span className="sr-only">Con BookiPos: </span>
                          {item.content}
                        </span>
                      </p>
                    </div>
                    {item.media && (
                      <div data-tl-media className={cn("max-w-sm md:max-w-none", arriba && "md:mt-auto")}>
                        {item.media}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
