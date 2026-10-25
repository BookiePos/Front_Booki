import type { ReactNode } from "react";
import Timeline from "@/components/ui/timeline";
import {
  PantallaCierre,
  PantallaCobro,
  PantallaFactura,
  PantallaNomina,
  PantallaSinInternet,
} from "@/components/marketing/pantallas";
import { DOLORES } from "@/lib/site";

const PANTALLAS: Record<string, ReactNode> = {
  factura: <PantallaFactura />,
  cobro: <PantallaCobro />,
  "sin-internet": <PantallaSinInternet />,
  cierre: <PantallaCierre />,
  nomina: <PantallaNomina />,
};

/**
 * Lo que duele con otros sistemas, tachado, y cómo lo resuelve BookiPos, con
 * su pantalla. Es la pista horizontal de `ui/timeline`, sobre el lila de la
 * portada: sale del orquídea de la factura y vuelve al papel claro.
 */
export function LineaDelDia() {
  return (
    <Timeline
      className="bg-mesa text-navy-950"
      labelledBy="dolores"
      title={
        <h2
          id="dolores"
          className="font-titular text-[clamp(2rem,3.4vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.04em] text-balance"
        >
          Lo que duele con otros sistemas.
        </h2>
      }
      items={DOLORES.map((d) => ({ ...d, media: PANTALLAS[d.id] }))}
    />
  );
}
