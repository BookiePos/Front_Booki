"use client";

import { ChevronDown } from "lucide-react";
import { GoCheckMark } from "@/components/marketing/gocheck-logo";
import { useScrollProgress } from "@/hooks/use-scroll-progress";
import { clamp } from "@/lib/utils";

/** Normaliza `p` dentro de la ventana [start, end] a un 0→1 propio. */
function phase(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start));
}

const WORD = "GoCheck".split("");

/**
 * Cortina de entrada: es lo primero que ve el visitante. El logo se arma
 * mientras bajas y el bloque entero se va hacia atrás para dejar paso al hero.
 *
 * Dura 150vh — medio viewport de recorrido útil. Suficiente para que la marca
 * se lea, corto para no secuestrar a quien vino a mirar precios.
 *
 * Todo lo animado es transform/opacity (nunca ancho/alto) y el progreso viene
 * suavizado del hook, así que no va a tirones. Con reduced-motion queda armado.
 */
export function ScrollLogo() {
  // "pin": la sección abre la página, así que el progreso mide cuánto has
  // bajado dentro de ella. Con "through" arrancaría ya a medio armar.
  const { ref, progress: p } = useScrollProgress<HTMLElement>({
    smoothing: 0.14,
    mode: "pin",
  });

  const draw = phase(p, 0.04, 0.4);
  const markScale = 0.78 + phase(p, 0, 0.4) * 0.22;
  const markRotate = (1 - phase(p, 0, 0.4)) * -12;
  const taglineIn = phase(p, 0.46, 0.72);
  const ringScale = 0.88 + phase(p, 0, 0.6) * 0.32;

  // Salida: el bloque se aleja y se desvanece en el último tramo.
  const exit = phase(p, 0.78, 1);
  const cue = 1 - phase(p, 0.06, 0.22);

  return (
    <section
      ref={ref}
      id="marca"
      aria-labelledby="marca-heading"
      data-nav-dark
      className="relative h-[150vh] bg-brand-950"
    >
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-[clamp(20rem,52vw,44rem)] w-[clamp(20rem,52vw,44rem)] rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--color-brand-600) 0%, var(--color-brand-800) 42%, transparent 70%)",
            transform: `scale(${ringScale})`,
          }}
        />

        <div
          className="relative flex flex-col items-center text-center"
          style={{
            opacity: 1 - exit,
            transform: `translate3d(0, ${exit * -40}px, 0) scale(${1 - exit * 0.08})`,
          }}
        >
          <div
            style={{
              transform: `scale(${markScale}) rotate(${markRotate}deg)`,
              transformOrigin: "center",
            }}
          >
            <GoCheckMark
              className="h-[clamp(4rem,10vw,7rem)] w-[clamp(4rem,10vw,7rem)] drop-shadow-[0_8px_40px_rgba(139,92,246,0.6)]"
              draw={draw}
              strokeWidth={3.6}
            />
          </div>

          <h2
            id="marca-heading"
            className="mt-7 flex font-display font-semibold text-white"
            style={{ fontSize: "clamp(3rem,13vw,10rem)", lineHeight: 0.9 }}
          >
            <span className="sr-only">GoCheck</span>
            {WORD.map((letter, i) => {
              // Cada letra tiene su propia ventana, escalonada 4% entre sí.
              const start = 0.12 + i * 0.04;
              const t = phase(p, start, start + 0.22);
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className={i < 2 ? "text-white" : "text-brand-300"}
                  style={{
                    display: "inline-block",
                    opacity: t,
                    transform: `translate3d(0, ${(1 - t) * 0.38}em, 0)`,
                    letterSpacing: "-0.045em",
                  }}
                >
                  {letter}
                </span>
              );
            })}
          </h2>

          <p
            className="mt-8 font-display text-2xl font-medium text-brand-100 sm:text-4xl"
            style={{
              opacity: taglineIn,
              transform: `translate3d(0, ${(1 - taglineIn) * 16}px, 0)`,
            }}
          >
            Tú vendes. Lo demás se cuadra solo.
          </p>
        </div>

        {/* Pista de scroll: se apaga en cuanto el visitante empieza a bajar. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-10 flex flex-col items-center gap-2 text-brand-300"
          style={{ opacity: cue }}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.25em]">
            Desliza
          </span>
          <ChevronDown className="size-5 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
