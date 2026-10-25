import type { CSSProperties, ReactNode } from "react";
import { EFECTOS_DEL_COBRO, TIRILLA } from "@/lib/site";
import { cn, formatNumber } from "@/lib/utils";

const TOTAL = TIRILLA.lineas.reduce((s, l) => s + l.qty * l.unit, 0);
const EFECTIVO = TOTAL - TIRILLA.nequi;

const peso = (n: number) => `$${formatNumber(n)}`;

type Fila = (typeof EFECTOS_DEL_COBRO)[number]["fila"];

/**
 * Lo que se ve al atravesar la letra de "BookiPos": la factura de la mesa 7
 * y, saliendo de sus renglones con una raya fina, lo que ese cobro movió en
 * el sistema. Los platos mueven el inventario, el efectivo la caja y el total
 * la contabilidad: el argumento de venta entero pegado al papel, sin tarjetas.
 *
 * Es de servidor. La coreografía es CSS (`.factura` en `globals.css`) y la
 * dispara el portal al terminar de entrar (`data-gp-entered`): primero sube
 * el papel, luego los renglones en cascada y al final se dibujan las rayas.
 * Fuera del portal (sin JS o con movimiento reducido) se ve quieta y entera.
 */
export function Factura() {
  return (
    <div className="factura mx-auto grid w-full max-w-6xl gap-12 text-navy-950 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-20">
      <h2
        id="como-funciona"
        data-factura-sube
        className="max-w-[12ch] scroll-mt-24 font-titular text-[clamp(2.6rem,5.4vw,5rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance"
      >
        Tú vendes. Lo demás se cuadra solo.
      </h2>

      {/* Desde md la figura reserva a la derecha del papel (22rem) el sitio
          de las notas, que van en absoluto: sin esto se salían del contenedor
          y abrían scroll horizontal. */}
      <figure className="w-full max-w-[22rem] md:w-[39.5rem] md:max-w-none">
        <figcaption className="sr-only">
          Factura de ejemplo de {TIRILLA.negocio}, {TIRILLA.mesa}: total {peso(TOTAL)}, pagado{" "}
          {peso(TIRILLA.nequi)} por Nequi y {peso(EFECTIVO)} en efectivo. Al cobrar, el sistema
          descontó el inventario, sumó el efectivo al turno e hizo el asiento contable.
        </figcaption>

        <div
          aria-hidden="true"
          data-factura-papel
          className="w-full rounded-[4px] bg-white px-6 pt-7 pb-6 text-[0.9375rem] leading-[1.6] shadow-[0_1px_2px_rgb(26_22_38/0.08),0_24px_48px_-16px_rgb(26_22_38/0.35)] md:w-[22rem]"
        >
          <Renglon i={0}>
            <p className="font-titular text-base font-semibold tracking-[-0.01em]">{TIRILLA.negocio}</p>
            <p className="text-[0.8125rem] text-navy-950/55">
              {TIRILLA.mesa} · {TIRILLA.consecutivo} · {TIRILLA.fecha}
            </p>
          </Renglon>

          <Separador />

          {TIRILLA.lineas.map((l, i) => (
            <Renglon key={l.name} i={i + 1} nota={i === 0 ? "platos" : undefined}>
              <span className="truncate">
                <span className="tnum mr-2 text-navy-950/55">{l.qty}</span>
                {l.name}
              </span>
              <span className="tnum">{peso(l.qty * l.unit)}</span>
            </Renglon>
          ))}

          <Separador />

          <Renglon i={4} nota="total" className="items-baseline">
            <span className="font-semibold">Total</span>
            <span className="tnum font-titular text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">
              {peso(TOTAL)}
            </span>
          </Renglon>
          <Renglon i={5} className="mt-2 text-navy-950/60">
            <span>Nequi</span>
            <span className="tnum">{peso(TIRILLA.nequi)}</span>
          </Renglon>
          <Renglon i={6} nota="efectivo" className="text-navy-950/60">
            <span>Efectivo</span>
            <span className="tnum">{peso(EFECTIVO)}</span>
          </Renglon>
        </div>

        {/* En celular no hay sitio a la derecha del papel: las notas van debajo,
            cada una con su punto. */}
        <dl aria-hidden="true" className="mt-8 space-y-4 md:hidden">
          {EFECTOS_DEL_COBRO.map((e, i) => (
            <div key={e.fila} data-factura-nota style={{ "--i": i } as CSSProperties} className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 bg-navy-950" />
              <div>
                <dt className="text-[0.8125rem] font-medium text-navy-950/65">{e.area}</dt>
                <dd className="font-titular text-lg leading-snug font-medium tracking-[-0.01em]">{e.texto}</dd>
              </div>
            </div>
          ))}
        </dl>
      </figure>
    </div>
  );
}

/** Un renglón de la factura. Si lleva `nota`, de él sale la raya a su efecto. */
function Renglon({
  i,
  nota,
  className,
  children,
}: {
  i: number;
  nota?: Fila;
  className?: string;
  children: ReactNode;
}) {
  const efecto = nota ? EFECTOS_DEL_COBRO.find((e) => e.fila === nota) : undefined;
  const orden = efecto ? EFECTOS_DEL_COBRO.indexOf(efecto) : 0;
  return (
    <div
      data-factura-renglon
      style={{ "--i": i } as CSSProperties}
      className={cn("relative", i > 0 && "flex justify-between gap-4", className)}
    >
      {children}
      {efecto && (
        // La raya nace a 0.75rem del importe, cruza el borde del papel (que
        // tiene 1.5rem de relleno) y termina en la nota, fuera de él.
        <span
          data-factura-nota
          style={{ "--i": orden } as CSSProperties}
          className="absolute top-1/2 left-[calc(100%+0.75rem)] hidden -translate-y-1/2 items-center md:flex"
        >
          <span data-factura-raya className="relative h-px w-16 origin-left bg-navy-950">
            <span className="absolute top-1/2 -left-[3px] size-1.5 -translate-y-1/2 bg-navy-950" />
          </span>
          <span data-factura-texto className="ml-4 block w-max">
            <span className="block text-[0.8125rem] leading-tight font-medium text-navy-950/65">{efecto.area}</span>
            <span className="block font-titular text-lg leading-snug font-medium tracking-[-0.01em] text-navy-950">
              {efecto.texto}
            </span>
          </span>
        </span>
      )}
    </div>
  );
}

function Separador() {
  return <div className="my-4 h-px bg-navy-950/10" />;
}
