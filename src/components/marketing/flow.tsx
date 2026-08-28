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

/** Ver `benefits.tsx`: rompe el banding del degradado violeta grande. */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * La reacción en cadena de un cobro, encadenada al scroll.
 *
 * Es la sección que demuestra la promesa de la marca en vez de afirmarla: los
 * cuatro pasos llevan la MISMA hora (12:41:03) a propósito — no es un flujo de
 * trabajo por etapas, es una sola transacción atómica.
 *
 * Un paso nunca se oculta: los inactivos quedan atenuados pero legibles, así
 * que quien llegue con reduced-motion o sin JS lee los cuatro igual.
 *
 * El fijado al scroll es **solo de escritorio**. En móvil las cuatro tarjetas
 * apiladas miden mucho más que una pantalla, así que meterlas en un `h-svh`
 * con `overflow-hidden` recortaba los dos últimos pasos: no había forma de
 * leerlos. Abajo de `lg` la sección es un bloque normal con los cuatro pasos
 * encendidos. Misma información, sin recorte.
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
      className="relative bg-brand-950 lg:h-[260vh] lg:motion-reduce:h-auto"
    >
      {/* El aire vertical se recorta en `lg` y solo vuelve a abrirse en `xl`:
          en un portátil de 720px de alto, con `py-20` fijo, la fila de pasos
          no cabía dentro del `h-svh` y se comía el borde inferior de las
          tarjetas contra el `overflow-hidden`. */}
      <div className="relative flex flex-col justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20 lg:sticky lg:top-0 lg:h-svh lg:py-14 lg:motion-reduce:static lg:motion-reduce:h-auto xl:py-20">
        {/* Lienzo: tinta de marca arriba, marino del logo abajo. Antes era un
            `bg-brand-950` liso de 260vh. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(172deg, var(--color-brand-950) 0%, var(--color-brand-950) 28%, var(--color-navy-950) 100%)",
          }}
        />
        {/* Halo tope 24%: por encima de ahí el texto de los pasos atenuados
            baja de 4.5:1 sobre el fondo aclarado. Está medido, no tanteado. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.24] blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--color-brand-600) 0%, transparent 68%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(100% 70% at 50% 45%, transparent 40%, rgba(0, 8, 28, 0.55) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRANO, backgroundSize: "160px 160px" }}
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

          {/* Riel de progreso: una sola línea que se llena de extremo a extremo.
              Se llena con `scaleX` y no con `width` — width relayoutea el riel
              en cada frame de scroll; scaleX se compone en GPU. */}
          <div className="relative mt-10 hidden h-1 overflow-hidden rounded-full bg-white/10 lg:block xl:mt-12">
            <div
              className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 will-change-transform"
              style={{ transform: `scaleX(${p.toFixed(4)})` }}
            />
          </div>

          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              // 0 → apagado, 1 → encendido del todo. La transición ocupa
              // el 60% inicial de la ventana de cada paso.
              const t = clamp((activeFloat - i) / 0.6);
              const on = t > 0.5;
              const Icon = step.icon;

              return (
                <li
                  key={step.title}
                  style={
                    {
                      // Suelo de 0.72, no 0.45. A 0.45 el cuerpo del paso
                      // atenuado se quedaba en 3.05:1 sobre el fondo: por
                      // debajo de AA. A 0.72 son 4.7:1 y se sigue leyendo
                      // como "apagado".
                      "--step-op": (0.72 + t * 0.28).toFixed(3),
                      "--step-y": `${((1 - t) * 14).toFixed(1)}px`,
                    } as React.CSSProperties
                  }
                  className={cn(
                    "relative rounded-card p-5 ring-1 ring-inset transition-colors duration-300 sm:p-6 lg:p-5 xl:p-6",
                    // Estado base = encendido. Es lo que ve el móvil, y también
                    // quien pide movimiento reducido (el hook devuelve 1 fijo).
                    "bg-gradient-to-b from-white/12 to-white/6 ring-white/25 shadow-[0_20px_40px_-32px_rgba(0,0,0,0.9)]",
                    // El encadenado al scroll solo existe de lg hacia arriba.
                    "lg:[opacity:var(--step-op)] lg:[transform:translate3d(0,var(--step-y),0)]",
                    !on && "lg:bg-none lg:bg-white/5 lg:ring-white/12 lg:shadow-none",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors duration-300",
                        "bg-gradient-to-b from-brand-300 to-brand-400 text-brand-950 ring-white/30",
                        !on &&
                          "lg:bg-none lg:bg-white/10 lg:text-brand-200 lg:ring-white/15",
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" strokeWidth={2} />
                    </span>
                    <span className="tnum text-xs font-medium text-brand-200">
                      {step.time}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-200">
                    {step.body}
                  </p>

                  <div className="mt-5 border-t border-white/15 pt-4">
                    <p
                      className={cn(
                        "tnum font-display text-2xl font-semibold transition-colors duration-300",
                        // El tono más saturado del bloque se reserva a la cifra:
                        // es el único dato que hay que poder leer de un vistazo.
                        "text-brand-300",
                        !on && "lg:text-white/70",
                      )}
                    >
                      {step.figure}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-200">{step.caption}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-6 text-brand-200 xl:mt-8">
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
