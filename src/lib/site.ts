/**
 * Contenido de la web madre. Vive aparte de los componentes para que cambiar
 * un precio o una viñeta no obligue a tocar JSX.
 *
 * Regla de estilo: título de 2–4 palabras, `claim` de una línea que quepa sin
 * partirse, y el detalle en viñetas cortas que solo aparece al interactuar.
 * Si una viñeta necesita coma y "además", está mal escrita.
 *
 * Las capacidades listadas se corresponden con módulos que ya existen en el
 * backend (RBAC, nómina, ledger, CxC, caja, inventario multi-sede).
 */

/**
 * Rutas internas de las otras dos zonas. Ya no son URLs absolutas a otro
 * puerto: las tres viven en la misma app, así que estos enlaces navegan del
 * lado del cliente, sin recargar ni volver a autenticar.
 */
export const APPS = {
  erp: "/panel",
  pos: "/pos",
};

export const NAV_LINKS = [
  { href: "#beneficios", label: "Beneficios" },
  { href: "#modulos", label: "Módulos" },
  { href: "#novedades", label: "Novedades" },
  { href: "#precios", label: "Precios" },
  { href: "#preguntas", label: "Preguntas" },
];

export interface Benefit {
  id: string;
  icon: string;
  title: string;
  claim: string;
  detail: string[];
}

export const BENEFITS: Benefit[] = [
  {
    id: "contabilidad",
    icon: "receipt",
    title: "Contabilidad sin digitar",
    claim: "Cobras y el asiento contable ya está hecho.",
    detail: [
      "Ventas, gastos, compras y pagos postean solos",
      "Libro mayor inmutable: no se edita, se corrige con contrapartida",
      "Tu contador entra a revisar, no a transcribir",
    ],
  },
  {
    id: "sedes",
    icon: "store",
    title: "Todas tus sedes, un número",
    claim: "Deja de sumar Excel los lunes.",
    detail: [
      "Inventario, caja y reportes por sede",
      "Traslados entre bodegas con trazabilidad",
      "Consolidado del grupo en la misma pantalla",
    ],
  },
  {
    id: "nomina",
    icon: "users",
    title: "La nómina se arma sola",
    claim: "Lo que consume el equipo baja del pago.",
    detail: [
      "Asistencia, novedades, liquidación y PILA",
      "Consumo de empleado descontado automáticamente",
      "Se acabó la libreta detrás de la caja",
    ],
  },
  {
    id: "permisos",
    icon: "shield",
    title: "Nadie ve lo que no debe",
    claim: "Más de 30 permisos, uno por acción.",
    detail: [
      "Quién autoriza descuentos y quién anula ventas",
      "El cajero no ve la nómina ni los márgenes",
      "Cada acción sensible queda firmada y con hora",
    ],
  },
  {
    id: "dian",
    icon: "file",
    title: "DIAN sin sustos",
    claim: "Factura electrónica con tu resolución.",
    detail: [
      "IVA e INC según el régimen del negocio",
      "Numeración y resolución controladas desde el panel",
      "Rastro completo de cada documento emitido",
    ],
  },
  {
    id: "caja",
    icon: "wallet",
    title: "La caja cuadra o suena",
    claim: "El descuadre aparece con nombre y hora.",
    detail: [
      "Conteo por denominación al cerrar",
      "Sangrías y movimientos registrados en el momento",
      "Te enteras al cerrar turno, no al mes siguiente",
    ],
  },
];

export interface ModuleTab {
  id: string;
  name: string;
  tag: string;
  claim: string;
  points: string[];
  href: string;
  /** Filas del mock de pantalla que acompaña a cada módulo. */
  screen: { label: string; value: string; accent?: boolean }[];
}

export const MODULES: ModuleTab[] = [
  {
    id: "pos",
    name: "BookiPos POS",
    tag: "Para la barra y la mesa",
    claim: "Cobrar toma dos toques. Nada más.",
    points: [
      "Mesas, comandas y división de cuenta",
      "Propina y pago mixto",
      "Nequi, Daviplata, tarjeta y efectivo",
      "Devoluciones con autorización",
    ],
    href: APPS.pos,
    screen: [
      { label: "Mesa 7 · 4 personas", value: "Abierta" },
      { label: "Bandeja paisa ×2", value: "$76.000" },
      { label: "Limonada de coco", value: "$12.000" },
      { label: "Total con INC", value: "$106.380", accent: true },
    ],
  },
  {
    id: "erp",
    name: "BookiPos Operación",
    tag: "Para la oficina",
    claim: "El negocio entero en una pantalla.",
    points: [
      "Inventario, compras y proveedores",
      "Clientes, cartera y cuentas por cobrar",
      "Nómina, asistencia y PILA",
      "Contabilidad y reportes por sede",
    ],
    href: APPS.erp,
    screen: [
      { label: "Venta del día · 3 sedes", value: "$4.812.400", accent: true },
      { label: "Margen bruto", value: "62,4%" },
      { label: "Cartera vencida", value: "$318.000" },
      { label: "Asientos posteados", value: "147" },
    ],
  },
];

