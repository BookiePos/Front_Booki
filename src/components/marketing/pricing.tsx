import { Check, Minus } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import {
  ADD_ONS,
  PLAN_COMPARISON,
  PLANS,
  type PlanComparisonRow,
} from "@/lib/site";
import { cn, formatNumber } from "@/lib/utils";

/** Columnas de datos de la tabla comparativa; coinciden con `plan.id`. */
type ClavePlan = Exclude<keyof PlanComparisonRow, "feature">;

/**
 * Grano finísimo (fractal noise) en data URI. ~250 bytes, sin petición extra.
 * Sin él, el degradado de la tarjeta destacada —tres pasos de morado sobre
 * 500px de alto— bandea en pantallas de 8 bits.
 */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Planes y precios.
 *
 * ── La tarjeta destacada ──────────────────────────────────────────────────
 * Era `from-brand-800 via-brand-700 to-brand-600`, es decir el paso MÁS CLARO
 * de la escala caía justo en la esquina inferior derecha, que es donde vive la
 * lista de funciones. Ahí los contrastes se caían:
 *
 *   texto      antes (sobre brand-600)   después (sobre brand-700→950)
 *   brand-200      4.04:1  ✗ AA              5.56 – 10.71:1  ✓ AA/AAA
 *   brand-300      2.90:1  ✗ (icono 3:1)     4.00 –  7.70:1  ✓
 *   brand-100      4.97:1  ✓ justo           6.85 – 13.19:1  ✓ AAA
 *   blanco         5.92:1  ✓                 8.15 – 15.71:1  ✓ AAA
 *
 * Ahora el degradado va 700 → 800 → 950 (se hunde en vez de aclararse) y el
 * brillo se aporta con un radial de brand-500 al 22% arriba a la izquierda,
 * calibrado para que ni en su centro baje ningún texto de AA: en el peor
 * punto brand-200 marca 4.67:1 y brand-300 3.36:1.
 *
 * La profundidad no la da el color plano sino cuatro capas: degradado, brillo
 * radial, grano al 5% en `mix-blend-overlay` (mata el banding) y un anillo
 * interior de 1px en blanco al 15%, más ligero que el relleno, que dibuja el
 * canto. La sombra es morada (brand-900/950), no negra: una sombra negra bajo
 * un morado saturado se ve sucia.
 *
 * ── Jerarquía ─────────────────────────────────────────────────────────────
 * La etiqueta "Recomendado" sola no bastaba. Ahora el plan destacado gana por
 * tres vías: color (es el único bloque morado de la sección), elevación
 * (`xl:-my-4` lo hace 32px más alto que sus vecinos, y `-my` en vez de `-mt`
 * para que crezca centrado y no descuelgue) y sombra proyectada. La etiqueta
 * pasa a blanco sólido sobre morado —13.38:1— en vez del `white/15` translúcido
 * que se disolvía en el fondo.
 *
 * ── Responsive ────────────────────────────────────────────────────────────
 * El precio iba en `text-5xl` fijo: "449.900" a 48px no cabe en una tarjeta de
 * dos columnas a 640px. Ahora es `clamp(2.25rem, 5.2vw, 2.75rem)`. El padding
 * baja a 24px en móvil (32px fijos dejaban 216px de contenido a 320px). La
 * fila de la etiqueta se reserva en TODAS las tarjetas con alto fijo, así que
 * los títulos alinean y la etiqueta ya no se superpone al nombre del plan en
 * anchos estrechos —antes iba en `absolute`—.
 */
