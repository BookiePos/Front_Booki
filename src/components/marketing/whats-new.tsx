import { Reveal } from "@/components/marketing/reveal";
import { WHATS_NEW } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Novedades en rejilla compacta en vez de línea de tiempo vertical: cuatro
 * titulares caben de un vistazo y nadie tiene que hacer scroll para ver si
 * el producto sigue vivo, que es lo único que esta sección debe demostrar.
 */
export function WhatsNew() {
  return (
    <section id="novedades" className="relative bg-surface-soft py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
              Novedades
            </p>
            <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
              Se actualiza sin que instales nada
            </h2>
          </div>
          <p className="max-w-sm text-ink-muted">
            Lo último que entró en producción. Sin migraciones, sin parar el
            servicio, sin pagar aparte.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {WHATS_NEW.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i * 60}>
              <article className="group h-full rounded-card border border-brand-100 bg-white p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_18px_44px_-26px_rgba(76,29,149,0.55)]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      item.tag === "Nuevo"
                        ? "bg-gradient-to-r from-brand-700 to-brand-600 text-white"
                        : "bg-brand-100 text-brand-800",
                    )}
                  >
                    {item.tag}
                  </span>
                  <time className="text-sm font-medium text-ink-faint">
                    {item.date}
                  </time>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
