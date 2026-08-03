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
    name: "GoCheck POS",
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
    name: "GoCheck Operación",
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
    price: 150_000,
    cadence: "/ mes + IVA",
    pitch: "Un local que necesita vender y cuadrar caja.",
    featured: false,
    cta: "Empezar con Punto",
    features: [
      "1 sede · hasta 3 usuarios",
      "POS táctil, mesas y comandas",
      "Caja, arqueo y sangrías",
      "Inventario y productos",
      "Factura electrónica DIAN",
      "Soporte por WhatsApp",
    ],
  },
  {
    id: "operacion",
    name: "Operación",
    price: 450_000,
    cadence: "/ mes + IVA",
    pitch: "Varias sedes, con nómina y contabilidad adentro.",
    featured: true,
    cta: "Empezar con Operación",
    features: [
      "Hasta 5 sedes · usuarios ilimitados",
      "Todo lo de Punto, más:",
      "Contabilidad y libro mayor automático",
      "Nómina, asistencia y PILA",
      "Clientes, cartera y CxC",
      "Compras, proveedores y traslados",
      "Permisos granulares por rol",
      "Soporte prioritario",
    ],
  },
  {
    id: "personalizado",
    name: "Personalizado",
    price: null,
    priceLabel: "A la medida",
    cadence: "hablemos",
    pitch: "Cadenas y franquicias con sistemas que ya usas.",
    featured: false,
    cta: "Agendar una llamada",
    features: [
      "Sedes y usuarios sin límite",
      "Todo lo de Operación, más:",
      "Integraciones a la medida (API)",
      "Migración de datos asistida",
      "Capacitación presencial",
      "SLA y ambiente dedicado",
    ],
  },
];

export const FAQS = [
  {
    q: "¿Sirve para restaurante y para tienda?",
    a: "Sí. Nació en restaurante — mesas, comandas, propina, división de cuenta — y el mismo motor cubre retail con código de barras, variantes e inventario por bodega. Activas el modo que necesites por sede.",
  },
  {
    q: "¿Funciona sin internet?",
    a: "Hoy no, y no queremos prometerlo. GoCheck es web y requiere conexión; el modo offline está en la hoja de ruta. Si tu local tiene internet inestable, hablemos antes de que compres.",
  },
  {
    q: "¿La factura es válida ante la DIAN?",
    a: "Sí, con tu resolución y numeración cargadas en el panel. Calculamos IVA e INC según el régimen del negocio y guardamos el rastro de cada documento.",
  },
  {
    q: "¿Puedo migrar de mi sistema actual?",
    a: "En Operación y Personalizado acompañamos la migración de productos, clientes y saldos, normalmente desde Excel o archivo plano.",
  },
  {
    q: "¿Qué pasa con mis datos si me voy?",
    a: "Son tuyos. Exportas productos, ventas, clientes y movimientos contables en CSV cuando quieras, sin pedir permiso ni pagar por el export.",
  },
  {
    q: "¿El precio es por sede o por empresa?",
    a: "Por empresa. Punto cubre una sede, Operación incluye hasta cinco. Si necesitas más, ahí entra Personalizado.",
  },
];
