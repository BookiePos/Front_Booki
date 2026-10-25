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
 * Una sola lámina blanca con los cuatro planes separados por rayas finas (no
 * cuatro tarjetas sueltas). El recomendado es la única columna en marino, se
 * sale un poco de la lámina por arriba y por abajo y lleva el único botón
 * orquídea: se ve primero sin necesidad de flechas ni sellos.
 *
 * El anual vale diez mensualidades en los cuatro planes, así que el selector
 * puede decir "2 meses gratis" y cada plan "ahorras" dos mensualidades exactas.
 * Al cambiar de ciclo, la cifra entra de nuevo (`key`) para que se note el
 * cambio. La tabla y los complementos van plegados: son para quien ya está
 * decidiendo.
 */
export function Pricing() {
  const [ciclo, setCiclo] = useState<Ciclo>("mensual");

  return (
    <section id="precios" aria-labelledby="precios-heading" className="bg-mesa py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="precios-heading"
            className="max-w-3xl font-titular text-[clamp(2.25rem,4.4vw,4rem)] leading-[1] font-semibold tracking-[-0.045em] text-balance text-navy-950"
          >
            Precio en pesos. Sin comisión por venta.
          </h2>

          {/* Interruptor de dos estados: dos botones con aria-pressed y una
              pastilla marina que se desliza al elegido. */}
          <div
            role="group"
            aria-label="Ciclo de pago"
            className="relative grid shrink-0 grid-cols-2 self-start rounded-lg bg-white p-1 text-sm font-semibold shadow-[0_1px_2px_rgb(26_22_38/0.06)] ring-1 ring-navy-950/10 lg:self-auto"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-navy-950 transition-transform duration-300 ease-[cubic-bezier(0.3,0.7,0.2,1)]",
                ciclo === "anual" && "translate-x-full",
              )}
            />
            {(["mensual", "anual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={ciclo === c}
                onClick={() => setCiclo(c)}
                className={cn(
                  "relative inline-flex h-10 items-center justify-center gap-2 px-4 whitespace-nowrap transition-colors duration-200",
                  ciclo === c ? "text-white" : "text-navy-950 hover:text-brand-700",
                )}
              >
                {c === "mensual" ? "Mensual" : "Anual"}
                {c === "anual" && (
                  <span className={cn("text-xs", ciclo === c ? "text-emerald-300" : "text-positive")}>
                    2 meses gratis
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-16 grid rounded-lg bg-white shadow-[0_1px_2px_rgb(26_22_38/0.06),0_30px_60px_-30px_rgb(26_22_38/0.3)] ring-1 ring-navy-950/8 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, i) => {
            const anual = ciclo === "anual" && plan.priceAnnual != null;
            const precio = anual ? plan.priceAnnual! : (plan.price ?? 0);
            const destacado = plan.featured;
            const anteriorDestacado = PLANS[i - 1]?.featured;
            return (
              <article
                key={plan.id}
                aria-labelledby={`plan-${plan.id}`}
                className={cn(
                  "relative flex flex-col p-7",
                  destacado
                    ? "z-10 rounded-lg bg-navy-950 text-white shadow-[0_30px_60px_-20px_rgb(26_22_38/0.55)] xl:-my-5 xl:py-12"
                    : "border-navy-950/10 text-navy-950",
                  // Rayas entre columnas, nunca pegadas a la marina.
                  !destacado && i > 0 && "max-sm:border-t",
                  !destacado && i % 2 === 1 && "sm:max-xl:border-l",
                  !destacado && i >= 2 && "sm:max-xl:border-t",
                  !destacado && i > 0 && !anteriorDestacado && "xl:border-l",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 id={`plan-${plan.id}`} className="font-titular text-2xl font-semibold tracking-[-0.03em]">
                    {plan.name}
                  </h3>
                  {destacado && (
                    <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white">
                      Recomendado
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-3 text-pretty text-[0.95rem] leading-relaxed sm:min-h-[4.5rem] xl:min-h-24",
                    destacado ? "text-white/70" : "text-navy-950/65",
                  )}
                >
                  {plan.pitch}
                </p>

                {/* A 2.4vw cabe "$4.499.000 /año" en una columna de escritorio;
                    a 3.6vw el "/año" se salía de la columna. */}
                <p className="mt-6 flex flex-wrap items-baseline gap-x-1.5">
                  <span
                    key={ciclo}
                    className="precio-entra tnum font-titular text-[clamp(2.25rem,6vw,2.75rem)] leading-none font-semibold tracking-[-0.045em] sm:text-[clamp(2rem,4.2vw,2.75rem)] xl:text-[clamp(2rem,2.4vw,2.6rem)]"
                  >
                    ${formatNumber(precio)}
                  </span>
                  <span className={cn("text-sm", destacado ? "text-white/60" : "text-navy-950/55")}>
                    {anual ? "/año" : plan.cadence}
                  </span>
                </p>
                {/* Alto fijo de dos renglones en los dos ciclos: los botones no
                    saltan al cambiar entre mensual y anual. */}
                <div className="tnum mt-2.5 flex h-12 flex-col items-start gap-1 text-sm">
                  {anual && (
                    <>
                      <span className={destacado ? "text-white/60" : "text-navy-950/55"}>
                        ${formatNumber(Math.round(precio / 12))} al mes
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          destacado ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-50 text-positive",
                        )}
                      >
                        Ahorras ${formatNumber((plan.price ?? 0) * 12 - precio)}
                      </span>
                    </>
                  )}
                </div>

                <a
                  href={`/registro?plan=${plan.id}`}
                  className={cn(
                    "mt-6 inline-flex h-12 items-center justify-center rounded-md px-5 text-center text-[0.9375rem] font-semibold transition-colors duration-150",
                    destacado
                      ? "bg-brand-500 text-white hover:bg-brand-600"
                      : "bg-navy-950/[0.04] text-navy-950 ring-1 ring-navy-950/15 ring-inset hover:bg-navy-950 hover:text-white",
                  )}
                >
                  {plan.cta}
                </a>

                <ul
                  className={cn(
                    "mt-8 space-y-3 border-t pt-7",
                    destacado ? "border-white/12" : "border-navy-950/10",
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
                          !isHeading && (destacado ? "text-white/85" : "text-navy-950/80"),
                        )}
                      >
                        {!isHeading && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
                              destacado ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-700",
                            )}
                          >
                            <Check className="size-3" strokeWidth={3} />
                          </span>
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

        <details className="group mt-16 border-y border-navy-950/25">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 font-titular text-lg font-semibold tracking-[-0.01em] text-navy-950 [&::-webkit-details-marker]:hidden">
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
                  <tr className="border-b border-navy-950/20">
                    <th scope="col" className="sticky left-0 bg-mesa py-4 pr-4 font-semibold text-navy-950/60">
                      Función
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan.id}
                        scope="col"
                        className={cn(
                          "px-3 py-4 text-center font-semibold",
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

            <h3 className="mt-12 font-titular text-xl font-semibold tracking-[-0.02em] text-navy-950">Complementos</h3>
            <ul className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {ADD_ONS.map((addon) => (
                <li key={addon.name} className="border-t border-navy-950/20 pt-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold text-navy-950">{addon.name}</span>
                    <span
                      className={cn(
                        "tnum font-semibold",
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
        {/* brand-700 sobre la mesa lila: 6.6:1, holgado para un icono. */}
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
