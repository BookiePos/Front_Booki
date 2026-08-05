import type { GuideDescriptor } from "./types"

/**
 * Recorridos del área de trabajadores (punto de venta, `/pos/*`).
 *
 * A diferencia del panel de administración, aquí el usuario es el cajero: los
 * recorridos son informativos (spotlight + “Siguiente”) y se disparan con el
 * botón “Guía” de la barra superior del terminal, según la pestaña activa.
 *
 * Algunos objetivos viven en el `PosShell` (barra lateral, sede y el propio
 * botón de guía) y por eso están siempre presentes; otros pertenecen a la
 * pantalla y pueden faltar según el estado (p. ej. la caja cerrada oculta el
 * catálogo): en ese caso la burbuja se centra sola, sin romper el recorrido.
 *
 * Orden: las subrutas van primero y la venta (`/pos` exacto) al final, para
 * que `/pos` no tape a `/pos/caja`, `/pos/ventas`, etc.
 */
export const guidesPos: GuideDescriptor[] = [
  // ── Ventas (historial) ───────────────────────────────────────────────────────
  {
    id: "pos-ventas",
    match: /^\/pos\/ventas/,
    build: () => [
      {
        target: null,
        title: "El historial de ventas",
        body: "Aquí quedan todas las ventas de tu sede: puedes consultarlas, reimprimir el comprobante y, con permiso, anularlas. Te muestro lo esencial.",
      },
      {
        target: "pos-ventas-kpis",
        navigateTo: "/pos/ventas",
        title: "El resumen de hoy",
        body: "De un vistazo: cuántas ventas llevas en el día, el total y el ticket promedio (sin contar las anuladas).",
      },
      {
        target: "pos-ventas-buscar",
        title: "Encuentra una venta",
        body: "Busca por número de venta o por cliente, y filtra entre todas, completadas o anuladas.",
      },
      {
        target: "pos-ventas-lista",
        title: "Abre el detalle",
        body: "Toca cualquier venta para ver su factura o recibo, reimprimirlo y —si tu rol lo permite— anularla (devuelve el consumo al inventario).",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Vuelve cuando quieras desde la pestaña Ventas del terminal.",
      },
    ],
  },

  // ── Caja ─────────────────────────────────────────────────────────────────────
  {
    id: "pos-caja",
    match: /^\/pos\/caja/,
    build: () => [
      {
        target: null,
        title: "Tu caja",
        body: "Toda venta ocurre dentro de un turno de caja. Aquí abres el turno con una base, registras movimientos de efectivo y lo cierras con un arqueo. Te muestro cómo.",
      },
      {
        target: "pos-caja-abrir",
        navigateTo: "/pos/caja",
        title: "Abre el turno",
        body: "Cuenta el efectivo base (billetes y monedas) y abre la caja para empezar a vender. Si ya está abierta, este paso no aparece.",
      },
      {
        target: "pos-caja-arqueo",
        title: "El arqueo en vivo",
        body: "Con la caja abierta ves en tiempo real las ventas del turno, el efectivo cobrado y cuánto se espera en el cajón.",
      },
      {
        target: "pos-caja-mov",
        title: "Entradas, salidas y sangrías",
        body: "Registra un ingreso o retiro de efectivo (una sangría lleva plata a la bóveda) para que el arqueo siga cuadrando.",
      },
      {
        target: "pos-caja-cerrar",
        title: "Cierra y cuadra",
        body: "Al terminar, “Cerrar caja” te pide contar el efectivo físico y calcula la diferencia (cuadre, sobrante o faltante).",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "El resumen del día por sede lo ve el administrador en Operación → Caja. Vuelve cuando quieras desde la pestaña Caja.",
      },
    ],
  },

  // ── Inventario ────────────────────────────────────────────────────────────────
  {
    id: "pos-inventario",
    match: /^\/pos\/inventario/,
    build: () => [
      {
        target: null,
        title: "El inventario de tu sede",
        body: "Consulta las existencias de tu sede y, si tu rol lo permite, ajústalas por conteo, daño o merma. Te muestro lo principal.",
      },
      {
        target: "pos-inv-kpis",
        navigateTo: "/pos/inventario",
        title: "Alertas de un vistazo",
        body: "Cuántos ítems tienen stock, cuáles están bajos y cuáles por vencer o vencidos, para actuar a tiempo.",
      },
      {
        target: "pos-inv-buscar",
        title: "Busca un producto",
        body: "Filtra por nombre o SKU para llegar a la existencia que necesitas sin recorrer toda la lista.",
      },
      {
        target: "pos-inv-ajustar",
        title: "Ajusta existencias",
        body: "Con “Ajustar” corriges el stock: una salida descuenta primero los lotes más próximos a vencer (FEFO); una entrada de un producto con lotes crea uno nuevo.",
      },
      {
        target: "pos-inv-tabla",
        title: "Existencia por producto",
        body: "Cada fila muestra la cantidad, el mínimo y su estado (OK, bajo o agotado). Ajusta directamente desde la fila.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Vuelve cuando quieras desde la pestaña Inventario del terminal.",
      },
    ],
  },

  // ── Control de horas (Nómina) ────────────────────────────────────────────────
  {
    id: "pos-nomina",
    match: /^\/pos\/nomina/,
    build: () => [
      {
        target: null,
        title: "Control de horas",
        body: "Registra la entrada y la salida de los trabajadores de tu sede. Estas horas alimentan la nómina que calcula el administrador. Te muestro cómo.",
      },
      {
        target: "pos-horas-fecha",
        navigateTo: "/pos/nomina",
        title: "Elige el día",
        body: "Selecciona la fecha que vas a registrar. No puedes registrar días futuros.",
      },
      {
        target: "pos-horas-editor",
        title: "Marca entrada y salida",
        body: "Por cada trabajador anota la hora de entrada y de salida (el botón del reloj pone la hora actual). Cada hora se registra una sola vez: al confirmarla queda bloqueada.",
      },
      {
        target: "pos-horas-confirmar",
        title: "Confirma las horas",
        body: "Revisa el total del día y pulsa “Confirmar” para guardar las horas nuevas. Las ya registradas no se vuelven a enviar.",
      },
      {
        target: "pos-horas-turnos",
        title: "Turnos acumulados",
        body: "Consulta las horas por trabajador y sede en un rango de fechas; es lo que la nómina trae al cálculo.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Vuelve cuando quieras desde la pestaña Nómina del terminal.",
      },
    ],
  },

  // ── Factura electrónica ───────────────────────────────────────────────────────
  {
    id: "pos-facturacion",
    match: /^\/pos\/facturacion/,
    build: () => [
      {
        target: null,
        title: "Factura electrónica",
        body: "Genera la factura electrónica de cada venta y consulta las ya emitidas. Te muestro cómo funciona.",
      },
      {
        target: "pos-fact-lista",
        navigateTo: "/pos/facturacion",
        title: "Venta por venta",
        body: "Cada fila es una venta: si aún no tiene factura, pulsa “Generar factura”; si ya la tiene, verás su número y podrás abrir su representación gráfica.",
      },
      {
        target: "pos-fact-lista",
        title: "Nota crédito",
        body: "Con permiso, una factura emitida puede anularse con una nota crédito indicando el motivo.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "El envío y la validación ante la DIAN se habilitan al integrar el proveedor tecnológico. Vuelve cuando quieras desde la pestaña Factura electrónica.",
      },
    ],
  },

  // ── Venta (pantalla principal, /pos exacto) ──────────────────────────────────
  {
    id: "pos-venta",
    match: /^\/pos$/,
    build: () => [
      {
        target: null,
        title: "El punto de venta",
        body: "Esta es tu pantalla de venta: agrega productos, cobra e imprime. Te doy un recorrido rápido; puedes omitirlo cuando quieras.",
      },
      {
        target: "pos-sede",
        navigateTo: "/pos",
        title: "Tu sede",
        body: "Aquí ves en qué sede estás trabajando. Todo lo que vendas y tu caja quedan en esta sede; puedes cambiarla desde tu menú de usuario.",
      },
      {
        target: "pos-buscar",
        title: "Busca o escanea",
        body: "Escribe el nombre o SKU, o escanea el código de barras y pulsa Enter para agregar el producto al instante.",
      },
      {
        target: "pos-carrito",
        title: "La cuenta",
        body: "Los productos agregados se listan aquí con su cantidad y descuentos. Ajusta cantidades, aplica un descuento predefinido o vacía la cuenta.",
      },
      {
        target: "pos-cobrar",
        title: "Cobra",
        body: "Pulsa “Cobrar” para elegir el medio de pago (efectivo, tarjeta, transferencia o fiado), calcular el cambio, facturar e imprimir el recibo.",
      },
      {
        target: "pos-cuentas",
        title: "Cuentas abiertas",
        body: "¿Una mesa o cliente deja el consumo pendiente? Guárdalo como cuenta abierta y retómalo después sin perder nada.",
      },
      {
        target: "pos-nav",
        title: "Muévete por el terminal",
        body: "Desde aquí llegas a tus ventas, la caja, el inventario, el control de horas y la factura electrónica.",
      },
      {
        target: "pos-guia",
        title: "¿Necesitas verlo de nuevo?",
        body: "Reabre la guía de cada pantalla cuando quieras desde este botón.",
      },
      {
        target: null,
        title: "¡A vender!",
        body: "Eso es todo. Recuerda que necesitas la caja abierta para poder cobrar. ¡Éxitos!",
      },
    ],
  },
]
