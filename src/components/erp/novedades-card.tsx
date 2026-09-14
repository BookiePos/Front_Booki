"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Boxes,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react"

import {
  NOVEDADES,
  debeMostrarse,
  leerVistaEnSesion,
  marcarVistaEnSesion,
  type IconoNovedad,
} from "@/lib/novedades"
import { IlustracionPagina } from "@/components/erp/novedades-ilustraciones"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** La palabra que trae cada página se traduce aquí a un icono de verdad. */
const ICONOS: Record<IconoNovedad, React.ElementType> = {
  cobro: ShoppingCart,
  inventario: Boxes,
  cifras: Calculator,
}

/**
 * Tarjeta de novedades: qué trae la última versión, al abrir el sistema.
 *
 * Nadie lee un historial de versiones en GitHub — quien usa esto está detrás de
 * un mostrador. Una función nueva que no se anuncia dentro de la aplicación,
 * sencillamente no existe.
 *
 * Era una lista de cinco puntos apretados en una sola pantalla, y el dueño la
 * resumió mejor de lo que lo haría cualquier informe: todo se veía muy pequeño
 * y no se entendía. Lo que cambió, y por qué:
 *
 * - **Una página por idea, no una lista.** El contenido es el mismo, pero
 *   repartido: se pasa con "Siguiente" o con las flechas del teclado. Tres
 *   pantallas que se leen valen más que una que se cierra de golpe.
 *
 * - **Letra de leer, no de rellenar.** El título de la página en grande y cada
 *   punto en tamaño corriente, con aire entre uno y otro. Solo van pequeños los
 *   datos que no son contenido: la versión, la fecha, el contador de páginas.
 *
 * - **Un dibujo por página.** Un esquema explica un cambio de pantalla mucho
 *   antes que un párrafo describiéndola. Están en `novedades-ilustraciones`.
 *
 * - **Un botón por punto.** Enterarse de algo y no saber dónde está es quedarse
 *   igual. El botón cierra la tarjeta y lleva a la pantalla; las rutas son
 *   absolutas porque esto sale tanto en `/panel` como en `/pos`.
 *
 * Cuándo sale está en `debeMostrarse`: cada vez que se inicia sesión (o se abre
 * el navegador de nuevo), una sola vez por sesión.
 *
 * NO bloquea nada: se puede cerrar con Escape, con el botón, o tocando fuera. Si
 * alguien llega corriendo a cobrar, la tarjeta se quita de en medio sin pelear.
 */
