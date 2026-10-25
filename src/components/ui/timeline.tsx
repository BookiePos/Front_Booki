"use client"

// Basado en el Timeline de Hyperiux Vault (https://vault.hyperiux.com).
//
// Se conserva la mecánica del original: la sección se fija, la pista corre
// en horizontal con el scroll, la línea se dibuja de izquierda a derecha y cada
// hito levanta su tallo, su punto y su texto (líneas enmascaradas con
// SplitText) al llegar a pantalla. Cambia lo que el original traía fijo:
//   · Los hitos llegan por props, con un hueco para una pantalla (`media`).
//   · El desplazamiento se mide en píxeles con `invalidateOnRefresh`, no con
//     un porcentaje a ojo (-65%) que solo cuadraba con su contenido de demo.
//   · La entrada de cada hito usa `containerAnimation`: se dispara cuando el
//     hito cruza la pantalla dentro de la pista, sin tabla de posiciones.
//   · En celular la pista no se fija: los hitos van en columna con una línea
//     vertical. Una pista de 800vw a dedo no se puede leer.

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import { cn } from "@/lib/utils"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText)
}

export type TimelineItem = {
  id: string
  /** La marca de tiempo del hito: "7:10 a. m.", "Día 30". */
  label: string
  content: string
  /** Lo que se ve del hito: una pantalla, una foto. Va pegado a la línea. */
  media?: ReactNode
}

export type TimelineProps = {
  title: ReactNode
  periodLabel?: string
  /** Bloque grande que abre la pista, antes del primer hito. */
  lead?: ReactNode
  items: TimelineItem[]
  className?: string
  style?: CSSProperties
}

/** Separación entre hitos y ancho de cada uno, en vw (escritorio). */
const PASO = 15
const ANCHO = 24

