"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlyphPortal from "@/components/ui/glyph-portal";
import { fuenteMarca } from "@/components/marketing/fuentes-portada";
import { CTA_REGISTRO } from "@/lib/site";

const PALABRA = "BookiPos";

/**
 * Primera pantalla: "BookiPos" gigante en la letra del wordmark. Al cargar,
 * el orquídea llena las letras de abajo arriba (`.portal-llena`); al bajar,
 * la cámara entra por una letra y el orquídea ocupa la pantalla. Adentro está
 * lo que se pasa como `children` (la factura).
 *
 * El titular y los botones van en una capa aparte, encima del portal y fuera
 * de él: así existen desde el HTML del servidor (el portal monta después, ver
 * abajo) y no se repiten al montarlo. Se desvanecen en cuanto la cámara
 * arranca.
 *
 * El portal mide la tinta de cada letra en un canvas al montarse, así que
 * necesita la fuente YA cargada: si no, mide con la de respaldo y la letra se
 * corre bajo la cámara cuando llega la buena. Por eso espera a
 * `document.fonts.load`. Mientras tanto se pinta la pantalla vacía (el
 * relleno de las letras es la entrada) y la factura quieta debajo, para que
 * esté en el HTML.
 */
export function Portada({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState(false);
  const frenteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        await document.fonts.load(`700 100px ${fuenteMarca.style.fontFamily}`, PALABRA);
      } catch {
        // Sin la fuente, el portal usa la de respaldo y queda estático: se
        // sigue viendo la palabra y la factura, solo sin el viaje.
      }
      if (vivo) setLista(true);
    };
    void cargar();
    return () => {
      vivo = false;
    };
  }, []);

  // El portal mide más que el marcador (su recorrido de cámara) y fija su
  // alto en su primer cuadro: todo lo que va debajo se corre. La línea de
  // tiempo calculó sus puntos de anclaje con el alto viejo, así que se le pide
  // a ScrollTrigger que los vuelva a medir cuando el portal ya se asentó.
  useEffect(() => {
    if (!lista) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    return () => cancelAnimationFrame(raf);
  }, [lista]);

  // Directo al estilo y no por estado de React: corre en cada cuadro de scroll.
  const desvanecer = (p: number) => {
    const frente = frenteRef.current;
    if (frente) frente.style.opacity = String(Math.max(0, 1 - p / 0.1));
  };

  return (
    <div className="relative">
      <div ref={frenteRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 h-svh">
        <div className="mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-[max(2rem,7svh)] sm:px-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h1
              className="hero-rise max-w-[24ch] font-titular text-[clamp(1.4rem,2.3vw,2.1rem)] leading-[1.15] font-medium tracking-[-0.025em] text-balance text-navy-950"
              style={{ "--i": 4 } as CSSProperties}
            >
              El punto de venta que cuadra la caja, el inventario y la contabilidad mientras cobras.
            </h1>
            <div
              className="hero-rise pointer-events-auto flex shrink-0 flex-wrap gap-3 text-[0.9375rem] font-semibold"
              style={{ "--i": 5 } as CSSProperties}
            >
              <Link
                href={CTA_REGISTRO.href}
                className="inline-flex h-12 items-center rounded-md bg-navy-950 px-6 text-white transition-colors duration-150 hover:bg-brand-700"
              >
                {CTA_REGISTRO.label}
              </Link>
              <a
                href="#precios"
                className="inline-flex h-12 items-center rounded-md px-5 text-navy-950 ring-1 ring-navy-950/25 transition-colors duration-150 ring-inset hover:bg-white/70"
              >
                Ver precios
              </a>
            </div>
          </div>
        </div>
      </div>

      {lista ? (
        <GlyphPortal
          word={PALABRA}
          fontFamily={fuenteMarca.style.fontFamily}
          fontWeight={700}
          interactive={false}
          scrollLength={2.2}
          className="portal-dia"
          onProgress={desvanecer}
          style={{
            "--gp-paper": "var(--color-mesa)",
            "--gp-ink": "var(--color-navy-950)",
            "--gp-field": "var(--color-brand-500)",
            "--gp-foreground": "var(--color-navy-950)",
          }}
          background={<div className="portal-llena absolute inset-0 bg-brand-500" />}
        >
          {children}
        </GlyphPortal>
      ) : (
        <>
          <div aria-hidden="true" className="h-svh bg-mesa" />
          <div className="bg-brand-500 px-[clamp(32px,7vw,100px)] py-24">{children}</div>
        </>
      )}
    </div>
  );
}
