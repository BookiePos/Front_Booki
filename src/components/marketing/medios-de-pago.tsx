import { MEDIOS_DE_PAGO } from "@/lib/site";

/**
 * Franja "cobra como te paguen", entre la línea del día y los precios. Es la
 * única marquesina de la página: una lista de cosas que no piden atención una
 * por una, que es justo para lo que sirve el formato.
 *
 * La pista repite la lista dos veces (la segunda, oculta al lector de
 * pantalla) para que el bucle no tenga salto. Con movimiento reducido queda
 * quieta y se lee la primera copia.
 */
export function MediosDePago() {
  return (
    <section
      aria-labelledby="pagos-heading"
      className="marquesina overflow-hidden border-y border-navy-950/15 bg-mesa py-6"
    >
      <h2 id="pagos-heading" className="sr-only">
        Medios de pago que recibe la caja
      </h2>
      <div className="marquesina-pista flex w-max">
        {[0, 1].map((copia) => (
          <ul
            key={copia}
            aria-hidden={copia === 1 || undefined}
            className="flex shrink-0 items-center font-titular text-2xl font-semibold tracking-[-0.03em] text-navy-950 sm:text-3xl"
          >
            {MEDIOS_DE_PAGO.map((medio) => (
              <li key={medio} className="flex items-center whitespace-nowrap">
                {medio}
                <span aria-hidden="true" className="mx-8 size-2 bg-brand-500 sm:mx-10" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
