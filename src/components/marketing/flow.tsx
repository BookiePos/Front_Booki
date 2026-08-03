"use client";

import {
  BookOpenCheck,
  Boxes,
  HandCoins,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useScrollProgress } from "@/hooks/use-scroll-progress";
import { clamp, cn } from "@/lib/utils";

interface Step {
  icon: LucideIcon;
  time: string;
  title: string;
  body: string;
  figure: string;
  caption: string;
}

const STEPS: Step[] = [
  {
    icon: HandCoins,
    time: "12:41:03",
    title: "Cobras en la mesa",
    body: "El mesero cierra la cuenta 7 y cobra mitad Nequi, mitad efectivo.",
    figure: "$106.380",
    caption: "Mesa 7 · pago mixto",
  },
  {
    icon: Boxes,
    time: "12:41:03",
    title: "Baja el inventario",
    body: "Se descuentan los insumos de cada plato en la bodega de esa sede.",
    figure: "−14 insumos",
    caption: "Bodega Centro",
  },
  {
    icon: Wallet,
    time: "12:41:03",
    title: "Entra a caja",
    body: "El efectivo suma al turno abierto; lo de Nequi queda como pago digital.",
    figure: "+$53.190",
    caption: "Turno de Laura",
  },
  {
    icon: BookOpenCheck,
    time: "12:41:03",
    title: "Postea el asiento",
    body: "Débito a caja y bancos, crédito a ingresos e impuesto al consumo.",
    figure: "Cuadrado",
    caption: "Asiento #4.812",
  },
];

/**
 * La reacción en cadena de un cobro, encadenada al scroll.
 *
 * Es la sección que demuestra la promesa de la marca en vez de afirmarla: los
 * cuatro pasos llevan la MISMA hora (12:41:03) a propósito — no es un flujo de
 * trabajo por etapas, es una sola transacción atómica.
 *
 * Un paso nunca se oculta: los inactivos quedan atenuados pero legibles, así
 * que quien llegue con reduced-motion o sin JS lee los cuatro igual.
 */
export function Flow() {
  const { ref, progress } = useScrollProgress<HTMLElement>({
    smoothing: 0.16,
    mode: "pin",
  });

  // El primer 12% y el último 12% son aire: entrar y salir sin prisas.
  const p = clamp((progress - 0.12) / 0.76);
  const activeFloat = p * STEPS.length;

  return (
    <section
      ref={ref}
      aria-labelledby="flujo-heading"
      data-nav-dark
      className="relative h-[260vh] bg-brand-950"
    >
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden px-5 py-20 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--color-brand-600) 0%, transparent 68%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-300">
              Una sola venta
            </p>
            <h2
              id="flujo-heading"
              className="mt-4 text-balance font-display font-semibold text-white text-section"
            >
              Cobras una vez.
              <br className="hidden sm:block" /> Se mueven cuatro cosas.
            </h2>
          </div>

          {/* Riel de progreso: una sola línea que se llena de extremo a extremo */}
          <div className="relative mt-12 hidden h-1 rounded-full bg-white/10 lg:block">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-400 to-brand-300"
              style={{ width: `${p * 100}%` }}
            />
          </div>

          <ol className="mt-8 grid gap-4 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              // 0 → apagado, 1 → encendido del todo. La transición ocupa
              // el 60% inicial de la ventana de cada paso.
              const t = clamp((activeFloat - i) / 0.6);
              const Icon = step.icon;

              return (
                <li
                  key={step.title}
                  className={cn(
                    "relative rounded-card p-6 ring-1 transition-colors duration-300",
                    t > 0.5
                      ? "bg-white/10 ring-white/25"
                      : "bg-white/4 ring-white/8",
                  )}
                  style={{
                    // Nunca baja de 0.45: un paso inactivo se atenúa, no
                    // desaparece. Debe poder leerse en cualquier momento.
                    opacity: 0.45 + t * 0.55,
                    transform: `translate3d(0, ${(1 - t) * 14}px, 0)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-11 items-center justify-center rounded-xl transition-colors duration-300",
                        t > 0.5
                          ? "bg-brand-400 text-brand-950"
                          : "bg-white/10 text-brand-200",
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" strokeWidth={2} />
                    </span>
                    <span className="tnum text-xs font-medium text-brand-300">
                      {step.time}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-200">
                    {step.body}
                  </p>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p
                      className={cn(
                        "tnum font-display text-2xl font-semibold transition-colors duration-300",
                        t > 0.5 ? "text-brand-300" : "text-white/60",
                      )}
                    >
                      {step.figure}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-300">{step.caption}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-8 text-brand-200">
            Misma hora en los cuatro. No es un proceso por etapas —{" "}
            <strong className="font-semibold text-white">
              es una sola transacción
            </strong>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
