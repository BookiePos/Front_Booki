"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, X } from "lucide-react"

import {
  NOVEDADES,
  debeMostrarse,
  leerVistaEnSesion,
  marcarVistaEnSesion,
  type MediaNovedad,
} from "@/lib/novedades"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Tarjeta de novedades: qué trae la última versión, al abrir el sistema.
 *
 * Nadie lee un historial de versiones en GitHub — quien usa esto está detrás de
 * un mostrador. Una función nueva que no se anuncia dentro de la aplicación,
 * sencillamente no existe.
 *
 * Hasta la 1.5.0 era un recuadro morado con un dibujo esquemático por página,
 * y el dueño lo dijo sin rodeos: se veía a medio construir, sin imágenes reales
 * ni movimiento, y no dejaba ver de verdad qué había cambiado. Ahora:
 *
 * - **Se ve el sistema, no un dibujo.** Cada página trae un video corto grabado
 *   sobre la aplicación real, o un "antes y ahora" que se arrastra.
 * - **La imagen manda.** En pantalla ancha ocupa más de la mitad de la tarjeta;
 *   el texto va al lado, corto, con un botón que lleva a la pantalla.
 * - **Papel, no cartel.** Fondo blanco con una línea fina, como el resto del
 *   sistema; el violeta queda para el botón principal y el avance.
 *
 * Cuándo sale está en `debeMostrarse`: una vez por sesión. NO bloquea nada: se
 * cierra con Escape, con la X o tocando fuera.
 */
