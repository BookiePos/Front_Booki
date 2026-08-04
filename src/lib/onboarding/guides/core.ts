import type { GuideDescriptor, TourStep } from "./types"

/**
 * Recorridos base:
 * - `buildProductSteps`: tour general de bienvenida (no ligado a una ruta; lo
 *   dispara la bienvenida / botón "Guía" en el dashboard).
 * - `sedeGuide`: recorrido interactivo para editar una sede. Sirve de ejemplo
 *   del patrón que siguen los demás recorridos por sección.
 */

export function buildProductSteps(isRetail: boolean): TourStep[] {
  return [
    {
      target: null,
      title: "Te muestro lo esencial",
      body: "Un recorrido rápido por lo que más vas a usar. Puedes omitirlo en cualquier momento.",
    },
    {
      target: "menu",
      title: "El menú lateral",
      body: "Desde aquí llegas a todos los módulos: sedes, inventario, productos, finanzas y más.",
    },
    {
      target: "buscar",
      title: "Búsqueda rápida",
      body: "Encuentra productos, facturas o clientes al instante.",
    },
    {
      target: "nueva-venta",
      title: isRetail ? "Vende y escanea" : "Abre el punto de venta",
      body: isRetail
        ? "Abre el POS para escanear, cobrar y facturar."
        : "Abre el POS para tomar pedidos, cobrar y facturar.",
    },
    {
      target: "checklist",
      title: "Tus primeros pasos",
      body: "Sigue esta lista para dejar tu negocio listo para vender.",
    },
    {
      target: "guia",
      title: "¿Necesitas verlo de nuevo?",
      body: "Reabre esta guía cuando quieras desde este botón.",
    },
  ]
}

/** ¿Estamos en la página de detalle de una sede? (/panel/sedes/<id>) */
function isSedeDetail(pathname: string): boolean {
  return /^\/panel\/sedes\/[^/]+$/.test(pathname)
}

/** ¿El formulario de edición de la sede está abierto? */
function isSedeSheetOpen(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector('[data-tour="sede-nombre"]') != null
  )
}

export const sedeGuide: GuideDescriptor = {
  id: "sede",
  match: /^\/panel\/sedes/,
  build: () => [
    {
      target: null,
      title: "Personalicemos tu sede",
      body: "Te llevo paso a paso para editar tu sede: nombre, dirección y datos de facturación. Empecemos.",
    },
    {
      target: "sede-card",
      navigateTo: "/panel/sedes",
      interactive: true,
      title: "Abre tu sede",
      body: "Haz clic en la tarjeta de tu sede para ver su detalle. Si aún no tienes una, créala con “Nueva sede”.",
      advanceWhen: ({ pathname }) => isSedeDetail(pathname),
    },
    {
      target: "sede-editar",
      interactive: true,
      title: "Entra a editar",
      body: "Pulsa “Editar” para abrir el formulario con todos los datos de la sede.",
      advanceWhen: () => isSedeSheetOpen(),
    },
    {
      target: "sede-nombre",
      title: "El nombre de la sede",
      body: "Así identificas este local en todo el sistema y en el punto de venta. Ajústalo si quieres.",
    },
    {
      target: "sede-direccion",
      title: "La dirección",
      body: "Con la dirección (y la ciudad, en Facturación electrónica) ubicamos tu sede en el mapa. Escríbela lo más completa posible.",
    },
    {
      target: "sede-guardar",
      interactive: true,
      title: "Guarda los cambios",
      body: "Cuando termines de editar, pulsa “Guardar cambios” para aplicar todo.",
      advanceWhen: () => !isSedeSheetOpen(),
    },
    {
      target: null,
      title: "¡Sede personalizada!",
      body: "Eso es todo. Puedes volver a editarla cuando quieras desde Operación → Sedes.",
    },
  ],
}
