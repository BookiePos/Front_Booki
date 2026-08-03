"use client";

import { useRef, useState } from "react";
import {
  Check,
  FileText,
  Receipt,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { BENEFITS } from "@/lib/site";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  receipt: Receipt,
  store: Store,
  users: Users,
  shield: ShieldCheck,
  file: FileText,
  wallet: Wallet,
};

/**
 * Beneficios como pestañas: el titular de cada uno siempre visible, el detalle
 * solo del que te interesa. Comprime seis bloques de texto en una pantalla.
 *
 * Implementa el patrón WAI-ARIA de tabs, incluida la navegación con flechas
 * (`Home`/`End` incluidos), que es lo que un lector de pantalla espera cuando
 * anuncia `role="tablist"`.
 */
export function Benefits() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + BENEFITS.length) % BENEFITS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, number | undefined> = {
      ArrowDown: active + 1,
      ArrowRight: active + 1,
      ArrowUp: active - 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: BENEFITS.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focusTab(next);
  };

  const current = BENEFITS[active];
  const CurrentIcon = ICONS[current.icon] ?? Receipt;

  return (
    <section id="beneficios" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* El encabezado usa la MISMA rejilla que el contenido de abajo: el
            título cae sobre la columna de pestañas y el apoyo sobre el panel.
            Así la alineación se lee como decisión, no como bloque suelto. */}
        <Reveal className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">
              Beneficios
            </p>
            <h2 className="mt-4 text-balance font-display font-semibold text-ink text-section">
              Un sistema, no cinco que no se hablan
            </h2>
          </div>
          <p className="max-w-xl self-end text-lg leading-relaxed text-ink-muted">
            POS por un lado, inventario en Excel, nómina en otra parte y el
            contador esperando papeles. Eso se acaba aquí.
          </p>
        </Reveal>

        <Reveal className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-8">
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Beneficios de GoCheck"
            onKeyDown={onKeyDown}
            className="flex flex-col gap-2"
          >
            {BENEFITS.map((benefit, i) => {
              const Icon = ICONS[benefit.icon] ?? Receipt;
              const selected = i === active;
              return (
                <button
                  key={benefit.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`tab-${benefit.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${benefit.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={cn(
                    "group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-[background-color,color,box-shadow] duration-200",
                    selected
                      ? "bg-gradient-to-r from-brand-700 to-brand-600 text-white shadow-[0_12px_30px_-14px_rgba(109,40,217,0.9)]"
                      : "bg-brand-50/60 text-ink hover:bg-brand-100",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                      selected
                        ? "bg-white/15 text-white"
                        : "bg-white text-brand-700 ring-1 ring-brand-100",
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{benefit.title}</span>
                    {/* Sin truncate: el claim es la frase que vende, cortarla
                        con puntos suspensivos la deja sin sentido. */}
                    <span
                      className={cn(
                        "block text-sm leading-snug transition-colors duration-200",
                        selected ? "text-brand-100" : "text-ink-muted",
                      )}
                    >
                      {benefit.claim}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`panel-${current.id}`}
            aria-labelledby={`tab-${current.id}`}
            tabIndex={0}
            className="relative flex items-center overflow-hidden rounded-card bg-brand-950 p-8 sm:p-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-45 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, var(--color-brand-500) 0%, transparent 70%)",
              }}
            />
            {/* key: remonta el bloque al cambiar de pestaña y reinicia la entrada */}
            <div key={current.id} className="relative animate-[fade-up_320ms_var(--ease-out-soft)]">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
                <CurrentIcon className="size-7" aria-hidden="true" strokeWidth={1.75} />
              </span>

              <h3 className="mt-6 font-display text-3xl font-semibold text-white sm:text-4xl">
                {current.title}
              </h3>
              <p className="mt-3 text-xl text-brand-200">{current.claim}</p>

              <ul className="mt-8 space-y-3.5">
                {current.detail.map((line) => (
                  <li key={line} className="flex gap-3 text-brand-100">
                    <Check
                      className="mt-1 size-4 shrink-0 text-brand-300"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