export const WHATS_NEW = [
  {
    date: "Ago 2026",
    tag: "Nuevo",
    title: "Permisos granulares por módulo",
    body: "RRHH, nómina, asistencia y facturación con permisos propios.",
  },
  {
    date: "Ago 2026",
    tag: "Nuevo",
    title: "Consumo de empleado a nómina",
    body: "Lo que consume el equipo baja solo en la liquidación.",
  },
  {
    date: "Jul 2026",
    tag: "Mejora",
    title: "Cartera con cliente real",
    body: "Se acabó el fiado anónimo que nadie sabe cobrar.",
  },
  {
    date: "Jul 2026",
    tag: "Mejora",
    title: "Posteo contable automático",
    body: "Ventas, gastos y compras generan su asiento sin intervención.",
  },
];

export interface Plan {
  id: string;
  name: string;
  price: number | null;
  /** Precio anual (número). El mensual vive en `price`. */
  priceAnnual?: number;
  priceLabel?: string;
  cadence: string;
  pitch: string;
  featured: boolean;
  cta: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "punto",
    name: "Punto",
    price: 49_900,
    priceAnnual: 499_000,
    cadence: "/mes",
    pitch: "Tienda, cafetería, panadería, peluquería. Un local, sin contador de planta.",
    featured: false,
    cta: "Empezar con Punto",
    features: [
      "POS con cajas ilimitadas",
      "Inventario y control de stock",
      "Caja: apertura, arqueo y cierre",
      "Clientes y reportes de venta",
      "Factura y POS electrónico DIAN",
      "1 sede · 3 usuarios",
      "400 documentos electrónicos",
      "Soporte por chat y centro de ayuda",
    ],
  },
  {
    id: "negocio",
    name: "Negocio",
    price: 119_900,
    priceAnnual: 1_199_000,
    cadence: "/mes",
    pitch: "Restaurante, minimercado, ferretería. Compra a proveedores y maneja mermas.",
    featured: true,
    cta: "Empezar con Negocio",
    features: [
      "Todo lo de Punto, más:",
      "Restaurante: mesas, comandas, propinas",
      "Lotes, vencimientos y trazabilidad",
      "Compras, órdenes y proveedores",
      "Gastos y flujo de caja",
      "1 sede · usuarios ilimitados",
      "2.000 documentos electrónicos",
      "Capacitación de arranque + soporte en horario comercial",
    ],
  },
  {
    id: "control",
    name: "Control",
    price: 229_900,
    priceAnnual: 2_299_000,
    cadence: "/mes",
    pitch: "Pyme formal con contador. Necesita estados financieros, no solo reportes de venta.",
    featured: false,
    cta: "Empezar con Control",
    features: [
      "Todo lo de Negocio, más:",
      "Contabilidad de partida doble",
      "Estados financieros y balance de prueba",
      "Impuestos con versiones por vigencia",
      "Cuentas por pagar y por cobrar",
      "Presupuestos, tesorería y auditoría",
      "Nómina hasta 10 empleados",
      "1 sede · 5.000 documentos",
      "Soporte prioritario + capacitación trimestral",
    ],
  },
  {
    id: "cadena",
    name: "Cadena",
    price: 449_900,
    priceAnnual: 4_499_000,
    cadence: "/mes",
    pitch: "Dos o más locales con inventario y caja consolidados.",
    featured: false,
    cta: "Empezar con Cadena",
    features: [
      "Todo lo de Control, más:",
      "Hasta 3 sedes con consolidado",
      "Traslados de stock entre sedes",
      "Permisos y roles por sede",
      "Nómina hasta 25 empleados",
      "12.000 documentos electrónicos",
      "Sede adicional: $89.900",
      "Gerente de cuenta + soporte extendido",
    ],
  },
];

