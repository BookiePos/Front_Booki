import type { GuideDescriptor } from "./types"

/**
 * Registro B de recorridos por sección (lo mantiene el Agente B).
 *
 * Módulos a cubrir: Finanzas (Caja y bancos, Gastos, Cuentas por pagar, P&L,
 * Reportes, Presupuestos, Flujo de caja), Cumplimiento (Impuestos, Facturación
 * electrónica, Resoluciones, Auditoría) y Configuración (Usuarios y roles,
 * Parámetros).
 *
 * Patrón de cada descriptor (ver `sedeGuide` en ./core.ts como ejemplo):
 *   {
 *     id: "gastos",
 *     match: /^\/panel\/finanzas\/gastos/,
 *     build: () => [
 *       { target: null, title: "…", body: "…" },              // intro centrada
 *       { target: "gastos-…", navigateTo: "/panel/finanzas/gastos",
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
 * - Poner descriptores MÁS ESPECÍFICOS primero.
 * - Sin conflictos: edita solo este archivo y las páginas de TUS módulos.
 */
export const guidesB: GuideDescriptor[] = []
