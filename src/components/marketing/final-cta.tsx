import Link from "next/link";
import { BookiPosMark } from "@/components/marketing/bookipos-logo";
import { CTA_REGISTRO } from "@/lib/site";
import { SOPORTE } from "@/lib/soporte";

/**
 * Cierre de la portada: el isotipo grande y una orden corta, en la letra de
 * los titulares. Sin bajada: los 14 días ya van en el botón.
 */
export function FinalCta() {
  return (
    <section
      id="contacto"
      aria-labelledby="cierre-heading"
      className="border-t border-navy-950/15 bg-mesa py-24 sm:py-32"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-end gap-6 sm:gap-8">
          <BookiPosMark className="size-20 shrink-0 sm:size-28" />
          <h2
            id="cierre-heading"
            className="font-titular text-[clamp(3rem,8vw,7rem)] leading-[0.92] font-semibold tracking-[-0.055em] text-navy-950"
          >
            Abre caja
            <br />
            hoy.
          </h2>
        </div>

        <div className="flex flex-wrap gap-3 text-[0.9375rem] font-semibold">
          <Link
            href={CTA_REGISTRO.href}
            className="inline-flex h-13 items-center justify-center rounded-md bg-navy-950 px-7 text-white transition-colors duration-150 hover:bg-brand-700"
          >
            {CTA_REGISTRO.label}
          </Link>
          <a
            href={`mailto:${SOPORTE.ventas}`}
            className="inline-flex h-13 items-center justify-center rounded-md px-6 text-navy-950 ring-1 ring-navy-950/25 transition-colors duration-150 ring-inset hover:bg-white/70"
          >
            Hablar con ventas
          </a>
        </div>
      </div>
    </section>
  );
}
