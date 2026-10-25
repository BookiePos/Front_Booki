import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Pantallas de la app, dibujadas en código para la línea de tiempo.
 *
 * No son capturas: una captura se ve borrosa a otro tamaño y se recorta mal
 * según el ancho. Estas escalan con unidades de contenedor (`cqw`), así que el
 * texto queda nítido igual en la pista de escritorio que en el celular.
 *
 * Cada una muestra UNA cosa, la que resuelve el dolor de su hito, con dos o
 * tres renglones como mucho: la versión anterior traía cinco filas por
 * pantalla y la línea se leía como una hoja de cálculo. Los rótulos son los de
 * las pantallas reales y las cifras cuadran con la factura de la portada.
 */

const peso = (n: number) => `$${new Intl.NumberFormat("es-CO").format(n)}`;

function Pantalla({
  titulo,
  estado,
  children,
}: {
  titulo: string;
  estado?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="@container overflow-hidden rounded-[5px] bg-white text-navy-950 shadow-[0_1px_2px_rgb(26_22_38/0.06),0_16px_36px_-14px_rgb(26_22_38/0.28)] ring-1 ring-navy-950/10"
    >
      <div className="flex items-center justify-between gap-[2cqw] border-b border-navy-950/12 bg-[#f7f5fb] px-[4cqw] py-[2.2cqw] text-[3.8cqw] leading-none font-semibold">
        <span className="truncate">{titulo}</span>
        {estado}
      </div>
      <div className="px-[4cqw] py-[3.4cqw] text-[4.2cqw] leading-[1.35]">{children}</div>
    </div>
  );
}

function Fila({ izq, der, className }: { izq: ReactNode; der: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-[3cqw]", className)}>
      <span className="min-w-0 truncate">{izq}</span>
      <span className="tnum shrink-0">{der}</span>
    </div>
  );
}

function Etiqueta({ children, tono = "neutro" }: { children: ReactNode; tono?: "neutro" | "ok" | "aviso" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[2px] px-[1.8cqw] py-[1cqw] text-[3.3cqw] leading-none font-semibold",
        tono === "ok" && "bg-positive/12 text-positive",
        tono === "aviso" && "bg-amber-100 text-amber-900",
        tono === "neutro" && "bg-navy-950/8 text-navy-950/70",
      )}
    >
      {children}
    </span>
  );
}

function Boton({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[2px] bg-brand-700 px-[3.4cqw] py-[1.8cqw] text-[3.6cqw] leading-none font-semibold text-white">
      {children}
    </span>
  );
}

export function PantallaFactura() {
  return (
    <Pantalla titulo="Factura por revisar" estado={<Etiqueta tono="aviso">Desde foto</Etiqueta>}>
      <div className="space-y-[1.4cqw]">
        <Fila izq={<span className="font-semibold">Papa pastusa · 2 bultos</span>} der={peso(96_000)} />
        <Fila izq={<span className="font-semibold">Arroz · 1 arroba</span>} der={peso(62_500)} />
      </div>
      <div className="mt-[3cqw] flex justify-end">
        <Boton>Aprobar e ingresar</Boton>
      </div>
    </Pantalla>
  );
}

export function PantallaCobro() {
  return (
    <Pantalla titulo="Mesa 7 › Cobrado" estado={<Etiqueta tono="ok">Asiento #4.812</Etiqueta>}>
      <Fila
        izq={<span className="text-navy-950/60">Nequi + efectivo</span>}
        der={<span className="text-[8cqw] leading-none font-bold tracking-tight">{peso(128_000)}</span>}
      />
      <p className="mt-[2.4cqw] text-[3.6cqw] text-navy-950/60">Inventario: −2 bandejas, −1 ajiaco</p>
    </Pantalla>
  );
}

export function PantallaSinInternet() {
  return (
    <Pantalla titulo="Punto de venta" estado={<Etiqueta tono="aviso">Sin conexión</Etiqueta>}>
      <Fila
        izq="Ventas guardadas en el equipo"
        der={<span className="text-[8cqw] leading-none font-bold tracking-tight">3</span>}
      />
      <p className="mt-[2.4cqw] text-[3.6cqw] text-navy-950/60">Se envían solas cuando vuelve la red</p>
    </Pantalla>
  );
}

export function PantallaCierre() {
  return (
    <Pantalla titulo="Cierre · Turno de Laura" estado={<Etiqueta tono="ok">Cuadrada</Etiqueta>}>
      <Fila
        izq="Diferencia"
        der={<span className="text-[8cqw] leading-none font-bold tracking-tight text-positive">{peso(0)}</span>}
      />
      <p className="mt-[2.4cqw] text-[3.6cqw] text-navy-950/60">Contado por denominación, 10:40 p. m.</p>
    </Pantalla>
  );
}

export function PantallaNomina() {
  return (
    <Pantalla titulo="Colilla de octubre" estado={<Etiqueta>Laura M.</Etiqueta>}>
      <Fila izq="Consumo en el local" der={`−${peso(34_000)}`} />
      <Fila
        izq={<span className="font-semibold">Neto a pagar</span>}
        der={<span className="font-semibold">{peso(1_633_040)}</span>}
        className="mt-[1.4cqw] border-t border-navy-950/12 pt-[1.4cqw]"
      />
    </Pantalla>
  );
}