/** Fila de la tabla comparativa de planes. */
export interface PlanComparisonRow {
  feature: string;
  punto: string;
  negocio: string;
  control: string;
  cadena: string;
}

export const PLAN_COMPARISON: PlanComparisonRow[] = [
  { feature: "POS y cajas ilimitadas", punto: "Sí", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Facturación y POS electrónico DIAN", punto: "Sí", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Inventario y arqueo de caja", punto: "Sí", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Mesas, comandas y propinas", punto: "—", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Lotes, vencimientos y trazabilidad", punto: "—", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Compras, órdenes y proveedores", punto: "—", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Contabilidad y estados financieros", punto: "—", negocio: "—", control: "Sí", cadena: "Sí" },
  { feature: "CxP, CxC, presupuestos y tesorería", punto: "—", negocio: "—", control: "Sí", cadena: "Sí" },
  { feature: "Nómina colombiana", punto: "Complemento", negocio: "Complemento", control: "10 empleados", cadena: "25 empleados" },
  { feature: "Multi-sede y traslados", punto: "—", negocio: "—", control: "—", cadena: "3 sedes" },
  { feature: "Auditoría y permisos por rol", punto: "—", negocio: "Básico", control: "Sí", cadena: "Por sede" },
  { feature: "Documentos electrónicos / mes", punto: "400", negocio: "2.000", control: "5.000", cadena: "12.000" },
];

/** Complemento (add-on) contratable sobre cualquier plan. */
export interface AddOn {
  name: string;
  /** Precio en pesos. 0 cuando es sin costo (usa `priceLabel`). */
  price: number;
  priceLabel?: string;
  unit: string;
  note: string;
}

export const ADD_ONS: AddOn[] = [
  {
    name: "Nómina hasta 10 empleados",
    price: 34_900,
    unit: "/mes",
    note: "Incluida en Control y Cadena. Alegra cobra $29.900 aquí, pero salta a $69.000 en el empleado 11.",
  },
  {
    name: "Empleado adicional",
    price: 2_900,
    unit: "/mes",
    note: "Con 15 empleados quedas en $49.400 contra $69.000 de Alegra.",
  },
  {
    name: "Sede adicional",
    price: 89_900,
    unit: "/mes",
    note: "Sobre Cadena, sin límite de sedes.",
  },
  {
    name: "Paquete de 1.000 documentos",
    price: 29_900,
    unit: "único",
    note: "No expira; se consume solo al pasar el cupo del plan.",
  },
  {
    name: "Migración desde Siigo, Alegra o Excel",
    price: 0,
    priceLabel: "Sin costo",
    unit: "",
    note: "El importador CSV de catálogo y existencias ya está construido.",
  },
  {
    name: "Capacitación adicional en sitio",
    price: 180_000,
    unit: "por sesión",
    note: "Solo Bogotá.",
  },
];

export const FAQS = [
  {
    q: "¿Sirve para restaurante y para tienda?",
    a: "Sí. Nació en restaurante — mesas, comandas, propina, división de cuenta — y el mismo motor cubre retail con código de barras, variantes e inventario por bodega. Activas el modo que necesites por sede.",
  },
  {
    q: "¿Funciona sin internet?",
    a: "Hoy no, y no queremos prometerlo. BookiPos es web y requiere conexión; el modo offline está en la hoja de ruta. Si tu local tiene internet inestable, hablemos antes de que compres.",
  },
  {
    q: "¿La factura es válida ante la DIAN?",
    a: "Sí, con tu resolución y numeración cargadas en el panel. Calculamos IVA e INC según el régimen del negocio y guardamos el rastro de cada documento.",
  },
  {
    q: "¿Puedo migrar de mi sistema actual?",
    a: "Sí, y sin costo. Nuestro importador CSV carga catálogo, existencias, clientes y saldos desde Siigo, Alegra o Excel.",
  },
  {
    q: "¿Qué pasa con mis datos si me voy?",
    a: "Son tuyos. Exportas productos, ventas, clientes y movimientos contables en CSV cuando quieras, sin pedir permiso ni pagar por el export.",
  },
  {
    q: "¿El precio es por sede o por empresa?",
    a: "Por empresa. Punto, Negocio y Control cubren una sede; Cadena incluye hasta tres. ¿Necesitas más? Cada sede adicional cuesta $89.900 al mes.",
  },
];
