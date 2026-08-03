import { Plus } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { FAQS } from "@/lib/site";

/**
 * Acordeón nativo con <details>/<summary>: accesible por teclado y operable
 * sin JavaScript. No hay razón para reimplementarlo con estado en React.
 */
export function Faq() {
  return (
    <section id="preguntas" className="relative bg-surface-soft py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[22rem_1fr] lg:gap-20">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
            Preguntas
          </p>
          <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
            Lo que todos preguntan
          </h2>
          <p className="mt-5 leading-relaxed text-ink-muted">
            ¿Falta la tuya? Escríbenos y te respondemos sin rodeos, incluso si
            la respuesta es que GoCheck no te sirve.
          </p>
        </Reveal>

        <Reveal>
          <div className="divide-y divide-brand-100 border-y border-brand-100">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-lg font-semibold text-ink transition-colors hover:text-brand-700 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <Plus
                    className="size-5 shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="max-w-2xl pb-6 leading-relaxed text-ink-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
