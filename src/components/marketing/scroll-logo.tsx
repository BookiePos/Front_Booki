"use client";

import { ChevronDown } from "lucide-react";
import { BookiPosMark } from "@/components/marketing/bookipos-logo";
import { useScrollProgress } from "@/hooks/use-scroll-progress";
import { clamp } from "@/lib/utils";

/** Normaliza `p` dentro de la ventana [start, end] a un 0→1 propio. */
function phase(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start));
}

const WORD = "BookiPos".split("");

/**
 * Cortina de entrada: es lo primero que ve el visitante. El logo se arma
 * mientras bajas y el bloque entero se va hacia atrás para dejar paso al hero.
 *
 * Mide 130vh, de los cuales 100vh son la cortina en sí (el sticky ocupa la
 * pantalla completa, así que siempre cuesta un viewport sacarla de encima) y
 * solo 30vh son recorrido con pin — el tramo en el que scrollear no avanza la
 * página y por tanto el único que se siente lento. Antes ese tramo era de 50vh.
 *
 * Todo lo animado es transform/opacity (nunca ancho/alto) y el progreso viene
 * suavizado del hook, así que no va a tirones. Con reduced-motion queda armado.
 */
export function ScrollLogo() {
  // "pin": la sección abre la página, así que el progreso mide cuánto has
  // bajado dentro de ella. Con "through" arrancaría ya a medio armar.
  //
  // Con solo 30vh de recorrido cada muesca de rueda avanza más progreso, así
  // que el suavizado importa: 0.22 va pegado al dedo (constante de tiempo de
  // ~67 ms) pero sigue repartiendo el salto de la rueda entre varios frames.
  const { ref, progress: p } = useScrollProgress<HTMLElement>({
    smoothing: 0.22,
    mode: "pin",
  });

  // Ventanas comprimidas: el isotipo se traza y endereza en el primer tercio,
  // las letras caen encima y el lockup queda legible a media sección.
  const draw = phase(p, 0.02, 0.28);
  const markScale = 0.78 + phase(p, 0, 0.3) * 0.22;
  const markRotate = (1 - phase(p, 0, 0.3)) * -12;
  const taglineIn = phase(p, 0.38, 0.56);
  const ringScale = 0.88 + phase(p, 0, 0.5) * 0.32;

  // Salida: el bloque se aleja y se desvanece en el último tercio. Se le deja
  // la ventana más ancha de todas (0.68→1) porque es el relevo hacia el hero:
  // comprimirla más sí se vería como un corte.
  const exit = phase(p, 0.68, 1);
  const cue = 1 - phase(p, 0.03, 0.16);

  return (
    <section
      ref={ref}
      id="marca"
      aria-labelledby="marca-heading"
      data-nav-dark
      className="relative h-[130vh] bg-brand-950"
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
            <BookiPosMark
              className="h-[clamp(4rem,10vw,7rem)] w-[clamp(4rem,10vw,7rem)] drop-shadow-[0_8px_40px_rgba(139,92,246,0.6)]"
              draw={draw}
              tone="light"
            />
          </div>

          <h2
            id="marca-heading"
            className="mt-7 flex font-display font-semibold text-white"
            style={{ fontSize: "clamp(3rem,13vw,10rem)", lineHeight: 0.9 }}
          >
            <span className="sr-only">BookiPos</span>
            {WORD.map((letter, i) => {
              // Cada letra tiene su propia ventana, escalonada 3% entre sí.
              // La cascada completa cabe en 0.10→0.47 del recorrido: se sigue
              // leyendo como cascada, pero dura la mitad que antes.
              const start = 0.1 + i * 0.03;
              const t = phase(p, start, start + 0.16);
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