export function NovedadesCard() {
  const router = useRouter()
  const [abierta, setAbierta] = React.useState(false)
  const [indice, setIndice] = React.useState(0)

  const total = NOVEDADES.paginas.length
  const pagina = NOVEDADES.paginas[indice]

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
  const atras = React.useCallback(() => setIndice((i) => Math.max(0, i - 1)), [])
  const siguiente = React.useCallback(
    () => setIndice((i) => Math.min(total - 1, i + 1)),
    [total],
  )

  const irA = React.useCallback(
    (ruta: string) => {
      // Cerrar antes de navegar, no después: si la tarjeta se quedara encima,
      // el botón habría llevado a una pantalla que no se ve.
      setAbierta(false)
      router.push(ruta)
    },
    [router],
  )

  // Escape la quita, como cualquier capa del sistema. Las flechas pasan de
  // página: quien ya está leyendo con el teclado no debería tener que ir a
  // buscar el ratón para seguir.
  React.useEffect(() => {
    if (!abierta) return
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar()
      if (e.key === "ArrowRight") siguiente()
      if (e.key === "ArrowLeft") atras()
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [abierta, cerrar, siguiente, atras])

  // Al abrir, el foco va a la tarjeta y no al primer elemento pulsable —que es
  // la "X"—: abrir un anuncio con el botón de descartar resaltado sugiere justo
  // lo contrario de lo que se quiere. Enfocar el contenedor conserva Escape, el
  // Tab dentro de la tarjeta y el anuncio del título en el lector de pantalla.
  const tarjetaRef = React.useRef<HTMLDivElement | null>(null)
  const cuerpoRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!abierta) return
    tarjetaRef.current?.focus()
  }, [abierta])

  // Cambiar de página deja el cuerpo arriba. Sin esto, quien bajó a leer el
  // tercer punto empieza la página siguiente por la mitad.
  React.useEffect(() => {
    if (!cuerpoRef.current) return
    cuerpoRef.current.scrollTop = 0
  }, [indice])

  if (!abierta) return null

  const Icono = ICONOS[pagina.icono]
  const esUltima = indice === total - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      // La etiqueta cambia con la página: quien navega a oídas necesita saber
      // que pasó de página, no solo que hay un diálogo abierto.
      aria-label={`Novedades de la versión ${NOVEDADES.version}. Página ${indice + 1} de ${total}: ${pagina.titulo}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
    >
      {/* El fondo difuminado: deja ver que la pantalla sigue ahí detrás, así la
          tarjeta se siente como un aviso y no como una puerta cerrada. */}
      <button
        type="button"
        aria-label="Cerrar novedades"
        onClick={cerrar}
        className="absolute inset-0 cursor-default bg-brand-950/55 supports-backdrop-filter:backdrop-blur-md supports-backdrop-filter:backdrop-saturate-150"
      />

      {/* Cabecera y pie fijos, scroll solo en el cuerpo: es la diferencia entre
          saber siempre qué estás leyendo y perderte a mitad de página. El alto
          va en `svh` porque en el celular la barra del navegador se recoge y con
          `vh` el pie se sale de la pantalla. */}
      <div
        ref={tarjetaRef}
        tabIndex={-1}
        className="relative flex max-h-[calc(100svh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-700 to-brand-950 shadow-2xl outline-none sm:max-h-[calc(100svh-2rem)]"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-5 py-4 sm:gap-4 sm:px-8 sm:py-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 sm:size-12">
            <Icono className="size-5 text-white sm:size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-200">
              {NOVEDADES.titulo}
            </p>
            <h2 className="mt-0.5 font-display text-2xl leading-tight text-balance text-white sm:text-3xl">
              {pagina.titulo}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="-mr-2 -mt-1 shrink-0 rounded-xl p-2 text-brand-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div
          ref={cuerpoRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6"
        >
          {/* El `key` reinicia la entrada en cada cambio de página: sin él React
              reutiliza el nodo y el cambio pasa desapercibido. `motion-safe`
              deja quieta la transición a quien pidió menos movimiento. */}
          <div
            key={indice}
            className="flex flex-col gap-5 duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:gap-6"
          >
            {indice === 0 && (
              <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                <Sparkles className="mt-1 size-5 shrink-0 text-brand-200" aria-hidden />
                <div className="min-w-0">
                  <p className="text-base leading-relaxed text-pretty text-white sm:text-lg">
                    {NOVEDADES.resumen}
                  </p>
                  <p className="mt-1 text-xs text-brand-200">
                    Versión {NOVEDADES.version} · {NOVEDADES.fecha}
                  </p>
                </div>
              </div>
            )}

            <p className="text-lg leading-relaxed text-pretty text-brand-100 sm:text-xl">
              {pagina.gancho}
            </p>

            {/* En pantalla ancha el dibujo se pone al lado del texto; en un
                celular se apila encima, que es donde se mira primero. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <IlustracionPagina
                  tipo={pagina.ilustracion}
                  className="mx-auto h-auto w-full max-w-sm"
                />
              </div>

              <ul className="flex flex-col gap-4">
                {pagina.puntos.map((punto) => {
                  // En una constante y no con `punto.ruta!`: el botón solo
                  // existe si hay ruta, y así lo sabe también TypeScript.
                  const ruta = punto.ruta
                  return (
                    // Por el texto y no por `donde`: dos puntos pueden estar en
                    // la misma pantalla.
                    <li key={punto.texto} className="rounded-2xl bg-white/10 p-4 sm:p-5">
                      <p className="text-sm font-semibold text-brand-200">
                        {punto.donde}
                      </p>
                      <p className="mt-1.5 text-base leading-relaxed text-pretty text-white sm:text-lg">
                        {punto.texto}
                      </p>
                      {ruta && (
                        <Button
                          variant="soft"
                          size="lg"
                          onClick={() => irA(ruta)}
                          className="mt-3.5 bg-white/15 text-white hover:bg-white/25"
                        >
                          {punto.etiquetaRuta ?? "Ir a la pantalla"}
                          <ArrowRight aria-hidden />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-white/10 bg-brand-950/40 px-5 py-3.5 sm:px-8 sm:py-4">
          {/* Los puntos dicen por dónde va y además dejan saltar de página. El
              botón es más alto que el punto que pinta: un círculo de 10 px se
              falla al tocarlo en una tablet. */}
          <div className="flex items-center gap-1">
            {NOVEDADES.paginas.map((p, i) => (
              <button
                key={p.titulo}
                type="button"
                aria-label={`Página ${i + 1}: ${p.titulo}`}
                aria-current={i === indice ? "true" : undefined}
                onClick={() => setIndice(i)}
                className="group/punto grid h-9 place-items-center px-1.5"
              >
                <span
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-200",
                    i === indice
                      ? "w-8 bg-white"
                      : "w-2.5 bg-white/35 group-hover/punto:bg-white/65",
                  )}
                />
              </button>
            ))}
            <span className="ml-2 text-xs text-brand-200">
              {indice + 1} de {total}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            {esUltima && (
              <span className="mr-auto hidden text-xs text-brand-200 sm:block">
                Vuelve a salir cada vez que inicias sesión.
              </span>
            )}
            <Button
              variant="ghost"
              size="lg"
              onClick={atras}
              disabled={indice === 0}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft aria-hidden />
              Atrás
            </Button>
            {esUltima ? (
              <Button
                variant="soft"
                size="lg"
                onClick={cerrar}
                className="bg-white text-brand-900 hover:bg-brand-50"
              >
                Entendido
              </Button>
            ) : (
              <Button
                variant="soft"
                size="lg"
                onClick={siguiente}
                className="bg-white text-brand-900 hover:bg-brand-50"
              >
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
