import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BookiPosMark } from "@/components/marketing/bookipos-logo";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Grano finísimo (fractal noise) en data URI, misma técnica que el panel de
 * marca de `/registro`. Pesa ~250 bytes, no añade una petición y es lo que
 * mata el banding del degradado morado a pantalla completa: sin él, en un
 * monitor de 8 bits el paso brand-900 → navy-950 se ve a franjas.
 */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Cierre de la portada — el recuadro morado más grande de la página.
 *
 * Antes era un `bg-brand-950` plano con una sola mancha encima: a pantalla
 * completa eso se lee como una plancha de color, y el degradado sin grano
 * bandea. Ahora el lienzo se construye por capas, igual que el panel de
 * acceso: degradado orquídea→marino, dos auroras a distinta altura, viñeta
 * que cierra las esquinas y grano al 5% en `mix-blend-overlay`.
 *
 * Ninguna capa se anima: son estáticas y `isolate` las mantiene mezclándose
 * entre ellas y no con el pie de página.
 *
 * Contrastes medidos (WCAG 2.1) sobre el punto MÁS CLARO del lienzo —el
 * centro de la aurora, brand-500 al 38% sobre brand-950 ≈ #682e95—, que es el
 * peor caso:
 *   · titular blanco ....................... 9.13:1 ✓ AAA
 *   · bajada brand-200 (18px) .............. 6.23:1 ✓ AA
 *   · botón fantasma brand-100 ............. 7.67:1 ✓ AAA
 * Sobre el fondo base brand-950 suben a 15.71:1, 10.71:1 y 13.19:1.
 *
 * El borde del botón fantasma era `brand-700`: 1.93:1 contra brand-950, o sea
 * invisible — el botón no se leía como botón. Pasa a `brand-400`: 5.53:1 sobre
 * el fondo base y 3.31:1 en el peor punto (centro de la aurora), por encima
 * del 3:1 que WCAG 1.4.11 pide a los límites de un control. brand-500 habría
 * bastado sobre el fondo base (4.24:1) pero caía a 2.54:1 bajo la aurora.
 */
export function FinalCta() {
  return (
    <section
      id="contacto"
      data-nav-dark
      className="relative isolate overflow-hidden bg-brand-950 py-20 sm:py-28 lg:py-32"
    >
      {/* Lienzo: orquídea profunda arriba, tinta de marca al centro, marino
          del logo abajo — el mismo recorrido que el panel de acceso. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(168deg, var(--color-brand-900) 0%, var(--color-brand-950) 46%, var(--color-navy-950) 100%)",
        }}
      />

      {/* Aurora alta, detrás del isotipo. Se mide en `vw` además de en `rem`
          para que en un móvil de 320px no sea un lavado uniforme de morado. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[min(36rem,90vw)] w-[min(52rem,150vw)] -translate-x-1/2 opacity-[0.38] blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-brand-500) 0%, transparent 68%)",
        }}
      />

      {/* Aurora baja: contrapeso que evita que la mitad inferior se apague. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 right-[-10%] h-[min(30rem,80vw)] w-[min(38rem,120vw)] opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-brand-700) 0%, transparent 70%)",
        }}
      />

      {/* Viñeta: cierra las esquinas para que el degradado tenga volumen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 78% at 50% 12%, transparent 40%, rgba(0, 8, 28, 0.6) 100%)",
        }}
      />

      {/* Grano: elimina el banding y aporta textura de impresión. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRANO, backgroundSize: "160px 160px" }}
      />

      {/* Filo de luz superior: separa la sección de la anterior sin una línea
          dura. Es lo que hace que el bloque se lea como una superficie y no
          como un cambio de color a bocajarro. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/45 to-transparent"
      />

      <Reveal className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <BookiPosMark className="mx-auto h-12 w-12 sm:h-14 sm:w-14" tone="light" />

        <h2 className="mt-7 text-balance font-display font-semibold text-white text-section sm:mt-8">
          Empieza esta semana
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-brand-200 sm:text-lg">
          Catorce días completos, sin tarjeta. Te ayudamos a cargar tus
          productos y a dejar la primera sede vendiendo el mismo día.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-brand-900 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.75)] transition-transform duration-150 hover:bg-brand-50 active:scale-[0.98] sm:h-14 sm:w-auto sm:px-8"
          >
            Crear mi cuenta
            <ArrowRight
              className="size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <a
            href="mailto:hola@bookipos.com"
            className="inline-flex h-13 w-full items-center justify-center rounded-full border border-brand-400 bg-brand-900/40 px-6 text-base font-semibold text-brand-100 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-900 hover:text-white sm:h-14 sm:w-auto sm:px-8"
          >
            Hablar con ventas
          </a>
        </div>
      </Reveal>
    </section>
  );
}
