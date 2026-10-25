import Link from "next/link";
import { BookiPosMark } from "@/components/marketing/bookipos-logo";
import { CTA_REGISTRO } from "@/lib/site";
import { SOPORTE } from "@/lib/soporte";

/**
 * Cierre de la portada: el isotipo grande y una orden corta, en la misma
 * letra de caja del hero. Sin bajada: los 14 días ya van en el botón.
 */
export function FinalCta() {
  return (
    <section
      id="contacto"
      aria-labelledby="cierre-heading"
      className="border-t-2 border-navy-950 bg-mesa py-24 sm:py-32"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-end gap-6 sm:gap-8">
          <BookiPosMark className="size-20 shrink-0 sm:size-28" />
          <h2
            id="cierre-heading"
            className="font-mono text-[clamp(3rem,8vw,7rem)] leading-[0.92] font-extrabold tracking-[-0.06em] text-navy-950 uppercase"
          >
            Abre caja
            <br />
            hoy.
          </h2>
        </div>

        <div className="flex flex-col font-mono text-[0.9375rem] font-bold uppercase sm:flex-row">
          <Link
            href={CTA_REGISTRO.href}
            className="inline-flex h-15 items-center justify-center bg-navy-950 px-7 text-white transition-colors duration-150 hover:bg-brand-700"
          >
            {CTA_REGISTRO.label}
          </Link>
          <a
            href={`mailto:${SOPORTE.ventas}`}
            className="inline-flex h-15 items-center justify-center border-2 border-navy-950 px-7 text-navy-950 transition-colors duration-150 hover:bg-white max-sm:border-t-0 sm:border-l-0"
          >
            Hablar con ventas
          </a>
        </div>
      </div>
    </section>
  );
}
