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
    <section className="grain relative overflow-hidden pt-16 pb-16 sm:pt-24 sm:pb-28">
      <div className="aurora" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:gap-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          {/* En móvil el titular no cabe en una línea y la píldora se parte en
              tres renglones: `rounded-full` sobre tres renglones se ve como un
              globo. Redondeo de caja abajo, píldora a partir de sm. La altura
              mínima de 44px es el objetivo táctil, no una decisión estética. */}
          <a
            href="#novedades"
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-2xl border border-brand-200 bg-white/75 py-1.5 pl-1.5 pr-4 text-sm font-medium text-brand-800 shadow-[0_2px_10px_-6px_rgba(56,0,96,0.45)] backdrop-blur transition-colors hover:border-brand-300 hover:bg-white sm:rounded-full"
          >
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-brand-700 to-brand-900 px-2.5 py-1 text-xs font-bold text-white shadow-[0_2px_8px_-3px_rgba(56,0,96,0.7)] ring-1 ring-inset ring-white/25">
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
            {/* El degradado base y el de hover son dos capas superpuestas que
                se cruzan por `opacity`. Cambiar `background-image` en :hover no
                interpola de forma fiable y obliga a repintar el botón entero;
                una capa con opacity se compone en GPU. */}
            <a
              href="#precios"
              className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full px-6 text-base font-semibold text-white shadow-[0_10px_24px_-14px_rgba(56,0,96,0.85),0_22px_48px_-24px_rgba(146,48,207,0.7)] transition-transform duration-150 active:scale-[0.98] sm:px-8"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />
              {/* Filo de luz de 1px: es lo que separa un botón moldeado de una
                  mancha de color plana. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25"
              />
              <span className="relative inline-flex items-center gap-2">
                Probar 14 días gratis
                <ArrowRight
                  className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </a>
            <Link
              href="/login"
              className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full border border-brand-300 px-6 text-base font-semibold text-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-16px_rgba(56,0,96,0.6)] transition-[color,border-color,transform] duration-150 hover:border-brand-400 hover:text-brand-900 active:scale-[0.98] sm:px-8"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-brand-50 to-brand-100"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-brand-100 to-brand-200 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />
              <span className="relative">Ya tengo cuenta</span>
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            {["Sin tarjeta de crédito", "Factura electrónica DIAN", "Multi-sede"].map(
              (item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
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

          {/* La sombra va teñida de la tinta de marca (#380060), no de negro:
              sobre el papel violeta una sombra neutra se lee como suciedad. */}
          <div className="relative rounded-card border border-hairline bg-white p-5 shadow-[0_1px_2px_rgba(56,0,96,0.06),0_28px_70px_-34px_rgba(56,0,96,0.55)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                  Mesa 7 · Sede Centro
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink">
                  Cuenta abierta
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gradient-to-b from-brand-50 to-brand-100 px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-inset ring-brand-200/70">
                4 personas
              </span>
            </div>

            <ul className="mt-6 divide-y divide-hairline">
              {TICKET.map((line) => (
                <li key={line.name} className="flex items-center gap-3 py-3">
                  <span className="tnum inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-brand-50 to-brand-100 text-sm font-bold text-brand-800 ring-1 ring-inset ring-brand-200/60">
                    {line.qty}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
                    {line.name}
                  </span>
                  <span className="tnum shrink-0 text-[0.95rem] font-semibold text-ink">
                    ${formatNumber(line.total)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
              <div className="flex justify-between gap-4 text-ink-muted">
                <dt>Subtotal</dt>
                <dd className="tnum">${formatNumber(SUBTOTAL)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-ink-muted">
                <dt>INC 8%</dt>
                <dd className="tnum">${formatNumber(INC)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-2">
                <dt className="font-display text-lg font-semibold text-ink">Total</dt>
                <dd className="tnum font-display text-2xl font-semibold text-brand-700 sm:text-3xl">
                  ${formatNumber(SUBTOTAL + INC)}
                </dd>
              </div>
            </dl>

            {/* Era un `bg-brand-700` liso. Ahora tiene volumen: degradado entre
                tres pasos vecinos, filo interior claro y sombra violeta.
                Arranca en el 700 y no en el 600 por dos razones: no pierde
                contraste respecto al plano anterior (8.15:1) y así el botón de
                la maqueta no le grita más fuerte que el CTA real de la página,
                que sí abre en el 600. */}
            <div className="relative mt-5 flex h-14 items-center justify-center overflow-hidden rounded-2xl text-base font-semibold text-white shadow-[0_10px_24px_-14px_rgba(56,0,96,0.8)]">
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25"
              />
              <span className="relative">Cobrar</span>
            </div>
          </div>

          {/* Consecuencia contable de ese cobro — el argumento de venta real. */}
          <div className="relative mx-4 -mt-3 rounded-b-card border border-t-0 border-brand-100 bg-gradient-to-b from-brand-50/90 to-brand-100/90 px-5 py-4 backdrop-blur sm:mx-8">
            {/* `items-start` y no `items-center`: en móvil la frase ocupa tres
                renglones y el check centrado quedaba flotando a media altura. */}
            <p className="flex items-start gap-2 text-sm font-medium text-brand-900">
              <Check
                className="mt-0.5 size-4 shrink-0 text-brand-700"
                aria-hidden="true"
              />
              Al cobrar: baja inventario, entra a caja y postea el asiento contable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
