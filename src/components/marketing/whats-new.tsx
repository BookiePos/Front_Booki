import { Reveal } from "@/components/marketing/reveal";
import { WHATS_NEW } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Novedades en rejilla compacta en vez de línea de tiempo vertical: cuatro
 * titulares caben de un vistazo y nadie tiene que hacer scroll para ver si
 * el producto sigue vivo, que es lo único que esta sección debe demostrar.
 *
 * Contrastes medidos (WCAG 2.1):
 *   · etiqueta "Nuevo": blanco sobre el degradado brand-600→brand-900 va de
 *     5.92:1 (extremo claro) a 13.38:1 ✓ AA para 12px negrita.
 *   · etiqueta "Mejora": brand-800 sobre brand-100 ... 8.82:1 ✓ AAA
 *   · fecha: era `ink-faint` sobre blanco = 3.49:1 ✗ (14px normal necesita
 *     4.5:1). Pasa a `ink-muted` = 7.65:1 ✓ AAA.
 *   · borde de la tarjeta: `brand-100` sobre `surface-soft` daba 1.14:1 y la
 *     tarjeta blanca se fundía con la sección. Sube a `brand-200` (1.40:1).
 *
 * El hover no anima `box-shadow` ni `border-color` —repintan la capa entera—
 * sino la opacidad de una capa superpuesta con el halo y el anillo ya
 * pintados, más un `translate` de 2px. Solo transform y opacity.
 */
export function WhatsNew() {
  return (
    <section id="novedades" className="relative bg-surface-soft py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
              Novedades
            </p>
            <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
              Se actualiza sin que instales nada
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-ink-muted">
            Lo último que entró en producción. Sin migraciones, sin parar el
            servicio, sin pagar aparte.
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2">
          {WHATS_NEW.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i * 60} className="h-full">
              <article className="group relative h-full rounded-card bg-gradient-to-b from-white to-brand-50/60 p-5 shadow-[0_1px_2px_rgba(74,7,115,0.05),0_10px_28px_-24px_rgba(74,7,115,0.45)] ring-1 ring-inset ring-brand-200 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6">
                {/* Halo y anillo del hover, precocinados y revelados con
                    opacity: así el navegador compone en vez de repintar. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-card opacity-0 shadow-[0_18px_44px_-26px_rgba(74,7,115,0.6)] ring-1 ring-inset ring-brand-300 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="relative flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      item.tag === "Nuevo"
                        ? "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white shadow-[0_6px_16px_-8px_rgba(74,7,115,0.85)] ring-1 ring-inset ring-white/25"
                        : "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300",
                    )}
                  >
                    {item.tag}
                  </span>
                  <time className="text-sm font-medium text-ink-muted">
                    {item.date}
                  </time>
                </div>
                <h3 className="relative mt-4 text-pretty text-lg font-semibold leading-snug text-ink">
                  {item.title}
                </h3>
                <p className="relative mt-2 text-pretty leading-relaxed text-ink-muted">
                  {item.body}
                </p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
