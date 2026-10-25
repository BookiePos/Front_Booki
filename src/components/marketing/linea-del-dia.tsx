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
 * Qué cambia: lo que duele con otros sistemas, tachado, y cómo lo resuelve
 * BookiPos, con su pantalla. Es la pista horizontal de `ui/timeline`.
 *
 * Va sobre el orquídea plano del doblez del isotipo, el mismo color en el que
 * termina el portal de la letra, que es también donde vive su título
 * (`#que-cambia`): se entra por la letra y se cae aquí sin corte.
 */
export function LineaDelDia() {
  return (
    <Timeline
      className="bg-brand-500 text-navy-950"
      labelledBy="que-cambia"
      items={DOLORES.map((d) => ({ ...d, media: PANTALLAS[d.id] }))}
    />
  );
}
