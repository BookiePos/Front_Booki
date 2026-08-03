import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GoCheckMark } from "@/components/marketing/gocheck-logo";
import { Reveal } from "@/components/marketing/reveal";

export function FinalCta() {
  return (
    <section id="contacto" data-nav-dark className="relative overflow-hidden bg-brand-950 py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-brand-500) 0%, transparent 68%)",
        }}
      />

      <Reveal className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <GoCheckMark className="mx-auto h-14 w-14" />

        <h2 className="mt-8 text-balance font-display font-semibold text-white text-section">
          Empieza esta semana
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-brand-200">
          Catorce días completos, sin tarjeta. Te ayudamos a cargar tus
          productos y a dejar la primera sede vendiendo el mismo día.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-brand-900 transition-transform duration-150 hover:bg-brand-50 active:scale-[0.98]"
          >
            Crear mi cuenta
            <ArrowRight
              className="size-5 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <a
            href="mailto:hola@gocheck.co"
            className="inline-flex h-14 items-center justify-center rounded-full border border-brand-700 px-8 text-base font-semibold text-brand-100 transition-colors duration-150 hover:border-brand-500 hover:bg-brand-900"
          >
            Hablar con ventas
          </a>
        </div>
      </Reveal>
    </section>
  );
}
