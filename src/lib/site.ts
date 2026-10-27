/**
 * Contenido de la web madre. Vive aparte de los componentes para que cambiar
 * un precio o una viñeta no obligue a tocar JSX.
 *
 * Reglas de la copia (las vigila `site.test.ts`):
 *   · Solo se afirma lo que el sistema hace hoy. Cada capacidad nombrada aquí
 *     se puede señalar en una pantalla: si no, no va.
 *   · Sin raya larga en el texto visible: se lee como copia hecha por IA. Coma,
 *     punto o dos puntos.
 *   · Sin precios de terceros (misma regla que `comparativa.ts`).
 *   · Sin fechas ni plazos de lo que todavía no existe (factura electrónica).
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
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
  { href: "#preguntas", label: "Preguntas" },
];

/** Un solo rótulo para la intención "registrarse" en toda la página. */
export const CTA_REGISTRO = { href: "/registro", label: "Probar 14 días gratis" };

/**
 * La factura que aparece al entrar por la letra. El restaurante es de
 * ejemplo, pero el papel está armado como lo imprime el POS (consecutivo FVC-,
 * pago dividido) y cuadra: la suma de líneas da el total y los pagos suman lo
 * mismo. Son los mismos platos y la misma mesa que la pantalla de cobro de la
 * línea de tiempo.
 */
export const TIRILLA = {
  negocio: "Restaurante El Fogón",
  mesa: "Mesa 7",
  consecutivo: "FVC-001284",
  fecha: "25/10/2026 · 1:42 p. m.",
  lineas: [
    { qty: 2, name: "Bandeja paisa", unit: 38_000 },
    { qty: 1, name: "Ajiaco", unit: 28_000 },
    { qty: 2, name: "Limonada de coco", unit: 12_000 },
  ],
  /** Se reparte el total: lo que no va por Nequi entra en efectivo. */
  nequi: 80_000,
};

/**
 * Lo que pasa en el sistema en el mismo segundo del cobro. Cada efecto sale
 * con una raya del renglón de la factura que lo causa (`fila`): los platos
 * mueven el inventario, el efectivo la caja y el total la contabilidad.
 */
export const EFECTOS_DEL_COBRO = [
  { fila: "platos", area: "Inventario", texto: "−2 bandejas, −1 ajiaco" },
  { fila: "efectivo", area: "Caja", texto: "+$48.000 al turno" },
  { fila: "total", area: "Contabilidad", texto: "Asiento #4.812, cuadrado" },
] as const;

/** Franja de medios de pago: todos existen hoy en el cobro del POS. */
export const MEDIOS_DE_PAGO = [
  "Efectivo",
  "Nequi",
  "Daviplata",
  "QR Bre-B",
  "Datáfono",
  "Pago dividido",
  "Propina",
  "Fiado con cliente",
];

/**
 * La línea de tiempo: lo que duele con otros sistemas (se tacha al pasar) y
 * cómo lo resuelve BookiPos, en una línea cada cosa. Cada una lleva su
 * pantalla (ver `components/marketing/pantallas.tsx`) en el mismo orden.
 *
 * Los dolores son genéricos a propósito: no se le atribuye nada a una marca
 * con nombre propio (misma regla que `comparativa.ts`). Cada dolor cabe en un
 * renglón a escritorio (≤ 36 caracteres) para que el tachado sea una sola raya.
 */
export const DOLORES = [
  {
    id: "factura",
    label: "Digitar factura por factura",
    content: "Le tomas foto y la compra entra sola al inventario.",
  },
  {
    id: "cobro",
    label: "Vender aquí, llevar cuentas allá",
    content: "Cada cobro descuenta el inventario y hace su asiento.",
  },
  {
    id: "sin-internet",
    label: "Se cae el internet, se para la caja",
    content: "Sigue cobrando en efectivo y sincroniza al volver.",
  },
  {
    id: "cierre",
    label: "El descuadre aparece a fin de mes",
    content: "Cierras contando billetes: si falta, sale con nombre y hora.",
  },
  {
    id: "nomina",
    label: "La libreta del consumo del equipo",
    content: "Lo que consumen en el local baja solo de la nómina.",
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
      "1 sede · 3 usuarios",
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
      "1 sede",
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
  { feature: "Inventario y arqueo de caja", punto: "Sí", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Mesas, comandas y propinas", punto: "—", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Lotes, vencimientos y trazabilidad", punto: "—", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Compras, órdenes y proveedores", punto: "—", negocio: "Sí", control: "Sí", cadena: "Sí" },
  { feature: "Contabilidad y estados financieros", punto: "—", negocio: "—", control: "Sí", cadena: "Sí" },
  { feature: "CxP, CxC, presupuestos y tesorería", punto: "—", negocio: "—", control: "Sí", cadena: "Sí" },
  { feature: "Nómina colombiana", punto: "Complemento", negocio: "Complemento", control: "10 empleados", cadena: "25 empleados" },
  { feature: "Multi-sede y traslados", punto: "—", negocio: "—", control: "—", cadena: "3 sedes" },
  { feature: "Auditoría y permisos por rol", punto: "—", negocio: "Básico", control: "Sí", cadena: "Por sede" },
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
    note: "Para Punto y Negocio. Control y Cadena ya la traen incluida.",
  },
  {
    name: "Empleado adicional",
    price: 2_900,
    unit: "/mes",
    note: "Por encima del tope de nómina. Con 15 empleados, el complemento queda en $49.400 al mes.",
  },
  {
    name: "Sede adicional",
    price: 89_900,
    unit: "/mes",
    note: "Sobre Cadena, sin límite de sedes.",
  },
  {
    name: "Migración desde Siigo, Alegra o Excel",
    price: 0,
    priceLabel: "Sin costo",
    unit: "",
    note: "Te pasamos catálogo, existencias y clientes desde un archivo CSV.",
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
    q: "¿Sirve para mi tipo de negocio?",
    a: "Si vendes en mostrador o en mesa, sí: restaurante, panadería, cafetería, bar, tienda o minimercado. Para el salón hay mesas, comandas, propina y cuenta dividida; para la tienda, código de barras, variantes e inventario por bodega.",
  },
  {
    q: "¿Funciona sin internet?",
    a: "La caja sí. Si se cae la conexión, el punto de venta sigue cobrando en efectivo con su numeración reservada y guarda las ventas en el equipo. Cuando vuelve la red, se envían solas. El panel de administración sí necesita conexión.",
  },
  {
    q: "¿Qué medios de pago recibe?",
    a: "Efectivo, datáfono, Nequi, Daviplata y QR Bre-B, también combinados en una misma cuenta. Los pagos digitales se concilian después contra el extracto del banco.",
  },
  {
    q: "¿Tengo que comprar equipos?",
    a: "No. Funciona en el computador, la tableta o el celular que ya tienes, desde el navegador. Si tienes impresora térmica y cajón monedero, desde Chrome o Edge BookiPos imprime la tirilla y abre el cajón.",
  },
  {
    q: "¿Emite factura electrónica ante la DIAN?",
    a: "Todavía no. Hoy cargas tu resolución y tu numeración en el panel, el sistema calcula IVA e INC según el régimen del negocio y guarda el rastro de cada documento. Si la factura electrónica es indispensable para ti hoy, escríbenos antes de comprar.",
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
