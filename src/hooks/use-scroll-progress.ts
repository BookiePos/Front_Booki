"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clamp } from "@/lib/utils";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Preferencia de movimiento reducido del sistema, como store externo.
 *
 * `useSyncExternalStore` es lo correcto aquí y no `useEffect`: evita el render
 * en cascada y da un snapshot de servidor (`false`) que no rompe la hidratación
 * de la página estática.
 */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Progreso 0→1 del recorrido de un elemento por el viewport, **suavizado**.
 *
 * 0 = el elemento acaba de entrar por abajo; 1 = acaba de salir por arriba.
 *
 * El valor crudo del scroll es escalonado: salta tanto como saltó la rueda del
 * ratón, y una animación atada a él se ve a tirones. Aquí el scroll solo mueve
 * un objetivo, y un bucle de rAF persigue ese objetivo con interpolación
 * exponencial independiente del framerate. El resultado se desliza en vez de
 * saltar, y sigue siendo reversible al subir.
 *
 * El bucle se detiene solo al alcanzar el objetivo (<0.001 de diferencia), así
 * que no quema CPU cuando la página está quieta.
 *
 * Con `prefers-reduced-motion` devuelve 1 fijo y no engancha nada.
 */
export function useScrollProgress<T extends HTMLElement>({
  /** 0→1. Más alto, más pegado al scroll; más bajo, más deslizante. */
  smoothing = 0.12,
  /**
   * `"through"` — el elemento cruza el viewport de abajo a arriba. Sirve para
   * secciones que llegan desde abajo mientras bajas.
   *
   * `"pin"` — el elemento ya empieza en el tope y tiene contenido sticky
   * dentro. El progreso mide cuánto has bajado *dentro* de él. Es el modo
   * obligatorio para una sección que abre la página: con `"through"`, a
   * scroll 0 ya arrancaría a mitad de la animación, porque el elemento cuenta
   * como "medio recorrido" desde el instante en que es visible.
   */
  mode = "through",
}: { smoothing?: number; mode?: "through" | "pin" } = {}) {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    // Con movimiento reducido no se engancha nada: sin listeners, sin rAF.
    if (reduced) return;

    let frame = 0;
    let current = -1;
    let target = 0;
    let lastTime = performance.now();

    const readTarget = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      if (mode === "pin") {
        // Recorrido útil = lo que sobra de la sección por debajo del viewport.
        const travel = rect.height - window.innerHeight;
        target = travel <= 0 ? 1 : clamp(-rect.top / travel);
        return;
      }

      // Distancia recorrida desde que el borde superior entra por abajo.
      const total = rect.height + window.innerHeight;
      target = clamp((window.innerHeight - rect.top) / total);
    };

    const tick = (now: number) => {
      const dt = Math.min(now - lastTime, 64); // un salto de pestaña no dispara el lerp
      lastTime = now;

      // Lerp exponencial: mismo resultado a 60Hz que a 144Hz.
      const alpha = 1 - Math.pow(1 - smoothing, dt / 16.67);
      current = current < 0 ? target : current + (target - current) * alpha;

      setProgress(current);

      if (Math.abs(target - current) > 0.001) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        current = target;
      }
    };

    const start = () => {
      readTarget();
      if (frame) return;
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    };

    start();
    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("resize", start, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", start);
      window.removeEventListener("resize", start);
    };
  }, [reduced, smoothing, mode]);

  // Con movimiento reducido todo queda en su estado final, legible y quieto.
  return { ref, progress: reduced ? 1 : progress };
}

/**
 * `true` mientras *cualquier* sección marcada con `data-nav-dark` cubra la
 * franja del nav.
 *
 * Sirve para que la barra se pinte en claro sobre fondos oscuros: sin esto, el
 * logo y los enlaces quedan en tinta casi negra sobre violeta 950 y no se leen.
 *
 * Se consulta el DOM por atributo en vez de por una lista de ids en el hook:
 * añadir una sección oscura nueva solo exige ponerle `data-nav-dark`, sin
 * volver a tocar este archivo ni el nav.
 */
export function useOverDarkSection(navHeight = 72) {
  const [over, setOver] = useState(true);

  useEffect(() => {
    let frame = 0;

    const check = () => {
      frame = 0;
      const zones = document.querySelectorAll<HTMLElement>("[data-nav-dark]");
      for (const zone of zones) {
        const rect = zone.getBoundingClientRect();
        if (rect.top <= navHeight && rect.bottom > navHeight) {
          setOver(true);
          return;
        }
      }
      setOver(false);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [navHeight]);

  return over;
}

/** `true` en cuanto la página se desplaza más de `offset` píxeles. */
export function useScrolledPast(offset = 24) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setPast(window.scrollY > offset);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [offset]);

  return past;
}
