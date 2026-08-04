import type { GuideDescriptor } from "./types"

/**
 * Registro A de recorridos por sección (lo mantiene el Agente A).
 *
 * Módulos a cubrir: Operación (Caja, Inventario, Productos, Restaurante),
 * Comercial (Compras, Proveedores, Directorio de clientes, Clientes/CxC) y
 * Personal (Empleados, Nómina, Consumos/deducciones, Turnos).
 *
 * Patrón de cada descriptor (ver `sedeGuide` en ./core.ts como ejemplo):
 *   {
 *     id: "inventario",
 *     match: /^\/panel\/inventario/,
 *     build: () => [
 *       { target: null, title: "…", body: "…" },              // intro centrada
 *       { target: "inv-…", navigateTo: "/panel/inventario",   // navega + resalta
 *         title: "…", body: "…" },
 *       …2–5 pasos informativos resaltando elementos con data-tour…
 *       { target: null, title: "¡Listo!", body: "…" },        // cierre
 *     ],
 *   }
 *
 * Reglas:
 * - El primer paso con `navigateTo` lleva a la ruta del módulo.
 * - Pasos informativos (spotlight + "Siguiente"): añade `data-tour="<slug>-<algo>"`
 *   a elementos ESTABLES de la página (botón de acción, filtro, tabla, tarjeta).
 * - Poner descriptores MÁS ESPECÍFICOS primero (p. ej. clientes/directorio
 *   antes que clientes).
 * - Sin conflictos: edita solo este archivo y las páginas de TUS módulos.
 */
export const guidesA: GuideDescriptor[] = []
