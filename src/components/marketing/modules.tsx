import { ArrowUpRight, Check } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { MODULES } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Ver `benefits.tsx`: rompe el banding del degradado violeta grande. */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Las dos tarjetas no comparten morado a propósito.
 *
 * Antes las dos iban en la misma franja de la escala y el par se leía como una
 * sola mancha: nada destacaba. Ahora el POS —la pantalla que se demuestra en
 * una feria— se queda con la orquídea viva (700→900) y Operación se hunde
 * hacia la tinta y el marino del logo (900→950→navy). La jerarquía la marca la
 * profundidad, no el tamaño.
 *
 * El 700 es el paso más claro que admite el texto de la tarjeta a 4.5:1 con el
 * halo encendido; por eso el halo va topado (0.24 en reposo, 0.30 en hover):
 * por encima de ahí el `brand-100` sobre el fondo aclarado cae por debajo de AA.
 */
const SUPERFICIES = [
  {
    lienzo:
      "linear-gradient(152deg, var(--color-brand-700) 0%, var(--color-brand-800) 52%, var(--color-brand-900) 100%)",
    halo: "radial-gradient(circle, var(--color-brand-500) 0%, transparent 70%)",
    haloClase: "opacity-[0.24] group-hover:opacity-[0.30]",
  },
  {
    lienzo:
      "linear-gradient(152deg, var(--color-brand-900) 0%, var(--color-brand-950) 50%, var(--color-navy-950) 100%)",
    halo: "radial-gradient(circle, var(--color-brand-600) 0%, transparent 70%)",
    haloClase: "opacity-[0.34] group-hover:opacity-[0.44]",
  },
];

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
          {MODULES.map((mod, i) => {
            const superficie = SUPERFICIES[i] ?? SUPERFICIES[0];
            return (
              <Reveal key={mod.id} delay={i * 90}>
                <article
                  className={cn(
                    "group relative flex h-full flex-col overflow-hidden rounded-card p-6 sm:p-8 lg:p-10",
                    "ring-1 ring-inset ring-white/12 transition-transform duration-300 hover:-translate-y-1",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_28px_60px_-34px_rgba(56,0,96,0.9)]",
                  )}
                  style={{ background: superficie.lienzo }}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute -right-20 -top-20 size-72 rounded-full blur-3xl transition-opacity duration-500",
                      superficie.haloClase,
                    )}
                    style={{ background: superficie.halo }}
                  />
                  {/* Viñeta: hunde las esquinas para que la tarjeta tenga cuerpo
                      en vez de leerse como un rectángulo de color plano. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(110% 85% at 25% 8%, transparent 42%, rgba(0, 8, 28, 0.45) 100%)",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
                    style={{ backgroundImage: GRANO, backgroundSize: "160px 160px" }}
                  />

                  <div className="relative">
                    <p className="text-sm font-semibold text-brand-100">{mod.tag}</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                      {mod.name}
                    </h3>
                    <p className="mt-3 text-lg text-white/90 sm:text-xl">{mod.claim}</p>

                    {/* Maqueta de pantalla: vale más que otro párrafo.
                        Las filas normales se hunden con negro translúcido y la
                        destacada sube con blanco: el panel se lee rebajado
                        dentro de la tarjeta, no pegado encima. */}
                    <dl className="mt-7 space-y-px overflow-hidden rounded-2xl bg-white/6 ring-1 ring-inset ring-white/12 backdrop-blur-sm">
                      {mod.screen.map((row) => (
                        <div
                          key={row.label}
                          className={cn(
                            "flex items-center justify-between gap-3 px-3.5 py-3 sm:gap-4 sm:px-4",
                            row.accent ? "bg-white/12" : "bg-black/15",
                          )}
                        >
                          {/* En móvil la etiqueta envuelve en vez de cortarse:
                              a 320px `truncate` dejaba "Venta del día · 3 s…" */}
                          <dt
                            className={cn(
                              "min-w-0 text-sm sm:truncate",
                              row.accent
                                ? "font-semibold text-white"
                                : "text-brand-100",
                            )}
                          >
                            {row.label}
                          </dt>
                          <dd
                            className={cn(
                              "tnum shrink-0 text-sm",
                              row.accent
                                ? "font-display text-lg font-semibold text-white sm:text-xl"
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
                            className="mt-0.5 size-4 shrink-0 text-brand-200"
                            aria-hidden="true"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>

                    {/* `min-h-12` y no `h-12`: "Abrir BookiPos Operación" mide
                        más que el ancho útil de la tarjeta a 320px, y con alto
                        fijo el rótulo se recortaba contra el `overflow-hidden`.
                        Ancho completo en móvil, píldora a partir de sm. */}
                    <a
                      href={mod.href}
                      className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-center font-semibold text-brand-900 shadow-[0_10px_24px_-14px_rgba(0,8,28,0.9)] transition-[background-color,transform] duration-150 hover:bg-brand-100 active:scale-[0.98] sm:w-auto sm:px-6"
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
