import { ArrowUpRight, Check } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { MODULES } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Los dos módulos, cada uno en su tarjeta violeta con una maqueta de su
 * pantalla real. La maqueta hace el trabajo que haría un párrafo más: se ve de
 * un vistazo que uno cobra y el otro administra.
 */
export function Modules() {
  return (
    <section id="modulos" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
            Módulos
          </p>
          <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
            Dos pantallas, dos oficios
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            Quien vende necesita velocidad. Quien administra necesita detalle.
            La misma base de datos debajo.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {MODULES.map((mod, i) => (
            <Reveal key={mod.id} delay={i * 90}>
              <article
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-card p-8 sm:p-10",
                  "bg-gradient-to-br transition-transform duration-300 hover:-translate-y-1",
                  i === 0
                    ? "from-brand-800 via-brand-700 to-brand-600"
                    : "from-brand-950 via-brand-900 to-brand-800",
                )}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{
                    background:
                      "radial-gradient(circle, var(--color-brand-400) 0%, transparent 70%)",
                  }}
                />

                <div className="relative">
                  <p className="text-sm font-semibold text-brand-200">{mod.tag}</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-white">
                    {mod.name}
                  </h3>
                  <p className="mt-3 text-xl text-brand-100">{mod.claim}</p>

                  {/* Maqueta de pantalla: vale más que otro párrafo */}
                  <dl className="mt-7 space-y-px overflow-hidden rounded-2xl bg-white/8 ring-1 ring-white/12 backdrop-blur-sm">
                    {mod.screen.map((row) => (
                      <div
                        key={row.label}
                        className={cn(
                          "flex items-center justify-between gap-4 px-4 py-3",
                          row.accent ? "bg-white/12" : "bg-white/2",
                        )}
                      >
                        <dt
                          className={cn(
                            "truncate text-sm",
                            row.accent
                              ? "font-semibold text-white"
                              : "text-brand-200",
                          )}
                        >
                          {row.label}
                        </dt>
                        <dd
                          className={cn(
                            "tnum shrink-0 text-sm",
                            row.accent
                              ? "font-display text-xl font-semibold text-white"
                              : "font-medium text-brand-100",
                          )}
                        >
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
                    {mod.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2 text-sm text-brand-100"
                      >
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-brand-300"
                          aria-hidden="true"
                        />
                        {point}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={mod.href}
                    className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-brand-900 transition-[background-color,transform] duration-150 hover:bg-brand-100 active:scale-[0.98]"
                  >
                    Abrir {mod.name}
                    <ArrowUpRight
                      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
