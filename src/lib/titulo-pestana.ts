/**
 * Nombre de la pestaña del navegador según la página.
 *
 * Las páginas del panel y del POS son componentes de cliente y no declaran su
 * propio `metadata`, así que todas heredaban el del layout: con Inventario,
 * Caja y Nómina abiertos en tres pestañas, las tres decían "Inicio". Quien
 * trabaja con varias pestañas a la vez no las podía distinguir.
 *
 * El nombre sale del mismo menú que ve la persona, para que la pestaña diga
 * lo mismo que la opción en la que hizo clic.
 */
export interface RutaConNombre {
  href: string
  title: string
}

export const MARCA = "BookiPos"

/** La opción del menú cuya ruta es el prefijo más largo de `pathname`. */
export function nombreDeRuta(pathname: string, rutas: RutaConNombre[]): string | null {
  let mejor: RutaConNombre | null = null
  for (const r of rutas) {
    const coincide = pathname === r.href || pathname.startsWith(`${r.href}/`)
    if (coincide && (!mejor || r.href.length > mejor.href.length)) mejor = r
  }
  return mejor?.title ?? null
}

export function tituloPestana(nombre: string | null): string {
  return nombre ? `${nombre} · ${MARCA}` : MARCA
}
