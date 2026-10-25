"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { SOPORTE } from "@/lib/soporte";
import {
  ADD_ONS,
  PLAN_COMPARISON,
  PLANS,
  type PlanComparisonRow,
} from "@/lib/site";
import { cn, formatNumber } from "@/lib/utils";

/** Columnas de datos de la tabla comparativa; coinciden con `plan.id`. */
type ClavePlan = Exclude<keyof PlanComparisonRow, "feature">;

type Ciclo = "mensual" | "anual";

/**
 * Planes y precios.
 *
 * Sin tarjetas: cuatro columnas separadas por una raya, como una lista de
 * precios impresa. El plan recomendado no se infla ni cambia de fondo; lleva
 * una franja orquídea arriba y es el único botón lleno.
 *
 * El anual vale diez mensualidades en los cuatro planes, así que el selector
 * puede decir "2 meses gratis" sin redondear nada. La tabla y los
 * complementos van plegados: son para quien ya está decidiendo.
 */
export function Pricing() {
  const [ciclo, setCiclo] = useState<Ciclo>("mensual");

  return (
    <section id="precios" aria-labelledby="precios-heading" className="bg-mesa py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="precios-heading"
            className="max-w-3xl font-mono text-[clamp(2.25rem,4.4vw,4rem)] leading-[0.98] font-extrabold tracking-[-0.05em] text-navy-950 uppercase"
          >
            Precio en pesos. Sin comisión por venta.
          </h2>

          {/* Interruptor de dos estados: dos botones con aria-pressed. */}
          <div
            role="group"
            aria-label="Ciclo de pago"
            className="inline-flex shrink-0 self-start border-2 border-navy-950 font-mono text-sm font-bold uppercase lg:self-auto"
          >
            {(["mensual", "anual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={ciclo === c}
                onClick={() => setCiclo(c)}
                className={cn(
                  "inline-flex h-12 items-center px-5 transition-colors duration-150",
                  ciclo === c ? "bg-navy-950 text-white" : "text-navy-950 hover:bg-white",
                )}
              >
                {c === "mensual" ? "Mensual" : "Anual · 2 meses gratis"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-16 grid border-t-2 border-navy-950 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, i) => {
            const anual = ciclo === "anual" && plan.priceAnnual != null;
            const precio = anual ? plan.priceAnnual! : (plan.price ?? 0);
            return (
              <article
                key={plan.id}
                aria-labelledby={`plan-${plan.id}`}
                className={cn(
                  "relative flex flex-col border-navy-950/20 py-8 sm:px-6 xl:px-7",
                  "max-sm:border-b sm:max-xl:border-b",
                  i % 2 === 1 && "sm:border-l",
                  i > 0 && "xl:border-l",
                )}
              >
                {plan.featured && (
                  <span aria-hidden="true" className="absolute -top-[2px] right-0 left-0 h-2 bg-brand-500" />
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <h3 id={`plan-${plan.id}`} className="font-mono text-2xl font-extrabold tracking-[-0.04em] text-navy-950 uppercase">
                    {plan.name}
                  </h3>
                  {plan.featured && (
                    <span className="font-mono text-xs font-bold text-brand-700 uppercase">Recomendado</span>
                  )}
                </div>
                <p className="mt-3 text-pretty text-[0.95rem] leading-relaxed text-navy-950/70 sm:min-h-[4.5rem] xl:min-h-24">
                  {plan.pitch}
                </p>

                <p className="mt-6 flex items-baseline gap-1.5 font-mono text-navy-950">
                  <span className="text-[clamp(2rem,3.4vw,2.6rem)] leading-none font-extrabold tracking-[-0.05em]">
                    ${formatNumber(precio)}
                  </span>
                  <span className="text-sm text-navy-950/60">{anual ? "/año" : plan.cadence}</span>
                </p>
                <p className="mt-2 h-5 font-mono text-sm text-navy-950/60">
                  {anual && <>= ${formatNumber(Math.round(precio / 12))} al mes</>}
                </p>

                <a
                  href={`/registro?plan=${plan.id}`}
                  className={cn(
                    "mt-6 inline-flex h-13 items-center justify-center px-5 text-center font-mono text-sm font-bold uppercase transition-colors duration-150",
                    plan.featured
                      ? "bg-navy-950 text-white hover:bg-brand-700"
                      : "border-2 border-navy-950 text-navy-950 hover:bg-white",
                  )}
                >
                  {plan.cta}
                </a>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => {
                    // Las líneas "Todo lo de X, más:" son encabezados, no ítems.
                    const isHeading = feature.endsWith("más:");
                    return (
                      <li
                        key={feature}
                        className={cn(
                          "flex gap-3 text-[0.95rem] leading-snug",
                          isHeading ? "font-semibold text-navy-950" : "text-navy-950/80",
                        )}
                      >
                        {!isHeading && (
                          <Check className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                        )}
                        <span className="text-pretty">{feature}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>

        <details className="group mt-12 border-y-2 border-navy-950">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 font-mono text-base font-bold text-navy-950 uppercase [&::-webkit-details-marker]:hidden">
            Comparar planes y ver complementos
            <Plus
              className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-45"
              aria-hidden="true"
            />
          </summary>

          <div className="pb-10">
            {/* La tabla mide 40rem como mínimo: en móvil desborda DENTRO de su
                contenedor (nunca el <body>) y la primera columna queda fija. */}
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <caption className="sr-only">Funciones incluidas en cada plan</caption>
                <thead>
                  <tr className="border-b border-navy-950/20 font-mono uppercase">
                    <th scope="col" className="sticky left-0 bg-mesa py-4 pr-4 font-bold text-navy-950/60">
                      Función
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan.id}
                        scope="col"
                        className={cn(
                          "px-3 py-4 text-center font-bold",
                          plan.featured ? "text-brand-700" : "text-navy-950",
                        )}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-b border-navy-950/10 last:border-0">
                      <th scope="row" className="sticky left-0 bg-mesa py-3.5 pr-4 font-normal text-navy-950/80">
                        {row.feature}
                      </th>
                      {PLANS.map((plan) => (
                        <td key={plan.id} className="px-3 py-3.5 text-center">
                          <Celda value={row[plan.id as ClavePlan]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-12 font-mono text-lg font-extrabold text-navy-950 uppercase">Complementos</h3>
            <ul className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {ADD_ONS.map((addon) => (
                <li key={addon.name} className="border-t border-navy-950/20 pt-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold text-navy-950">{addon.name}</span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        addon.priceLabel ? "text-brand-700" : "text-navy-950",
                      )}
                    >
                      {addon.priceLabel ?? `$${formatNumber(addon.price)}`}
                      {addon.unit && <span className="ml-1 font-normal text-navy-950/60">{addon.unit}</span>}
                    </span>
                  </p>
                  <p className="mt-1 text-pretty text-sm leading-relaxed text-navy-950/70">{addon.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </details>

        <p className="mt-8 max-w-3xl text-pretty text-navy-950/70">
          Precios en pesos colombianos. ¿Vienes de Siigo, Alegra o Excel?{" "}
          <Link href="/comparativa" className="font-semibold text-navy-950 underline underline-offset-4 hover:text-brand-700">
            Mira en qué cambia
          </Link>
          . ¿Más de 3 sedes o algo a la medida?{" "}
          <a
            href={`mailto:${SOPORTE.ventas}`}
            className="font-semibold text-navy-950 underline underline-offset-4 hover:text-brand-700"
          >
            Escríbenos
          </a>
          .
        </p>
      </div>
    </section>
  );
}

/** Celda de la tabla comparativa: "Sí" con check, "—" con raya, o texto. */
function Celda({ value }: { value: string }) {
  if (value === "Sí") {
    return (
      <>
        {/* brand-700 sobre la mesa gris: 6.6:1, holgado para un icono. */}
        <Check className="mx-auto size-5 text-brand-700" aria-hidden="true" />
        <span className="sr-only">Sí</span>
      </>
    );
  }
  if (value === "—") {
    return (
      <>
        <Minus className="mx-auto size-4 text-navy-950/45" aria-hidden="true" />
        <span className="sr-only">No incluido</span>
      </>
    );
  }
  return <span className="text-navy-950/80">{value}</span>;
}