export default function Timeline({
  title,
  periodLabel,
  lead,
  items,
  className,
  style,
}: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

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

        if (!escritorio) {
          // Celular: columna normal. Cada hito sube un poco al entrar.
          if (reducido) return
          hitos.forEach((hito) => {
            gsap.from(hito, {
              y: 32,
              opacity: 0,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: { trigger: hito, start: "top 88%" },
            })
          })
          return
        }

        const distancia = () => Math.max(0, track.scrollWidth - window.innerWidth)

        // El corrimiento lo maneja el scroll del usuario, no corre solo: se
        // conserva aun con movimiento reducido, que es la única forma de ver
        // los hitos de la derecha.
        // Se fija el contenedor de adentro y no la sección: el pin envuelve lo
        // fijado en un <div> espaciador, y si fuera la sección, React perdería
        // la pista de su nodo al re-renderizar a los hermanos (insertBefore).
        const slide = gsap.to(track, {
          x: () => -distancia(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distancia()}`,
            pin: pinRef.current,
            scrub: reducido ? true : 0.6,
            invalidateOnRefresh: true,
          },
        })

        const linea = section.querySelector<HTMLElement>("[data-tl-line]")
        if (reducido || !linea) return

        gsap.fromTo(
          linea,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: linea,
              containerAnimation: slide,
              start: "left 90%",
              end: "right 100%",
              scrub: true,
            },
          },
        )

        hitos.forEach((hito) => {
          const tallo = hito.querySelector("[data-tl-stem]")
          const punto = hito.querySelector("[data-tl-dot]")
          const medio = hito.querySelector("[data-tl-media]")
          const textos = hito.querySelectorAll<HTMLElement>("[data-tl-split]")

          // Los disparadores van pegados al borde derecho: la pista termina
          // con el último hito al ~70% del ancho, así que un final más a la
          // izquierda nunca llegaba y ese hito se quedaba a medio revelar.
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: hito,
              containerAnimation: slide,
              start: "left 100%",
              end: "left 76%",
              scrub: true,
            },
          })
          tl.fromTo(tallo, { scaleY: 0 }, { scaleY: 1, ease: "none", duration: 0.4 })
            .fromTo(punto, { scale: 0 }, { scale: 1, ease: "none", duration: 0.4 }, "<")
          if (medio) {
            tl.fromTo(
              medio,
              { clipPath: "inset(0 100% 0 0)" },
              { clipPath: "inset(0 0% 0 0)", ease: "power2.out", duration: 0.6 },
              0.15,
            )
          }

          // Líneas enmascaradas, como el original. `autoSplit` vuelve a
          // partir si la fuente termina de cargar o cambia el ancho.
          textos.forEach((el) => {
            SplitText.create(el, {
              type: "lines",
              mask: "lines",
              autoSplit: true,
              onSplit: (self) =>
                gsap.fromTo(
                  self.lines,
                  { yPercent: 100 },
                  {
                    yPercent: 0,
                    stagger: 0.08,
                    ease: "power2.out",
                    scrollTrigger: {
                      trigger: hito,
                      containerAnimation: slide,
                      start: "left 98%",
                      end: "left 78%",
                      scrub: true,
                    },
                  },
                ),
            })
          })
        })
      },
    )

    return () => mm.revert()
  }, [items])

  const anchoPista = `${(items.length - 1) * PASO + ANCHO}vw`

  return (
    <section ref={sectionRef} className={cn("relative w-full", className)} style={style}>
      <div ref={pinRef} className="md:flex md:h-svh md:items-center md:overflow-hidden">
        <div
          ref={trackRef}
          className="flex flex-col gap-14 px-5 py-20 sm:px-8 md:h-[min(42vw,80svh)] md:w-max md:flex-row md:items-stretch md:gap-[6vw] md:px-[5vw] md:py-0"
        >
          <div className="flex shrink-0 flex-col justify-between gap-8 md:w-[30vw]">
            <div>
              {title}
              {periodLabel && (
                <p className="mt-4 font-mono text-sm md:text-[1.05vw]">{periodLabel}</p>
              )}
            </div>
            {lead}
          </div>

          <div
            className="relative shrink-0 md:h-full md:w-[var(--tl-ancho)]"
            style={{ "--tl-ancho": anchoPista } as CSSProperties}
          >
            {/* Línea central (escritorio) con sus dos topes. */}
            <div
              aria-hidden="true"
              className="absolute top-1/2 left-0 hidden h-[2px] w-full -translate-y-1/2 md:block"
            >
              <div data-tl-line className="h-full w-full origin-left bg-current" />
              <span className="absolute top-1/2 -left-[0.35vw] size-[0.7vw] -translate-y-1/2 bg-current" />
              <span className="absolute top-1/2 -right-[0.35vw] size-[0.7vw] -translate-y-1/2 bg-current" />
            </div>

            <ol className="relative space-y-14 border-l-2 border-current pl-6 md:static md:space-y-0 md:border-0 md:pl-0">
              {items.map((item, i) => {
                const arriba = i % 2 === 0
                return (
                  <li
                    key={item.id}
                    data-tl-item
                    className={cn(
                      "relative md:absolute md:h-1/2 md:w-[var(--tl-item)] md:left-[var(--tl-x)]",
                      arriba ? "md:top-0" : "md:top-1/2",
                    )}
                    style={
                      {
                        "--tl-x": `${i * PASO}vw`,
                        "--tl-item": `${ANCHO}vw`,
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
                        "absolute -left-[0.4vw] hidden size-[0.8vw] bg-current md:block",
                        arriba ? "top-0" : "bottom-0",
                      )}
                    />
                    {/* En celular, el punto va sobre la línea vertical. */}
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 -left-[calc(1.5rem+5px)] size-2 bg-current md:hidden"
                    />

                    <div
                      className={cn(
                        "flex flex-col gap-3 md:h-full md:gap-[0.8vw] md:pl-[1.4vw]",
                        arriba ? "md:pb-[1.6vw]" : "md:flex-col-reverse md:justify-end md:pt-[1.6vw]",
                      )}
                    >
                      <div className={cn(!arriba && "md:mt-[0.4vw]")}>
                        <h3
                          data-tl-split
                          className="font-mono text-xl font-bold tracking-[-0.03em] md:text-[1.7vw] md:leading-none"
                        >
                          {item.label}
                        </h3>
                        <p
                          data-tl-split
                          className="mt-2 max-w-md text-pretty text-base leading-snug md:mt-[0.6vw] md:max-w-none md:text-[1.05vw]"
                        >
                          {item.content}
                        </p>
                      </div>
                      {item.media && (
                        <div data-tl-media className={cn(arriba ? "md:mt-auto" : "")}>
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
      </div>
    </section>
  )
}
