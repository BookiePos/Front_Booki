"use client";

import { useEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlyphPortal from "@/components/ui/glyph-portal";
import { fuenteMarca } from "@/components/marketing/fuente-tirilla";

const PALABRA = "BookiPos";

/**
 * Paso del hero a la línea del día: "BookiPos" gigante en la letra del
 * wordmark, recortando el orquídea; al bajar, la cámara entra por la letra y
 * el orquídea llena la pantalla, que es justo el fondo de la línea del día.
 *
 * El portal mide la tinta de cada letra en un canvas al montarse, así que
 * necesita la fuente YA cargada: si no, mide con la de respaldo y la letra se
 * corre bajo la cámara cuando llega la buena. Por eso espera a
 * `document.fonts.load` y, mientras tanto, pinta la misma palabra quieta en
 * su sitio (mismo alto, mismo fondo) para que no haya salto.
 */
export function EntradaAlDia() {
  const [lista, setLista] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      const familia = fuenteMarca.style.fontFamily;
      try {
        await document.fonts.load(`700 100px ${familia}`, PALABRA);
      } catch {
        // Sin la fuente, el portal usa la de respaldo y queda estático: se
        // sigue viendo la palabra y el contenido, solo sin el viaje.
      }
      if (vivo) setLista(true);
    };
    void cargar();
    return () => {
      vivo = false;
    };
  }, []);

  // El portal mide más que el marcador (su recorrido de cámara) y fija su
  // alto en su primer cuadro: todo lo que va debajo se corre. La línea del
  // día calculó sus puntos de anclaje con el alto viejo, así que se le pide a
  // ScrollTrigger que los vuelva a medir cuando el portal ya se asentó.
  useEffect(() => {
    if (!lista) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    return () => cancelAnimationFrame(raf);
  }, [lista]);

  if (!lista) {
    return (
      // Mismo encuadre que el primer cuadro del portal: la tinta ocupa el 84%
      // del ancho o el 38% del alto, centrada al 46% de la pantalla.
      <div aria-hidden="true" className="flex h-svh items-center justify-center bg-mesa pb-[8svh]">
        <span
          className={`${fuenteMarca.className} text-[min(19.5vw,52svh)] leading-none text-brand-500`}
        >
          {PALABRA}
        </span>
      </div>
    );
  }

  return (
    <GlyphPortal
      word={PALABRA}
      fontFamily={fuenteMarca.style.fontFamily}
      fontWeight={700}
      interactive={false}
      scrollLength={2.2}
      enterLabel="Ver qué cambia"
      className="portal-dia"
      style={{
        "--gp-paper": "var(--color-mesa)",
        "--gp-ink": "var(--color-navy-950)",
        "--gp-field": "var(--color-brand-500)",
        "--gp-foreground": "var(--color-navy-950)",
      }}
      background={<div className="absolute inset-0 bg-brand-500" />}
    >
      {/* El título de la línea de tiempo vive aquí, en el orquídea que deja
          el portal: es lo primero que se lee al salir de la letra. */}
      <h2
        id="que-cambia"
        className="max-w-[15ch] font-mono text-[clamp(2.4rem,6vw,5.5rem)] leading-[0.98] font-extrabold tracking-[-0.055em] uppercase"
      >
        Lo que duele con otros sistemas.
      </h2>
    </GlyphPortal>
  );
}