export function Pricing() {
  return (
    <section id="precios" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
            Precios
          </p>
          <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
            Precio claro, en pesos
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            Sin comisión por venta ni cobro por transacción. Los 14 días de
            prueba no piden tarjeta.
          </p>
        </Reveal>

        {/* Sin `items-start`: con él cada tarjeta media lo que su contenido y
            los botones quedaban a distinta altura en cada columna. */}
        <div className="mt-10 grid gap-6 sm:mt-14 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, i) => (
            <Reveal
              key={plan.id}
              delay={i * 80}
              className={cn("h-full", plan.featured && "xl:-my-4")}
            >
              <article
                aria-labelledby={`plan-${plan.id}`}
                className={cn(
                  "relative isolate flex h-full flex-col overflow-hidden rounded-card p-6 sm:p-7 xl:p-8",
                  plan.featured
                    ? "bg-brand-900 shadow-[0_36px_88px_-40px_rgba(74,7,115,0.85),0_10px_28px_-16px_rgba(56,0,96,0.55)]"
                    : "bg-gradient-to-b from-white to-brand-50/70 shadow-[0_1px_2px_rgba(74,7,115,0.05),0_14px_36px_-28px_rgba(74,7,115,0.45)] ring-1 ring-inset ring-brand-200",
                )}
              >
                {plan.featured && (
                  <>
                    {/* Lienzo: se hunde de brand-700 a brand-950, nunca se
                        aclara hacia el pie de la tarjeta. */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10"
                      style={{
                        background:
                          "linear-gradient(158deg, var(--color-brand-700) 0%, var(--color-brand-800) 44%, var(--color-brand-950) 100%)",
                      }}
                    />
                    {/* Brillo: brand-500 al 22%. Al 28% brand-200 ya caía a
                        4.44:1, por debajo de AA — de ahí el tope. */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10"
                      style={{
                        background:
                          "radial-gradient(120% 68% at 16% 0%, rgba(177, 96, 228, 0.22) 0%, transparent 64%)",
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay"
                      style={{
                        backgroundImage: GRANO,
                        backgroundSize: "160px 160px",
                      }}
                    />
                    {/* Canto de 1px, apenas más claro que el relleno. Va sin
                        z negativo a propósito: un `ring-inset` en el propio
                        <article> se pinta con su fondo y las capas de arriba
                        (z -10) lo taparían. */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-inset ring-white/15"
                    />
                  </>
                )}

                {/* Fila reservada en todas las tarjetas: mantiene los títulos
                    alineados y saca la etiqueta del flujo `absolute`, que a
                    320px se montaba encima del nombre del plan. */}
                <div className="flex h-7 items-center">
                  {plan.featured && (
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-900 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)]">
                      Recomendado
                    </span>
                  )}
                </div>

                <h3
                  id={`plan-${plan.id}`}
                  className={cn(
                    "mt-4 font-display text-2xl font-semibold",
                    plan.featured ? "text-white" : "text-ink",
                  )}
                >
                  {plan.name}
                </h3>
                <p
                  className={cn(
                    // Alto mínimo solo desde `sm`, que es donde hay más de una
                    // tarjeta por fila y la desalineación se nota. En móvil
                    // (una columna) reservar espacio solo abre huecos.
                    "mt-2 text-pretty text-[0.95rem] leading-relaxed sm:min-h-20 xl:min-h-[6.5rem]",
                    plan.featured ? "text-brand-100" : "text-ink-muted",
                  )}
                >
                  {plan.pitch}
                </p>

                <p className="mt-6 flex flex-wrap items-baseline gap-x-1.5">
                  <span
                    className={cn(
                      "font-display text-2xl font-semibold",
                      plan.featured ? "text-brand-200" : "text-ink",
                    )}
                  >
                    $
                  </span>
                  <span
                    className={cn(
                      "tnum font-display text-[clamp(2.25rem,5.2vw,2.75rem)] font-semibold leading-none tracking-tight",
                      plan.featured ? "text-white" : "text-ink",
                    )}
                  >
                    {formatNumber(plan.price ?? 0)}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    plan.featured ? "text-brand-200" : "text-ink-muted",
                  )}
                >
                  {plan.cadence}
                  {plan.priceAnnual != null && (
                    <>
                      {" · o "}
                      <span className="tnum">
                        ${formatNumber(plan.priceAnnual)}
                      </span>{" "}
                      al año
                    </>
                  )}
                </p>

                <a
                  href={`/registro?plan=${plan.id}`}
                  className={cn(
                    "mt-7 inline-flex h-13 items-center justify-center rounded-full px-5 text-center font-semibold transition-[background-color,background-image,transform] duration-150 active:scale-[0.98] sm:px-6",
                    plan.featured
                      ? "bg-white text-brand-900 shadow-[0_14px_32px_-16px_rgba(0,0,0,0.65)] hover:bg-brand-100"
                      : "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white shadow-[0_10px_28px_-12px_rgba(74,7,115,0.75)] ring-1 ring-inset ring-white/20 hover:from-brand-700 hover:via-brand-800 hover:to-brand-900",
                  )}
                >
                  {plan.cta}
                </a>

                <ul
                  className={cn(
                    "mt-7 space-y-3 border-t pt-7",
                    plan.featured ? "border-white/20" : "border-brand-200",
                  )}
                >
                  {plan.features.map((feature) => {
                    // Las líneas "Todo lo de X, más:" son encabezados, no ítems.
                    const isHeading = feature.endsWith("más:");
                    return (
                      <li
                        key={feature}
                        className={cn(
                          "flex gap-3 text-[0.95rem] leading-snug",
                          isHeading && "font-semibold",
                          plan.featured
                            ? isHeading
                              ? "text-white"
                              : "text-brand-100"
                            : isHeading
                              ? "text-ink"
                              : "text-ink-soft",
                        )}
                      >
                        {!isHeading && (
                          <Check
                            className={cn(
                              "mt-0.5 size-4 shrink-0",
                              plan.featured ? "text-brand-300" : "text-brand-600",
                            )}
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-pretty">{feature}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Tabla comparativa */}
        <Reveal className="mt-16">
          <h3 className="text-balance text-center font-display text-2xl font-semibold text-ink">
            Compara los planes
          </h3>

          {/* La tabla mide 42rem como mínimo, así que por debajo de ~712px de
              viewport hay scroll horizontal DENTRO del contenedor (nunca en el
              <body>). Dos arreglos para que eso sea usable:
                · la primera columna es `sticky`: al desplazarse ya no se
                  pierde de vista de qué función habla cada fila;
                · un degradado en el borde derecho avisa de que hay más ancho,
                  y solo se pinta en los tamaños donde de verdad desborda. */}
          <div className="relative mt-8">
            <div className="overflow-x-auto overscroll-x-contain rounded-card bg-white shadow-[0_1px_2px_rgba(74,7,115,0.05),0_18px_44px_-34px_rgba(74,7,115,0.5)] ring-1 ring-inset ring-brand-200">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-200">
                    <th className="sticky left-0 z-10 bg-white px-5 py-4 font-semibold text-ink">
                      Función
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan.id}
                        className={cn(
                          "px-4 py-4 text-center font-semibold",
                          plan.featured
                            ? "bg-brand-100 text-brand-800"
                            : "text-ink",
                        )}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_COMPARISON.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-b border-brand-100 last:border-0"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-5 py-3.5 font-normal text-ink-soft"
                      >
                        {row.feature}
                      </th>
                      {PLANS.map((plan) => (
                        <td
                          key={plan.id}
                          className={cn(
                            "px-4 py-3.5 text-center",
                            plan.featured && "bg-brand-50",
                          )}
                        >
                          <ComparisonCell value={row[plan.id as ClavePlan]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-12 rounded-r-card bg-gradient-to-l from-white via-white/70 to-transparent max-[45rem]:block"
            />
          </div>
        </Reveal>

        {/* Complementos */}
        <Reveal className="mt-16">
          <h3 className="text-balance text-center font-display text-2xl font-semibold text-ink">
            Complementos
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-center text-ink-muted">
            Añade lo que necesites cuando lo necesites. Sin renegociar el plan.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <div
                key={addon.name}
                className="flex h-full flex-col rounded-card bg-gradient-to-b from-white to-brand-50/70 p-5 shadow-[0_1px_2px_rgba(74,7,115,0.05),0_12px_32px_-26px_rgba(74,7,115,0.45)] ring-1 ring-inset ring-brand-200 sm:p-6"
              >
                <p className="text-pretty font-semibold text-ink">{addon.name}</p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-1 font-display">
                  <span
                    className={cn(
                      "text-xl font-semibold",
                      // "Sin costo" es argumento de venta: se pinta de marca.
                      addon.priceLabel ? "text-brand-700" : "text-ink",
                    )}
                  >
                    {addon.priceLabel ?? `$${formatNumber(addon.price)}`}
                  </span>
                  {addon.unit && (
                    <span className="text-sm font-normal text-ink-muted">
                      {addon.unit}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-ink-muted">
                  {addon.note}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-12 text-center">
          <p className="text-pretty text-sm text-ink-muted">
            Precios en pesos colombianos. ¿Más de 3 sedes o integraciones a la
            medida?{" "}
            <a
              href="#contacto"
              className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
            >
              Hablemos
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** Celda de la tabla comparativa: "Sí" con check, "—" atenuado, o texto. */
function ComparisonCell({ value }: { value: string }) {
  if (value === "Sí") {
    return (
      <>
        {/* Icono como única señal → WCAG 1.4.11 pide 3:1. brand-600 sobre
            blanco da 5.92:1 y sobre el tinte brand-50 de la columna
            destacada, 5.53:1. */}
        <Check className="mx-auto size-5 text-brand-600" aria-hidden="true" />
        <span className="sr-only">Sí</span>
      </>
    );
  }
  if (value === "—") {
    return (
      <>
        {/* ink-faint: 3.49:1 sobre blanco y 3.26:1 sobre brand-50 — por encima
            del 3:1 exigido, y deliberadamente más apagado que el check. */}
        <Minus className="mx-auto size-4 text-ink-faint" aria-hidden="true" />
        <span className="sr-only">No incluido</span>
      </>
    );
  }
  return <span className="text-ink-soft">{value}</span>;
}
