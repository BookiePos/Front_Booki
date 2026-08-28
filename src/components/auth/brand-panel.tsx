"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookiPosMark } from "@/components/marketing/bookipos-logo";
import { useScrollProgress } from "@/hooks/use-scroll-progress";

/**
 * Grano finísimo (fractal noise) incrustado como data URI.
 *
 * Va aquí y no en `globals.css` porque es un detalle de este panel, y va en
 * SVG y no en PNG porque pesa ~250 bytes y no añade una petición. Se pinta
 * una sola vez y NUNCA se anima: mover `background-position` en scroll
 * repintaría la capa entera en cada frame.
 */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Panel de marca de las pantallas de acceso (registro).
 *
 * El formulario es largo y el panel es la mitad fija de la pantalla. Antes el
 * panel medía tanto como el formulario, así que la marca se quedaba arriba y
 * desaparecía en cuanto bajabas: dos tercios de violeta vacío.
 *
 * Ahora el panel es `sticky` a la altura del viewport, de modo que la marca
 * **acompaña** al scroll en vez de irse, y encima de eso hay una deriva:
 *
 *   · el contenido (isotipo, titular, bajada) baja unas decenas de píxeles,
 *     cada pieza un poco más que la anterior;
 *   · las dos auroras del fondo suben, que es el gesto contrario — de ahí la
 *     sensación de profundidad sin mover ni un solo píxel de layout;
 *   · un velo `brand-950` gana opacidad, así que el morado se hunde conforme
 *     bajas en lugar de quedarse plano;
 *   · la regla bajo el isotipo se extiende con `scaleX`.
 *
 * Todo son `transform` y `opacity` (compuestos en GPU): ni `top`, ni alto,
 * ni `background-position`. Y el recorrido total es de ~40px: la idea es que
 * se note como peso, no como una animación.
 *
 * El progreso viene suavizado de `useScrollProgress`, que con
 * `prefers-reduced-motion` devuelve 1 fijo y no engancha ni scroll ni rAF.
 * Por eso el estado en 1 está calibrado para ser un reposo válido —morado
 * más profundo, marca asentada— y no un fotograma a medias.
 *
 * El componente vive aparte de la página a propósito: el hook re-renderiza a
 * cada frame de scroll y aquí eso cuesta doce nodos, no el formulario entero.
 */
export function AuthBrandPanel({
  titulo,
  bajada,
}: {
  titulo: string;
  bajada: string;
}) {
  // "pin": el panel abre la página. Con "through" arrancaría ya a medio
  // recorrido, porque el elemento cuenta como medio cruzado desde que es
  // visible. Aquí el progreso mide cuánto has bajado dentro de la columna.
  const { ref, progress: p } = useScrollProgress<HTMLDivElement>({
    smoothing: 0.1,
    mode: "pin",
  });

  /** Deriva vertical en px, redondeada para no reescribir estilos por nada. */
  const deriva = (px: number) => `translate3d(0, ${(p * px).toFixed(2)}px, 0)`;

  return (
    // El ref va en la columna (alta como el formulario) y no en el <aside>:
    // medir un elemento sticky daría siempre rect.top = 0 y progreso 1.
    <div ref={ref} className="relative hidden lg:block">
      <aside className="sticky top-0 flex h-svh flex-col justify-between overflow-hidden bg-brand-950 p-10 xl:p-12">
        {/* Lienzo: orquídea profunda arriba, tinta de marca al centro, marino
            del logo abajo. Estático — el degradado no se anima. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(158deg, var(--color-brand-900) 0%, var(--color-brand-950) 48%, var(--color-navy-950) 100%)",
          }}
        />

        {/* Aurora alta: sube y se apaga. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-24 h-[38rem] w-[38rem] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              "radial-gradient(circle, var(--color-brand-500) 0%, transparent 68%)",
            opacity: 0.44 - p * 0.18,
            transform: deriva(-72),
          }}
        />

        {/* Aurora baja: asoma desde abajo y gana peso al final del recorrido. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-44 -right-32 h-[34rem] w-[34rem] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              "radial-gradient(circle, var(--color-brand-700) 0%, transparent 70%)",
            opacity: 0.26 + p * 0.24,
            transform: deriva(-48),
          }}
        />

        {/* Velo: "un poco más morado oscuro" según bajas. Sube el contraste
            del texto blanco, nunca lo baja. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-brand-950"
          style={{ opacity: p * 0.42 }}
        />

        {/* Viñeta fija: cierra las esquinas para que el degradado no se lea
            como una plancha de color. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 82% at 28% 18%, transparent 42%, rgba(0, 8, 28, 0.55) 100%)",
          }}
        />

        {/* Grano: mata el banding del degradado y da textura de impresión. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay"
          style={{ backgroundImage: GRANO, backgroundSize: "160px 160px" }}
        />

        {/* Filo de luz que separa el panel del formulario. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"
        />

        <Link
          href="/"
          className="relative inline-flex w-fit items-center gap-2 text-sm font-medium text-brand-200 transition-colors hover:text-white"
          style={{ transform: deriva(-14) }}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a bookipos.com
        </Link>

        <div className="relative will-change-transform" style={{ transform: deriva(26) }}>
          <BookiPosMark className="h-16 w-16" tone="light" />

          {/* Regla de marca: se extiende con el recorrido. scaleX no toca
              layout, así que no provoca reflow. */}
          <div
            aria-hidden="true"
            className="mt-7 h-px w-24 origin-left bg-gradient-to-r from-brand-400/70 to-transparent"
            style={{ transform: `scaleX(${(0.35 + p * 0.65).toFixed(3)})` }}
          />

          <p
            className="mt-7 max-w-md text-balance font-display text-4xl font-semibold leading-tight text-white"
            style={{ transform: deriva(6) }}
          >
            {titulo}
          </p>
          <p
            className="mt-5 max-w-sm leading-relaxed text-brand-200"
            style={{ transform: deriva(14) }}
          >
            {bajada}
          </p>
        </div>

        <p
          className="relative text-sm text-brand-300"
          style={{ transform: deriva(20) }}
        >
          Punto de venta y sistema operacional · Colombia
        </p>
      </aside>
    </div>
  );
}
