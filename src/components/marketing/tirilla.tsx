import { EFECTOS_DEL_COBRO, TIRILLA } from "@/lib/site";
import { cn, formatNumber } from "@/lib/utils";

const TOTAL = TIRILLA.lineas.reduce((s, l) => s + l.qty * l.unit, 0);
const EFECTIVO = TOTAL - TIRILLA.nequi;

const peso = (n: number) => `$${formatNumber(n)}`;

/**
 * La tirilla del hero: el papel que imprime el POS al cobrar la mesa 7, con
 * lo que ese cobro movió en el sistema impreso al pie, y un sello de tinta
 * orquídea encima que dice CUADRADO.
 *
 * Es el isotipo hecho objeto (un recibo) y es el argumento de venta entero sin
 * una sola tarjeta flotante: lo que pasa en inventario, caja y contabilidad va
 * en el mismo papel, como renglones.
 *
 * En escritorio el papel nace cortado por el borde superior de la pantalla,
 * como si saliera de una impresora que no se ve. Todo es CSS (`.tirilla-sale`,
 * `.sello`): sin JavaScript, y con movimiento reducido aparece quieto.
 */
export function Tirilla({ className }: { className?: string }) {
  return (
    // `overflow-hidden` es la ranura: el papel baja desde el borde de su propia
    // caja. Sin él, en celular y tableta (tirilla debajo del lema) el papel
    // arrancaba encima del titular y lo tapaba mientras se imprimía. El
    // `pr-2.5` deja ver la sombra de 10px que va a la derecha del papel.
    <figure className={cn("relative overflow-hidden pr-2.5", className)}>
      <figcaption className="sr-only">
        Tirilla de ejemplo de {TIRILLA.negocio}, {TIRILLA.mesa}: total {peso(TOTAL)},
        pagado {peso(TIRILLA.nequi)} por Nequi y {peso(EFECTIVO)} en efectivo. Al
        cobrar, el sistema descontó el inventario, sumó el efectivo al turno e hizo
        el asiento contable.
      </figcaption>

      <div
        aria-hidden="true"
        className="tirilla-sale borde-rasgado bg-white px-7 pt-10 pb-12 font-mono text-[0.9375rem] leading-[1.75] text-navy-950 shadow-[10px_0_0_rgba(0,8,28,0.07)] lg:pt-36"
      >
        <p className="text-center font-extrabold tracking-[0.2em]">{TIRILLA.negocio}</p>
        <p className="text-center text-navy-950/55">
          {TIRILLA.mesa} · {TIRILLA.consecutivo}
        </p>
        <p className="text-center text-navy-950/55">{TIRILLA.fecha}</p>

        <Raya />

        {TIRILLA.lineas.map((l) => (
          <p key={l.name} className="flex justify-between gap-4">
            <span className="truncate">
              {l.qty} {l.name}
            </span>
            <span>{peso(l.qty * l.unit)}</span>
          </p>
        ))}

        <Raya />

        <p className="flex items-baseline justify-between text-2xl font-extrabold tracking-tight">
          <span>TOTAL</span>
          <span>{peso(TOTAL)}</span>
        </p>
        <p className="flex justify-between text-navy-950/55">
          <span>Nequi</span>
          <span>{peso(TIRILLA.nequi)}</span>
        </p>
        <p className="flex justify-between text-navy-950/55">
          <span>Efectivo</span>
          <span>{peso(EFECTIVO)}</span>
        </p>

        <Raya />

        <dl className="text-navy-950/70">
          {EFECTOS_DEL_COBRO.map((e) => (
            <div key={e.area} className="flex gap-3">
              <dt className="w-[6.5rem] shrink-0">{e.area}</dt>
              <dd>{e.texto}</dd>
            </div>
          ))}
        </dl>

        {/* El sello: tinta orquídea con `multiply`, para que el papel y el
            texto se vean a través como en un sello de verdad. */}
        <div className="sello pointer-events-none mx-auto mt-10 w-fit border-[5px] border-brand-500 px-5 py-2 text-center text-brand-500 mix-blend-multiply">
          <p className="text-4xl font-extrabold tracking-[0.06em]">CUADRADO</p>
          <p className="text-xs font-bold tracking-[0.14em]">CIERRE DE CAJA</p>
        </div>
      </div>
    </figure>
  );
}

function Raya() {
  return <div className="my-4 border-t-2 border-dashed border-navy-950/25" />;
}
