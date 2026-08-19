import { Check, Minus } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { ADD_ONS, PLAN_COMPARISON, PLANS } from "@/lib/site";
import { cn, formatNumber } from "@/lib/utils";

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
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            Sin comisión por venta ni cobro por transacción. Los 14 días de
            prueba no piden tarjeta.
          </p>
        </Reveal>

        <div className="mt-14 grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80}>
              <article
                aria-labelledby={`plan-${plan.id}`}
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-card p-8",
                  plan.featured
                    ? "bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 shadow-[0_30px_80px_-38px_rgba(76,29,149,0.85)] xl:-mt-4 xl:pb-10"
                    : "border border-brand-100 bg-white",
                )}
              >
                {plan.featured && (
                  <span className="absolute right-6 top-6 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/25">
                    Recomendado
                  </span>
                )}

                <h3
                  id={`plan-${plan.id}`}
                  className={cn(
                    "font-display text-2xl font-semibold",
                    plan.featured ? "text-white" : "text-ink",
                  )}
                >
                  {plan.name}
                </h3>
                <p
                  className={cn(
                    "mt-2 min-h-16 text-[0.95rem] leading-relaxed",
                    plan.featured ? "text-brand-100" : "text-ink-muted",
                  )}
                >
                  {plan.pitch}
                </p>

                <p className="mt-6 flex items-baseline gap-1.5">
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
                      "tnum font-display text-5xl font-semibold tracking-tight",
                      plan.featured ? "text-white" : "text-ink",
                    )}
                  >
                    {formatNumber(plan.price ?? 0)}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-sm",
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
                    "mt-8 inline-flex h-13 items-center justify-center rounded-full px-6 font-semibold transition-[background-color,background-image,transform] duration-150 active:scale-[0.98]",
                    plan.featured
                      ? "bg-white text-brand-900 hover:bg-brand-100"
                      : "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-[0_10px_30px_-12px_rgba(109,40,217,0.8)] hover:from-brand-700 hover:to-brand-900",
                  )}
                >
                  {plan.cta}
                </a>

                <ul
                  className={cn(
                    "mt-8 space-y-3 border-t pt-8",
                    plan.featured ? "border-white/20" : "border-brand-100",
                  )}
                >
                  {plan.features.map((feature) => {
                    // Las líneas "Todo lo de X, más:" son encabezados, no ítems.
                    const isHeading = feature.endsWith("más:");
                    return (
                      <li
                        key={feature}
                        className={cn(
                          "flex gap-3 text-[0.95rem]",
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
                        <span>{feature}</span>
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
          <h3 className="text-center font-display text-2xl font-semibold text-ink">
            Compara los planes
          </h3>
          <div className="mt-8 overflow-x-auto rounded-card border border-brand-100 bg-white">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className="px-5 py-4 font-semibold text-ink">Función</th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={cn(
                        "px-4 py-4 text-center font-semibold",
                        plan.featured ? "text-brand-700" : "text-ink",
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
                    className="border-b border-brand-50 last:border-0"
                  >
                    <th
                      scope="row"
                      className="px-5 py-3.5 font-normal text-ink-soft"
                    >
                      {row.feature}
                    </th>
                    {(
                      [row.punto, row.negocio, row.control, row.cadena] as const
                    ).map((cell, idx) => (
                      <td key={idx} className="px-4 py-3.5 text-center">
                        <ComparisonCell value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Complementos */}
        <Reveal className="mt-16">
          <h3 className="text-center font-display text-2xl font-semibold text-ink">
            Complementos
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-muted">
            Añade lo que necesites cuando lo necesites. Sin renegociar el plan.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <div
                key={addon.name}
                className="flex flex-col rounded-card border border-brand-100 bg-white p-6"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-ink">{addon.name}</p>
                </div>
                <p className="mt-3 flex items-baseline gap-1 font-display text-ink">
                  <span className="text-xl font-semibold">
                    {addon.priceLabel ?? `$${formatNumber(addon.price)}`}
                  </span>
                  {addon.unit && (
                    <span className="text-sm text-ink-muted">{addon.unit}</span>
                  )}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {addon.note}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-12 text-center">
          <p className="text-sm text-ink-muted">
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
        <Check
          className="mx-auto size-5 text-brand-600"
          aria-hidden="true"
        />
        <span className="sr-only">Sí</span>
      </>
    );
  }
  if (value === "—") {
    return (
      <>
        <Minus
          className="mx-auto size-4 text-ink-faint"
          aria-hidden="true"
        />
        <span className="sr-only">No incluido</span>
      </>
    );
  }
  return <span className="text-ink-soft">{value}</span>;
}
