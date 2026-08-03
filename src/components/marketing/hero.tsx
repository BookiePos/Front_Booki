"use client";

import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const TICKET = [
  { qty: 2, name: "Bandeja paisa", total: 76_000 },
  { qty: 1, name: "Limonada de coco", total: 12_000 },
  { qty: 3, name: "Empanada de carne", total: 10_500 },
];

const SUBTOTAL = TICKET.reduce((sum, line) => sum + line.total, 0);
const INC = Math.round(SUBTOTAL * 0.08);

export function Hero() {
  return (
    <section className="grain relative overflow-hidden pt-20 pb-20 sm:pt-24 sm:pb-28">
      <div className="aurora" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <a
            href="#novedades"
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 py-2 pl-2 pr-4 text-sm font-medium text-brand-800 backdrop-blur transition-colors hover:border-brand-300 hover:bg-white"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-2.5 py-1 text-xs font-bold text-white">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Nuevo
            </span>
            Nómina con descuento por consumo del equipo
          </a>

          <h1 className="mt-7 text-balance font-display font-semibold text-ink text-hero">
            Cierra la cuenta.
            <br />
            Y de paso,{" "}
            <span className="whitespace-nowrap text-brand-700">el mes.</span>
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-ink-muted sm:text-xl">
            El punto de venta y el sistema operacional, en uno. Tú cobras en la
            mesa: inventario, caja, cartera y contabilidad se mueven solos.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#precios"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 px-8 text-base font-semibold text-white shadow-[0_12px_36px_-10px_rgba(109,40,217,0.9)] transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.98]"
            >
              Probar 14 días gratis
              <ArrowRight
                className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </a>
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-full border border-brand-300 bg-brand-50 px-8 text-base font-semibold text-brand-800 transition-colors duration-150 hover:border-brand-400 hover:bg-brand-100"
            >
              Ya tengo cuenta
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            {["Sin tarjeta de crédito", "Factura electrónica DIAN", "Multi-sede"].map(
              (item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Check className="size-4 text-brand-600" aria-hidden="true" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        {/* Vista de producto: la cuenta tal como se ve en el POS. */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-200/70 via-brand-100/40 to-transparent blur-2xl"
          />

          <div className="relative rounded-card border border-hairline bg-white p-6 shadow-[0_28px_70px_-32px_rgba(46,16,101,0.45)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                  Mesa 7 · Sede Centro
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink">
                  Cuenta abierta
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800">
                4 personas
              </span>
            </div>

            <ul className="mt-6 divide-y divide-hairline">
              {TICKET.map((line) => (
                <li key={line.name} className="flex items-center gap-3 py-3">
                  <span className="tnum inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-800">
                    {line.qty}
                  </span>
                  <span className="flex-1 text-[0.95rem] text-ink-soft">{line.name}</span>
                  <span className="tnum text-[0.95rem] font-semibold text-ink">
                    ${formatNumber(line.total)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
              <div className="flex justify-between text-ink-muted">
                <dt>Subtotal</dt>
                <dd className="tnum">${formatNumber(SUBTOTAL)}</dd>
              </div>
              <div className="flex justify-between text-ink-muted">
                <dt>INC 8%</dt>
                <dd className="tnum">${formatNumber(INC)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="font-display text-lg font-semibold text-ink">Total</dt>
                <dd className="tnum font-display text-3xl font-semibold text-brand-700">
                  ${formatNumber(SUBTOTAL + INC)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex h-14 items-center justify-center rounded-2xl bg-brand-700 text-base font-semibold text-white">
              Cobrar
            </div>
          </div>

          {/* Consecuencia contable de ese cobro — el argumento de venta real. */}
          <div className="relative mx-4 -mt-3 rounded-b-card border border-t-0 border-hairline bg-brand-50/80 px-5 py-4 backdrop-blur sm:mx-8">
            <p className="flex items-center gap-2 text-sm font-medium text-brand-900">
              <Check className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
              Al cobrar: baja inventario, entra a caja y postea el asiento contable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
