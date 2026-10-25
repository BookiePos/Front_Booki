import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Pantallas de la app, dibujadas en código para la línea del día.
 *
 * No son capturas: una captura se ve borrosa a otro tamaño y se recorta mal
 * según el ancho. Estas escalan con unidades de contenedor (`cqw`), así que el
 * texto queda nítido igual en la pista de escritorio que en el celular. Los
 * rótulos son los de las pantallas reales (Compras → Factura por revisar,
 * Abrir turno, Cobro, Cierre de caja…) y las cifras de cada una cuadran entre
 * sí. El restaurante es de ejemplo.
 *
 * Esquinas casi rectas y sombra dura: sobre el plano orquídea de la sección,
 * una sombra difusa se vería sucia y un radio grande, de plantilla.
 */

const peso = (n: number) => `$${new Intl.NumberFormat("es-CO").format(n)}`;

function Pantalla({
  titulo,
  estado,
  children,
  className,
}: {
  titulo: string;
  estado?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "@container overflow-hidden rounded-[3px] bg-white text-navy-950 shadow-[5px_5px_0_var(--color-navy-950)] ring-[1.5px] ring-navy-950",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-[2cqw] border-b border-navy-950/12 bg-[#f6f6f8] px-[3.5cqw] py-[1.8cqw] text-[3.4cqw] leading-none font-semibold">
        <span className="truncate">{titulo}</span>
        {estado}
      </div>
      <div className="px-[3.5cqw] py-[2.6cqw] text-[3.6cqw] leading-[1.35]">{children}</div>
    </div>
  );
}

function Fila({
  izq,
  der,
  className,
}: {
  izq: ReactNode;
  der: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-[3cqw]", className)}>
      <span className="min-w-0 truncate">{izq}</span>
      <span className="tnum shrink-0">{der}</span>
    </div>
  );
}

function Boton({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[2px] bg-brand-700 px-[3cqw] py-[1.6cqw] text-[3.3cqw] leading-none font-semibold text-white">
      {children}
    </span>
  );
}

function Etiqueta({ children, tono = "neutro" }: { children: ReactNode; tono?: "neutro" | "ok" | "aviso" }) {
  return (
    <span
      className={cn(
        "rounded-[2px] px-[1.6cqw] py-[0.8cqw] text-[2.9cqw] leading-none font-semibold",
        tono === "ok" && "bg-positive/12 text-positive",
        tono === "aviso" && "bg-amber-100 text-amber-900",
        tono === "neutro" && "bg-navy-950/8 text-navy-950/70",
      )}
    >
      {children}
    </span>
  );
}

const FACTURA = [
  { item: "Papa pastusa", cant: "2 bultos", valor: 96_000 },
  { item: "Arroz", cant: "1 arroba", valor: 62_500 },
  { item: "Aceite", cant: "18 L", valor: 121_000 },
];

export function PantallaFactura() {
  return (
    <Pantalla titulo="Compras › Factura por revisar" estado={<Etiqueta tono="aviso">Por aprobar</Etiqueta>}>
      <div className="flex gap-[3.5cqw]">
        {/* La foto de la factura: papel torcido con renglones. */}
        <div className="w-[22cqw] shrink-0 -rotate-3 bg-[#eceef2] p-[1.6cqw] ring-1 ring-navy-950/15">
          <div className="h-[1.4cqw] w-3/4 bg-navy-950/60" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mt-[1.4cqw] flex justify-between gap-[1cqw]">
              <div className="h-[0.9cqw] w-1/2 bg-navy-950/25" />
              <div className="h-[0.9cqw] w-1/4 bg-navy-950/25" />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-[1.4cqw]">
          {FACTURA.map((f) => (
            <Fila
              key={f.item}
              izq={
                <>
                  <span className="font-semibold">{f.item}</span>{" "}
                  <span className="text-navy-950/55">{f.cant}</span>
                </>
              }
              der={peso(f.valor)}
            />
          ))}
          <div className="flex justify-end pt-[0.6cqw]">
            <Boton>Aprobar e ingresar</Boton>
          </div>
        </div>
      </div>
    </Pantalla>
  );
}

export function PantallaApertura() {
  return (
    <Pantalla titulo="Caja 1 › Abrir turno" estado={<Etiqueta>Sede Centro</Etiqueta>}>
      <div className="grid grid-cols-2 gap-[3cqw]">
        <div>
          <p className="text-[3cqw] text-navy-950/55">Cajera</p>
          <p className="mt-[0.8cqw] border-b border-navy-950/20 pb-[1cqw] font-semibold">Laura Montoya</p>
        </div>
        <div>
          <p className="text-[3cqw] text-navy-950/55">Base en efectivo</p>
          <p className="tnum mt-[0.8cqw] border-b border-navy-950/20 pb-[1cqw] font-semibold">{peso(200_000)}</p>
        </div>
      </div>
      <div className="mt-[3.4cqw] flex items-center justify-between">
        <span className="text-[3cqw] text-navy-950/55">11:30 a. m.</span>
        <Boton>Abrir caja</Boton>
      </div>
    </Pantalla>
  );
}

export function PantallaCobro() {
  return (
    <Pantalla titulo="Mesa 7 › Cobro" estado={<Etiqueta>4 personas</Etiqueta>}>
      <div className="flex items-end justify-between gap-[3cqw]">
        <div className="min-w-0 flex-1 space-y-[1cqw]">
          <Fila izq="Nequi" der={peso(80_000)} />
          <Fila izq="Efectivo" der={peso(48_000)} />
          <Fila izq={<span className="text-navy-950/55">Recibe {peso(50_000)}</span>} der={<span className="text-navy-950/55">Devuelta {peso(2_000)}</span>} />
        </div>
      </div>
      <div className="mt-[2.4cqw] flex items-center justify-between border-t border-navy-950/12 pt-[2.2cqw]">
        <span className="tnum text-[7cqw] leading-none font-bold tracking-tight">{peso(128_000)}</span>
        <Boton>Cobrar</Boton>
      </div>
    </Pantalla>
  );
}

export function PantallaSinInternet() {
  return (
    <Pantalla
      titulo="Punto de venta"
      estado={<Etiqueta tono="aviso">Sin conexión · 3 en cola</Etiqueta>}
    >
      <div className="space-y-[1.2cqw] font-mono text-[3.3cqw]">
        {["FVC-001291", "FVC-001292", "FVC-001293"].map((c, i) => (
          <Fila key={c} izq={c} der={<span className="text-navy-950/55">{peso([34_000, 18_500, 52_000][i])} · en cola</span>} />
        ))}
      </div>
      <p className="mt-[2.2cqw] text-[3cqw] text-navy-950/60">
        Solo efectivo hasta que vuelva la red. Luego se envían solas.
      </p>
    </Pantalla>
  );
}

export function PantallaDomicilio() {
  return (
    <Pantalla titulo="Domicilios › D-218" estado={<Etiqueta tono="ok">En camino</Etiqueta>}>
      <div className="space-y-[1.2cqw]">
        <Fila izq={<span className="font-semibold">Zona Laureles</span>} der={`Domicilio ${peso(6_000)}`} />
        <Fila izq="Repartidor" der="Andrés G." />
        <Fila izq="Salió" der="7:34 p. m." />
      </div>
      <div className="mt-[2.4cqw] flex gap-[1.4cqw]">
        {["Recibido", "En cocina", "En camino", "Entregado"].map((paso, i) => (
          <div key={paso} className="flex-1">
            <div className={cn("h-[1.2cqw]", i <= 2 ? "bg-brand-700" : "bg-navy-950/12")} />
            <p className="mt-[0.8cqw] truncate text-[2.7cqw] text-navy-950/60">{paso}</p>
          </div>
        ))}
      </div>
    </Pantalla>
  );
}

export function PantallaCierre() {
  return (
    <Pantalla titulo="Cierre de caja › Turno de Laura" estado={<Etiqueta tono="ok">Cuadrada</Etiqueta>}>
      <div className="space-y-[1.2cqw]">
        <Fila izq="Esperado en efectivo" der={peso(1_248_000)} />
        <Fila izq="Contado por denominación" der={peso(1_248_000)} />
        <Fila
          izq={<span className="font-semibold">Diferencia</span>}
          der={<span className="font-semibold text-positive">{peso(0)}</span>}
          className="border-t border-navy-950/12 pt-[1.2cqw]"
        />
      </div>
      <p className="mt-[2cqw] text-[3cqw] text-navy-950/60">10:40 p. m. · 86 ventas · 3 pagos digitales por conciliar</p>
    </Pantalla>
  );
}

export function PantallaNomina() {
  return (
    <Pantalla titulo="Nómina › Colilla de octubre" estado={<Etiqueta>Laura Montoya</Etiqueta>}>
      <div className="space-y-[1.2cqw]">
        <Fila izq="Salario y recargos" der={peso(1_812_000)} />
        <Fila izq="Consumo en el local" der={`−${peso(34_000)}`} />
        <Fila izq="Salud y pensión" der={`−${peso(144_960)}`} />
        <Fila
          izq={<span className="font-semibold">Neto a pagar</span>}
          der={<span className="font-semibold">{peso(1_633_040)}</span>}
          className="border-t border-navy-950/12 pt-[1.2cqw]"
        />
      </div>
    </Pantalla>
  );
}

const MENU = [
  { name: "Bandeja paisa", price: 38_000 },
  { name: "Ajiaco", price: 28_000 },
  { name: "Churrasco", price: 46_000 },
  { name: "Sancocho", price: 26_000 },
  { name: "Limonada de coco", price: 12_000 },
  { name: "Jugo de lulo", price: 9_000 },
];

const CUENTA = [
  { qty: 2, name: "Bandeja paisa", total: 76_000 },
  { qty: 1, name: "Ajiaco", total: 28_000 },
  { qty: 2, name: "Limonada de coco", total: 24_000 },
];

/** El punto de venta entero, en grande: abre la pista. */
export function PantallaPos() {
  return (
    <Pantalla titulo="Restaurante El Fogón › Punto de venta" estado={<Etiqueta>Mesa 7</Etiqueta>}>
      <div className="grid grid-cols-[1.35fr_1fr] gap-[3cqw]">
        <div className="grid grid-cols-2 gap-[1.6cqw]">
          {MENU.map((m) => (
            <div key={m.name} className="bg-[#f2f2f5] px-[2cqw] py-[2cqw] ring-1 ring-navy-950/10">
              <p className="truncate text-[3.1cqw] font-semibold">{m.name}</p>
              <p className="tnum mt-[0.6cqw] text-[2.9cqw] text-navy-950/60">{peso(m.price)}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col border-l border-navy-950/12 pl-[3cqw]">
          <p className="text-[3cqw] font-semibold text-navy-950/55">Cuenta</p>
          <div className="mt-[1.2cqw] space-y-[1cqw] text-[3cqw]">
            {CUENTA.map((l) => (
              <Fila key={l.name} izq={`${l.qty} ${l.name}`} der={peso(l.total)} />
            ))}
          </div>
          <div className="mt-auto pt-[2cqw]">
            <Fila
              izq={<span className="font-semibold">Total</span>}
              der={<span className="text-[4.6cqw] font-bold">{peso(128_000)}</span>}
            />
            <div className="mt-[1.6cqw] bg-brand-700 py-[1.8cqw] text-center text-[3.3cqw] font-semibold text-white">
              Cobrar
            </div>
          </div>
        </div>
      </div>
    </Pantalla>
  );
}
