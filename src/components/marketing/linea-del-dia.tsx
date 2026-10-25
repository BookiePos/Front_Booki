import type { ReactNode } from "react";
import Timeline from "@/components/ui/timeline";
import {
  PantallaApertura,
  PantallaCierre,
  PantallaCobro,
  PantallaDomicilio,
  PantallaFactura,
  PantallaNomina,
  PantallaPos,
  PantallaSinInternet,
} from "@/components/marketing/pantallas";
import { UN_DIA } from "@/lib/site";

const PANTALLAS: Record<string, ReactNode> = {
  factura: <PantallaFactura />,
  apertura: <PantallaApertura />,
  cobro: <PantallaCobro />,
  "sin-internet": <PantallaSinInternet />,
  domicilio: <PantallaDomicilio />,
  cierre: <PantallaCierre />,
  nomina: <PantallaNomina />,
};

/**
 * Cómo funciona, contado como un día de trabajo en un restaurante: la pista
 * horizontal de `ui/timeline` con una pantalla de la app en cada hito.
 *
 * Va sobre el orquídea plano del doblez del isotipo, el mismo color en el que
 * termina el portal de la letra: se entra a la "o" de BookiPos y se cae aquí
 * sin corte.
 */
export function LineaDelDia() {
  return (
    <Timeline
      className="bg-brand-500 text-navy-950"
      title={
        <h2
          id="un-dia"
          className="scroll-mt-0 font-mono text-[clamp(2.25rem,3.6vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.05em] uppercase"
        >
          Un día en El Fogón
        </h2>
      }
      periodLabel="De la primera factura al cierre del mes"
      lead={<PantallaPos />}
      items={UN_DIA.map((d) => ({ ...d, media: PANTALLAS[d.id] }))}
    />
  );
}
