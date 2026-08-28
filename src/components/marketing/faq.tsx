import { Plus } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { FAQS } from "@/lib/site";

/**
 * Acordeón nativo con <details>/<summary>: accesible por teclado y operable
 * sin JavaScript. No hay razón para reimplementarlo con estado en React.
 *
 * Contrastes medidos (WCAG 2.1) sobre `surface-soft` #faf9ff:
 *   · eyebrow brand-700 ......... 7.79:1  ✓ AA
 *   · pregunta ink .............. 15.6:1  ✓ AAA
 *   · respuesta ink-muted ........ 7.30:1  ✓ AA
 *   · divisores: brand-100 daba 1.14:1 — invisible sobre este papel; suben a
 *     brand-200 (1.40:1), que sí dibuja la línea sin ensuciar la sección.
 *   · chip del icono cerrado: brand-700 sobre brand-50 ..... 7.9:1 ✓ (≥3:1)
 *   · chip del icono abierto: blanco sobre brand-600→800 ... 5.92–10.50:1 ✓
 */
export function Faq() {
  return (
    <section id="preguntas" className="relative bg-surface-soft py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:gap-12 sm:px-8 lg:grid-cols-[19rem_1fr] lg:gap-14 xl:grid-cols-[22rem_1fr] xl:gap-20">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
            Preguntas
          </p>
          <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
            Lo que todos preguntan
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-ink-muted">
            ¿Falta la tuya? Escríbenos y te respondemos sin rodeos, incluso si
            la respuesta es que BookiPos no te sirve.
          </p>
        </Reveal>

        <Reveal>
          <div className="divide-y divide-brand-200 border-y border-brand-200">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group">
                {/* Toda la fila es el objetivo táctil (≈68px de alto), no solo
                    el icono: el chip de 36px es afordancia visual, no diana. */}
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden sm:gap-6 sm:py-6">
                  <span className="text-pretty text-[1.0625rem] font-semibold leading-snug text-ink transition-colors group-hover:text-brand-800 sm:text-lg">
                    {faq.q}
                  </span>
                  {/* Recuadro morado del icono: relleno claro con anillo de
                      1px cuando está cerrado, degradado de marca cuando está
                      abierto. El + gira con `transform` (compuesto en GPU) y
                      `prefers-reduced-motion` lo deja quieto desde globals. */}
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 shadow-[0_1px_2px_rgba(74,7,115,0.06)] ring-1 ring-inset ring-brand-200 transition-colors duration-200 group-hover:bg-brand-100 group-open:bg-gradient-to-br group-open:from-brand-600 group-open:to-brand-800 group-open:text-white group-open:shadow-[0_6px_16px_-8px_rgba(74,7,115,0.7)] group-open:ring-white/25"
                  >
                    <Plus className="size-4 transition-transform duration-200 group-open:rotate-45" />
                  </span>
                </summary>
                <p className="max-w-2xl text-pretty pb-6 text-[0.95rem] leading-relaxed text-ink-muted sm:text-base">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
