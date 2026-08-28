import type { GuideDescriptor, TourStep } from "./types"

/**
 * Recorridos base:
 * - `buildProductSteps`: tour general de bienvenida (no ligado a una ruta; lo
 *   dispara la bienvenida / botón "Guía" en el dashboard).
 * - `sedeGuide`: recorrido interactivo para editar una sede. Sirve de ejemplo
 *   del patrón que siguen los demás recorridos por sección.
 */

/**
 * Tour general de bienvenida: un recorrido completo por todo BookiPos, área por
 * área, que además deja al usuario en cada módulo para que lo vea. Se adapta al
 * giro (retail/restaurante) y oculta las áreas para las que el usuario no tiene
 * permiso. Los pasos con `navigateTo` llevan a cada módulo; los anclados
 * resaltan elementos del tablero y la barra superior.
 *
 * @param isRetail  true = comercio/retail; false = restaurante.
 * @param can       comprobación de permiso (hasPermission). Si no se pasa, se
 *                  incluyen todas las áreas.
 */
export function buildProductSteps(
  isRetail: boolean,
  can?: (perm: string) => boolean,
): TourStep[] {
  const allow = (perm?: string) => !perm || !can || can(perm)
  const steps: TourStep[] = []

  steps.push({
    target: null,
    title: "Bienvenido a BookiPos",
    body: "Te hago un recorrido completo por tu ERP: cómo está organizado y por dónde empezar. Puedes omitirlo cuando quieras y reabrirlo desde el botón “Guía”.",
  })
  steps.push({
    target: "menu",
    navigateTo: "/panel",
    title: "Todo se organiza por áreas",
    body: "En el menú lateral tienes Operación (sedes, inventario, productos, caja), Comercial (compras, proveedores, clientes), Personal (empleados y nómina), Finanzas, Cumplimiento y Configuración.",
  })
  steps.push({
    target: "buscar",
    title: "Búsqueda rápida",
    body: "Encuentra productos, facturas o clientes al instante, desde cualquier pantalla.",
  })

  // ── El recorrido del arranque, módulo por módulo ────────────────────────────
  steps.push({
    target: null,
    navigateTo: "/panel/sedes",
    title: "Empieza por tu sede",
    body: "Cada local es una “sede”: defines su nombre, dirección y datos fiscales. Ventas, caja e inventario se organizan por sede.",
  })

  if (allow("inventory.view")) {
    steps.push({
      target: null,
      navigateTo: "/panel/inventario",
      title: isRetail ? "Carga tu inventario" : "Inventario e insumos",
      body: isRetail
        ? "Da de alta tus productos con su código de barras, controla existencias por sede y recibe mercancía. Las salidas descuentan primero los lotes próximos a vencer (FEFO)."
        : "Registra tus insumos y controla existencias por sede, con lotes y vencimientos (FEFO) y el kardex completo de movimientos.",
    })
    if (!isRetail) {
      steps.push({
        target: null,
        navigateTo: "/panel/productos",
        title: "Arma tu menú",
        body: "Los productos vendibles son recetas de tus insumos: al vender un plato, el sistema descuenta cada ingrediente del inventario.",
      })
    }
  }

  if (allow("pos.sell")) {
    steps.push({
      target: "nueva-venta",
      navigateTo: "/panel",
      title: isRetail ? "Vende y factura" : "Abre el punto de venta",
      body: isRetail
        ? "Abre la caja del turno y cobra escaneando productos; el POS descuenta el stock y deja la venta lista para facturar."
        : "Abre la caja del turno y toma pedidos por mesa; el POS descuenta el stock, aplica el INC y la propina, y deja la venta lista para facturar.",
    })
    steps.push({
      target: null,
      navigateTo: "/panel/caja",
      title: "Controla el efectivo",
      body: "Aquí ves, sede por sede, cómo va la caja del día: aperturas, ventas, efectivo esperado y la diferencia al cerrar el arqueo.",
    })
  }

  if (allow("finance.view")) {
    steps.push({
      target: null,
      navigateTo: "/panel/finanzas/pl",
      title: "Tus finanzas",
      body: "Gastos, cuentas por pagar y por cobrar, bancos, estado de resultados (P&L) y flujo de caja: la salud del negocio, alimentada por tus ventas y compras.",
    })
  }

  if (allow("employees.view")) {
    steps.push({
      target: null,
      navigateTo: "/panel/empleados",
      title: "Tu equipo y la nómina",
      body: "Lleva el expediente de cada empleado y calcula la nómina conforme a la normativa colombiana 2026, con sus deducciones, aportes y provisiones.",
    })
  }

  if (allow("tax.manage")) {
    steps.push({
      target: null,
      navigateTo: "/panel/impuestos",
      title: "Cumplimiento",
      body: "Configura impuestos con vigencias por fecha, emite factura electrónica ante la DIAN y consulta la auditoría de todo lo que ocurre en el sistema.",
    })
  }

  if (allow("params.manage")) {
    steps.push({
      target: null,
      navigateTo: "/panel/config/parametros",
      title: "Ajusta las reglas del negocio",
      body: "En Parámetros defines tarifas, recargos, tolerancias y topes —versionados por fecha—; en Usuarios y roles das acceso a tu equipo con permisos a la medida.",
    })
  }

  // ── Cierre: primeros pasos y cómo repetir las guías ─────────────────────────
  steps.push({
    target: "checklist",
    navigateTo: "/panel",
    title: "Tus primeros pasos",
    body: "Esta lista te deja el negocio listo para vender. Hazla a tu ritmo; algunos pasos se marcan solos cuando cargas datos reales.",
  })
  steps.push({
    target: "guia",
    title: "Cada módulo tiene su propia guía",
    body: "La primera vez que entres a un módulo, su guía se abre sola. ¿Quieres verla otra vez? Pulsa “Guía” y te muestro esa pantalla paso a paso.",
  })
  steps.push({
    target: null,
    title: "¡Listo para empezar!",
    body: "Ese es BookiPos de punta a punta. Empieza por personalizar tu sede y cargar tus productos; el resto fluye solo.",
  })

  return steps
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