export function NovedadesCard() {
  const router = useRouter()
  const [abierta, setAbierta] = React.useState(false)
  const [indice, setIndice] = React.useState(0)
  // "Ver en grande": la imagen ocupa toda la tarjeta y el texto se aparta.
  const [ampliado, setAmpliado] = React.useState(false)

  const total = NOVEDADES.paginas.length
  const pagina = NOVEDADES.paginas[indice]

  React.useEffect(() => {
    let vivo = true
    // El `await` saca el setState del cuerpo del efecto y deja pintar primero:
    // la tarjeta no debe retrasar lo que la persona vino a hacer.
    async function decidir() {
      await Promise.resolve()
      if (!vivo) return
      if (!debeMostrarse(leerVistaEnSesion(), NOVEDADES.version)) return
      setAbierta(true)
      // Se marca al mostrarla: navegar entre pantallas no la vuelve a sacar.
      marcarVistaEnSesion(NOVEDADES.version)
    }
    void decidir()
    return () => {
      vivo = false
    }
  }, [])

  const cerrar = React.useCallback(() => setAbierta(false), [])
  const atras = React.useCallback(() => setIndice((i) => Math.max(0, i - 1)), [])
  const siguiente = React.useCallback(() => setIndice((i) => Math.min(total - 1, i + 1)), [total])
  const alternarAmpliado = React.useCallback(() => setAmpliado((a) => !a), [])

  const irA = React.useCallback(
    (ruta: string) => {
      // Cerrar antes de navegar: si la tarjeta se quedara encima, el botón
      // habría llevado a una pantalla que no se ve.
      setAbierta(false)
      router.push(ruta)
    },
    [router],
  )

  React.useEffect(() => {
    if (!abierta) return
    function alTeclear(e: KeyboardEvent) {
      // Las flechas son del comparador cuando el foco está en él.
      const enComparador = (e.target as HTMLElement | null)?.dataset?.comparador === "si"
      if (e.key === "Escape") {
        // Escape primero achica la imagen; solo si ya está pequeña, cierra.
        if (ampliado) setAmpliado(false)
        else cerrar()
      }
      if (enComparador) return
      if (e.key === "ArrowRight") siguiente()
      if (e.key === "ArrowLeft") atras()
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [abierta, ampliado, cerrar, siguiente, atras])


  // El foco va a la tarjeta y no a la X: abrir un anuncio con "descartar"
  // resaltado sugiere justo lo contrario de lo que se quiere.
  const tarjetaRef = React.useRef<HTMLDivElement | null>(null)
  const textoRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (abierta) tarjetaRef.current?.focus()
  }, [abierta])
  React.useEffect(() => {
    if (textoRef.current) {
      textoRef.current.scrollTop = 0
      // En pantallas angostas el que hace scroll es el cuerpo entero.
      if (textoRef.current.parentElement) textoRef.current.parentElement.scrollTop = 0
    }
  }, [indice])

  if (!abierta) return null
  const esUltima = indice === total - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Novedades de la versión ${NOVEDADES.version}. Página ${indice + 1} de ${total}: ${pagina.titulo}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
    >
      <button
        type="button"
        aria-label="Cerrar novedades"
        onClick={cerrar}
        className="absolute inset-0 cursor-default bg-[#16141d]/45 motion-safe:animate-in motion-safe:fade-in-0 supports-backdrop-filter:backdrop-blur-[3px]"
      />

      <div
        ref={tarjetaRef}
        tabIndex={-1}
        className="relative flex max-h-[calc(100svh-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[10px] border border-border bg-card lg:h-[min(760px,calc(100svh-3rem))] text-card-foreground shadow-[var(--elevation-xl)] outline-none duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.98] sm:max-h-[calc(100svh-3rem)]"
      >
        {/* Cabecera: de qué versión se habla. Pequeña a propósito: lo que se
            lee es la página. */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">Novedades</span>
            <span className="mx-1.5">·</span>
            Versión {NOVEDADES.version}, {NOVEDADES.fecha}
          </p>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="-mr-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </header>

        <div
          className={cn(
            // Por debajo de lg todo el cuerpo hace scroll junto. Antes solo el
            // texto lo hacía y, en una ventana baja, la imagen se comía el alto
            // y del texto quedaba un renglón con su barrita de scroll.
            "min-h-0 flex-1 max-lg:overflow-y-auto max-lg:overscroll-contain lg:grid lg:grid-rows-1",
            ampliado ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]",
          )}
        >
          {/* La imagen: el sistema de verdad. */}
          <div
            className={cn(
              "flex min-h-0 flex-col justify-center border-border bg-muted p-3 sm:p-5 lg:p-6",
              ampliado ? "row-span-2 lg:row-span-1" : "border-b lg:border-r lg:border-b-0",
            )}
          >
            <Media key={indice} media={pagina.media} ampliado={ampliado} onAmpliar={alternarAmpliado} />
          </div>

          {/* El texto, corto y al lado. Solo él hace scroll. */}
          <div
            ref={textoRef}
            hidden={ampliado}
            className="min-h-0 px-5 py-5 sm:px-7 sm:py-6 lg:overflow-y-auto lg:overscroll-contain"
          >
            <div key={indice} className="flex flex-col duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1">
              {indice === 0 && (
                <p className="mb-4 text-[15px] leading-relaxed text-pretty text-muted-foreground">
                  {NOVEDADES.resumen}
                </p>
              )}
              <p className="text-[13px] font-medium tabular-nums text-primary">
                {indice + 1} de {total}
              </p>
              <h2 className="mt-1 text-[1.6rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">
                {pagina.titulo}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">
                {pagina.gancho}
              </p>

              <ol className="mt-5 flex flex-col divide-y divide-border border-t border-border">
                {pagina.puntos.map((punto) => {
                  const ruta = punto.ruta
                  return (
                    <li key={punto.texto} className="py-3.5">
                      <p className="text-[12.5px] text-muted-foreground">{punto.donde}</p>
                      <p className="mt-1 text-[15px] leading-snug text-pretty">{punto.texto}</p>
                      {ruta && (
                        <button
                          type="button"
                          onClick={() => irA(ruta)}
                          className="group/ir mt-2 inline-flex items-center gap-1 text-[13.5px] font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {punto.etiquetaRuta ?? "Ir a la pantalla"}
                          <ArrowRight
                            className="size-3.5 transition-transform duration-150 group-hover/ir:translate-x-0.5"
                            aria-hidden
                          />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3 sm:px-6">
          {/* Una raya por página: dice por dónde vas y deja saltar. El botón es
              más alto que la raya para no fallarlo en una tablet. */}
          <div className="flex items-center gap-1">
            {NOVEDADES.paginas.map((p, i) => (
              <button
                key={p.titulo}
                type="button"
                aria-label={`Página ${i + 1}: ${p.titulo}`}
                aria-current={i === indice ? "true" : undefined}
                onClick={() => setIndice(i)}
                className="group/raya grid h-8 place-items-center px-0.5"
              >
                <span
                  className={cn(
                    "h-[3px] w-7 rounded-full transition-colors duration-200 sm:w-9",
                    i === indice
                      ? "bg-primary"
                      : i < indice
                        ? "bg-primary/35"
                        : "bg-border group-hover/raya:bg-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={atras} disabled={indice === 0}>
              <ChevronLeft aria-hidden />
              Atrás
            </Button>
            {esUltima ? (
              <Button onClick={cerrar}>Entendido</Button>
            ) : (
              <Button onClick={siguiente}>
                Siguiente
                <ChevronRight aria-hidden />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

/** Marco de la imagen: el mismo para el video y para el comparador. */
function Marco({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[16/10] max-h-full w-full max-lg:max-w-[max(18rem,calc((100svh-16rem)*1.6))] lg:max-w-[calc((min(760px,100svh-3rem)-200px)*1.6)] overflow-hidden rounded-md border border-border bg-background shadow-[0_1px_2px_rgba(20,16,30,0.05),0_12px_32px_-12px_rgba(20,16,30,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface PropsAmpliar {
  ampliado: boolean
  onAmpliar: () => void
}

function Media({ media, ...p }: { media: MediaNovedad } & PropsAmpliar) {
  return media.tipo === "video" ? <Video media={media} {...p} /> : <Comparar media={media} {...p} />
}

/** Botón para ver la imagen en grande (o volver). */
function BotonAmpliar({ ampliado, onAmpliar }: PropsAmpliar) {
  return (
    <button
      type="button"
      onClick={onAmpliar}
      className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
    >
      {ampliado ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
      {ampliado ? "Volver al texto" : "Ver en grande"}
    </button>
  )
}

/** ¿La persona pidió menos movimiento? Entonces nada arranca solo. */
function usePocoMovimiento(): boolean {
  return React.useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

/**
 * Video grabado sobre el sistema real. Arranca solo, sin sonido y en bucle,
 * como una pantalla que se mira; debajo, una raya que avanza con él y un
 * botón para pausarlo. Con "menos movimiento" no arranca solo.
 */
function Video({ media, ampliado, onAmpliar }: { media: Extract<MediaNovedad, { tipo: "video" }> } & PropsAmpliar) {
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const barraRef = React.useRef<HTMLSpanElement | null>(null)
  const pocoMovimiento = usePocoMovimiento()
  const [pausado, setPausado] = React.useState(pocoMovimiento)

  // La raya se mueve por estilo, cuadro a cuadro: con estado de React se
  // volvería a pintar toda la tarjeta 60 veces por segundo.
  React.useEffect(() => {
    let cuadro = 0
    const pintar = () => {
      const v = ref.current
      if (v && barraRef.current && v.duration > 0) {
        barraRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`
      }
      cuadro = requestAnimationFrame(pintar)
    }
    cuadro = requestAnimationFrame(pintar)
    return () => cancelAnimationFrame(cuadro)
  }, [])

  const alternar = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPausado(false)
    } else {
      v.pause()
      setPausado(true)
    }
  }

  return (
    <figure className="flex flex-col gap-2.5">
      <Marco>
        <video
          ref={ref}
          src={media.src}
          poster={media.poster}
          autoPlay={!pocoMovimiento}
          muted
          loop
          playsInline
          preload="auto"
          aria-label={media.descripcion}
          onClick={alternar}
          className="absolute inset-0 size-full cursor-pointer object-cover object-top"
        />
      </Marco>
      <figcaption className="flex items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          aria-label={pausado ? "Reproducir el video" : "Pausar el video"}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {pausado ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
        </button>
        <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-border">
          <span
            ref={barraRef}
            className="absolute inset-0 origin-left bg-primary/70"
            style={{ transform: "scaleX(0)" }}
          />
        </span>
        <span className="shrink-0 text-[12px] text-muted-foreground">Grabado en BookiPos</span>
        <BotonAmpliar ampliado={ampliado} onAmpliar={onAmpliar} />
      </figcaption>
    </figure>
  )
}

/**
 * Antes y ahora de la misma pantalla. La línea se arrastra (o se mueve con las
 * flechas cuando tiene el foco). Al abrir, la línea hace un barrido corto para
 * que se entienda sin explicarlo que la imagen se puede comparar.
 */
function Comparar({ media, ampliado, onAmpliar }: { media: Extract<MediaNovedad, { tipo: "comparar" }> } & PropsAmpliar) {
  const [vista, setVista] = React.useState(0)
  const [pos, setPos] = React.useState(50)
  const [tocado, setTocado] = React.useState(false)
  const marcoRef = React.useRef<HTMLDivElement | null>(null)
  const pocoMovimiento = usePocoMovimiento()
  const v = media.vistas[vista]

  // El barrido de entrada: de 82 % a 50 % y listo. Se corta en cuanto la
  // persona toca la línea.
  React.useEffect(() => {
    if (pocoMovimiento || tocado) return
    let cuadro = 0
    const inicio = performance.now()
    const salida = (t: number) => 1 - Math.pow(1 - t, 3)
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / 1400)
      setPos(82 - 32 * salida(t))
      if (t < 1) cuadro = requestAnimationFrame(paso)
    }
    const espera = window.setTimeout(() => (cuadro = requestAnimationFrame(paso)), 350)
    return () => {
      window.clearTimeout(espera)
      cancelAnimationFrame(cuadro)
    }
  }, [vista, pocoMovimiento, tocado])

  const moverA = (clientX: number) => {
    const caja = marcoRef.current?.getBoundingClientRect()
    if (!caja) return
    setPos(Math.min(100, Math.max(0, ((clientX - caja.left) / caja.width) * 100)))
  }

  return (
    <figure className="flex flex-col gap-2.5">
      <div
        ref={marcoRef}
        className="touch-none select-none"
        onPointerDown={(e) => {
          setTocado(true)
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          moverA(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) moverA(e.clientX)
        }}
      >
        <Marco className="cursor-ew-resize">
          {/* eslint-disable-next-line @next/next/no-img-element -- captura fija de public/, sin optimizador */}
          <img src={v.ahora} alt="" draggable={false} className="absolute inset-0 size-full object-cover object-top" />
          {/* eslint-disable-next-line @next/next/no-img-element -- captura fija de public/, sin optimizador */}
          <img
            src={v.antes}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full object-cover object-top"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-[4px] bg-[#16141d]/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            Antes
          </span>
          <span className="pointer-events-none absolute top-2.5 right-2.5 rounded-[4px] bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
            Ahora
          </span>
          {/* La línea y su agarradera. */}
          <span className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgba(20,16,30,0.18)]" style={{ left: `${pos}%` }}>
            <span className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-white text-[#16141d] shadow-[var(--elevation-md)]">
              <ChevronLeft className="-mr-1 size-3.5" aria-hidden />
              <ChevronRight className="absolute ml-3 size-3.5" aria-hidden />
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(pos)}
            data-comparador="si"
            aria-label={`Comparar ${v.nombre}: antes a la izquierda, ahora a la derecha`}
            onChange={(e) => {
              setTocado(true)
              setPos(Number(e.target.value))
            }}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </Marco>
      </div>
      <figcaption className="flex flex-wrap items-center gap-1">
        <span className="sr-only">{media.descripcion}</span>
        {media.vistas.map((x, i) => (
          <button
            key={x.nombre}
            type="button"
            aria-pressed={i === vista}
            onClick={() => {
              setVista(i)
              setTocado(false)
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-[13px] transition-colors",
              i === vista
                ? "bg-[color-mix(in_oklch,var(--primary)_11%,transparent)] font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {x.nombre}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">Arrastra la línea</span>
        <BotonAmpliar ampliado={ampliado} onAmpliar={onAmpliar} />
      </figcaption>
    </figure>
  )
}
