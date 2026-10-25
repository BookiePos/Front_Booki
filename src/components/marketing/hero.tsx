import Link from "next/link";
import { Tirilla } from "@/components/marketing/tirilla";
import { CTA_REGISTRO } from "@/lib/site";

/**
 * Primera pantalla: el lema en letra de caja registradora a la izquierda y la
 * tirilla del cobro a la derecha, cortada por el borde de arriba.
 *
 * Sin antetítulo, sin bajada, sin palabra resaltada en otro color: el lema es
 * una sola pieza y lo que hace el sistema lo cuenta la tirilla. Es de
 * servidor: la entrada es CSS (`.hero-rise`, `.tirilla-sale`, `.sello`).
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-mesa"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-28 pb-16 sm:px-8 lg:min-h-[100svh] lg:grid-cols-[1fr_27rem] lg:gap-16 lg:pt-0 lg:pb-0">
        <div className="flex flex-col justify-center lg:py-32">
          <h1
            id="hero-heading"
            className="hero-rise font-mono text-[clamp(2.6rem,6.6vw,6rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-navy-950 uppercase"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            Tú vendes.
            <br />
            Lo demás
            <br />
            se cuadra
            <br />
            solo.
          </h1>

          <div
            className="hero-rise mt-12 flex flex-col font-mono text-[0.9375rem] font-bold uppercase sm:flex-row"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <Link
              href={CTA_REGISTRO.href}
              className="inline-flex h-15 items-center justify-center bg-navy-950 px-7 text-white transition-colors duration-150 hover:bg-brand-700"
            >
              {CTA_REGISTRO.label}
            </Link>
            <a
              href="#precios"
              className="inline-flex h-15 items-center justify-center border-2 border-navy-950 px-7 text-navy-950 transition-colors duration-150 hover:bg-white max-sm:border-t-0 sm:border-l-0"
            >
              Ver precios
            </a>
          </div>
        </div>

        <Tirilla className="mx-auto w-full max-w-[27rem] lg:mx-0" />
      </div>
    </section>
  );
}
