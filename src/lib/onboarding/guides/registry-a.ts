import type { GuideDescriptor } from "./types"

/**
 * Registro A de recorridos por sección (lo mantiene el Agente A).
 *
 * Módulos cubiertos: Operación (Caja, Inventario, Productos, Restaurante),
 * Comercial (Compras, Proveedores, Directorio de clientes, Clientes/CxC) y
 * Personal (Empleados, Nómina, Consumos/deducciones, Turnos).
 *
 * Todos los recorridos son informativos (spotlight + "Siguiente"): un paso
 * intro centrado, un primer paso con `navigateTo`, varios pasos que resaltan
 * elementos clave y un cierre centrado. Ver `sedeGuide` en ./core.ts.
 *
 * Orden: los descriptores más específicos van primero (rutas anidadas antes
 * que su padre) para que su `match` no quede tapado.
 */
export const guidesA: GuideDescriptor[] = [
  // ─── Operación ─────────────────────────────────────────────────────────────
  {
    id: "caja",
    match: /^\/panel\/caja/,
    build: () => [
      {
        target: null,
        title: "El resumen de caja",
        body: "Aquí ves, de un vistazo, cómo va el efectivo de todas tus sedes en un día: aperturas, ventas y cierres. Te muestro lo esencial.",
      },
      {
        target: "caja-dia",
        navigateTo: "/panel/caja",
        title: "Elige el día",
        body: "Cambia la fecha para revisar el resumen de cualquier jornada. Por defecto ves el día de hoy.",
      },
      {
        target: "caja-kpis",
        title: "Las cifras del día",
        body: "Cajas abiertas, ventas, efectivo esperado y base de apertura, sumadas de todas tus sedes.",
      },
      {
        target: "caja-tabla",
        title: "Sede por sede",
        body: "Cada fila es una sede: su estado (abierta, cerrada o sin abrir), lo vendido, el efectivo esperado y la diferencia al cerrar el arqueo.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Las cajas se abren y cierran desde el punto de venta; aquí solo consultas el resumen. Vuelve cuando quieras desde Operación → Caja.",
      },
    ],
  },
  {
    id: "inventario",
    match: /^\/panel\/inventario/,
    build: () => [
      {
        target: null,
        title: "Tu inventario",
        body: "Controla el catálogo de productos, las existencias por sede y el historial de movimientos (kardex). Te muestro lo principal.",
      },
      {
        target: "inv-nuevo",
        navigateTo: "/panel/inventario",
        title: "Crea un producto",
        body: "Con “Nuevo producto” agregas ítems al catálogo: define nombre, SKU, unidad y si es perecedero.",
      },
      {
        target: "inv-entrada",
        title: "Registra entradas y ajustes",
        body: "“Entrada” recibe mercancía y suma stock; “Ajuste” corrige existencias por conteo, daño o merma. Las salidas descuentan primero los lotes próximos a vencer (FEFO).",
      },
      {
        target: "inv-tabs",
        title: "Tres vistas",
        body: "Cambia entre “Productos” (el catálogo), “Existencias” (stock por sede, con sus lotes) y “Movimientos” (el kardex completo).",
      },
      {
        target: "inv-buscar",
        title: "Encuentra rápido",
        body: "Busca por nombre, SKU o código de barras para llegar al producto sin recorrer toda la lista.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Con esto llevas el control de tu stock. Vuelve cuando quieras desde Operación → Inventario.",
      },
    ],
  },
  {
    id: "productos",
    match: /^\/panel\/productos/,
    build: () => [
      {
        target: null,
        title: "Productos vendibles",
        body: "Este es el catálogo que se ofrece en el punto de venta. Cada producto descuenta el inventario al venderse. Te muestro cómo funciona.",
      },
      {
        target: "productos-nuevo",
        navigateTo: "/panel/productos",
        title: "Crea un vendible",
        body: "Con “Nuevo producto” defines qué se vende: un ítem directo del inventario o una receta con varios ingredientes.",
      },
      {
        target: "productos-buscar",
        title: "Busca en el catálogo",
        body: "Filtra por nombre, SKU o categoría para ubicar cualquier producto del menú.",
      },
      {
        target: "productos-tabla",
        title: "Tu menú de venta",
        body: "Cada fila muestra el origen (del inventario o con receta), su composición y el precio con IVA incluido.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Todo lo que crees aquí queda disponible en el POS. Vuelve cuando quieras desde Operación → Productos.",
      },
    ],
  },
  {
    id: "restaurante",
    match: /^\/panel\/restaurante/,
    build: () => [
      {
        target: null,
        title: "Salón y comandas",
        body: "Gestiona mesas, abre comandas y cobra. Aplicamos el INC 8% y una propina del 10% (rechazable) sobre el consumo. Te muestro lo esencial.",
      },
      {
        target: "restaurante-mesa",
        navigateTo: "/panel/restaurante",
        title: "Crea una mesa",
        body: "Con “Mesa” agregas puestos a un salón. Luego, al tocar una mesa libre, abres su comanda.",
      },
      {
        target: "restaurante-refrescar",
        title: "Mantén el salón al día",
        body: "Actualiza el estado de las mesas para ver quién está ocupado, con cuenta pedida o libre.",
      },
      {
        target: "restaurante-salon",
        title: "El mapa del salón",
        body: "Cada tarjeta es una mesa con su estado y el total en curso. Tócala para tomar el pedido, enviarlo a cocina, pedir la cuenta o cerrar.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Así llevas el servicio de mesa a mesa. Vuelve cuando quieras desde Operación → Restaurante.",
      },
    ],
  },

  // ─── Comercial ─────────────────────────────────────────────────────────────
  {
    id: "compras",
    match: /^\/panel\/compras/,
    build: () => [
      {
        target: null,
        title: "Órdenes de compra",
        body: "Crea órdenes a tus proveedores y recíbelas total o parcialmente: la mercancía entra al inventario y puede generar una cuenta por pagar. Te muestro cómo.",
      },
      {
        target: "compras-nueva",
        navigateTo: "/panel/compras",
        title: "Crea una orden",
        body: "Con “Nueva orden” eliges proveedor, sede y renglones a pedir; puedes enviarla o dejarla en borrador.",
      },
      {
        target: "compras-kpis",
        title: "Cómo van tus compras",
        body: "Consulta cuántas órdenes están en curso y cuánto tienes pendiente por recibir.",
      },
      {
        target: "compras-filtros",
        title: "Filtra el listado",
        body: "Acota por sede y por estado (borrador, enviada, parcial, recibida o anulada) para encontrar la orden que buscas.",
      },
      {
        target: "compras-tabla",
        title: "Abre una orden",
        body: "Toca cualquier fila para ver el detalle, registrar la recepción de la mercancía y generar la CxP.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Al recibir, tu inventario se actualiza solo. Vuelve cuando quieras desde Comercial → Compras.",
      },
    ],
  },
  {
    id: "proveedores",
    match: /^\/panel\/proveedores/,
    build: () => [
      {
        target: null,
        title: "Tus proveedores",
        body: "Inscribe y administra a quienes te venden. Los usarás al crear órdenes de compra y al registrar entradas de mercancía. Te muestro lo básico.",
      },
      {
        target: "proveedores-nuevo",
        navigateTo: "/panel/proveedores",
        title: "Inscribe un proveedor",
        body: "Con “Nuevo proveedor” registras razón social, documento y datos de contacto.",
      },
      {
        target: "proveedores-buscar",
        title: "Busca en el directorio",
        body: "Filtra por nombre, documento, categoría o ciudad para ubicar cualquier proveedor.",
      },
      {
        target: "proveedores-inactivos",
        title: "Incluye inactivos",
        body: "Activa esta casilla para ver también los proveedores que diste de baja, sin perder su historial.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Con tus proveedores al día, comprar es más rápido. Vuelve cuando quieras desde Comercial → Proveedores.",
      },
    ],
  },
  {
    id: "clientes-directorio",
    match: /^\/panel\/clientes\/directorio/,
    build: () => [
      {
        target: null,
        title: "Directorio de clientes",
        body: "Tu base de datos de clientes para facturación y cuentas por cobrar. Aquí registras a quién le vendes. Te muestro cómo.",
      },
      {
        target: "clientes-dir-nuevo",
        navigateTo: "/panel/clientes/directorio",
        title: "Registra un cliente",
        body: "Con “Nuevo cliente” guardas nombre, documento, contacto y su cupo de crédito (fiado).",
      },
      {
        target: "clientes-dir-buscar",
        title: "Encuentra a un cliente",
        body: "Busca por nombre, documento o teléfono para llegar a su ficha al instante.",
      },
      {
        target: "clientes-dir-tabla",
        title: "Tu base de clientes",
        body: "Cada fila muestra el documento, el contacto, el cupo de crédito y si está activo. Edítalo con el lápiz.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Un cliente registrado puede comprar a crédito y recibir factura. Vuelve cuando quieras desde Comercial → Directorio de clientes.",
      },
    ],
  },
  {
    id: "clientes",
    match: /^\/panel\/clientes/,
    build: () => [
      {
        target: null,
        title: "Cuentas por cobrar",
        body: "Controla el fiado: ventas a crédito por cliente, con abonos, vencimientos y antigüedad de saldos. El fiado del POS aparece aquí solo. Te muestro lo esencial.",
      },
      {
        target: "cxc-nuevo",
        navigateTo: "/panel/clientes",
        title: "Registra un fiado",
        body: "Con “Nuevo fiado” creas una cuenta por cobrar a nombre de un cliente registrado, con su monto y vencimiento.",
      },
      {
        target: "cxc-kpis",
        title: "Cuánto te deben",
        body: "Total por cobrar, cuánto está vencido y cuántos clientes tienen saldo, de un vistazo.",
      },
      {
        target: "cxc-aging",
        title: "Antigüedad de saldos",
        body: "El saldo pendiente, repartido por tramos de días vencidos, para saber qué cobrar primero.",
      },
      {
        target: "cxc-tabla",
        title: "Cuenta por cuenta",
        body: "Revisa cada cuenta con su saldo y estado; registra un “Abono” cuando el cliente paga.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Así llevas el fiado bajo control. Vuelve cuando quieras desde Comercial → Cuentas por cobrar.",
      },
    ],
  },

  // ─── Personal ──────────────────────────────────────────────────────────────
  {
    id: "empleados",
    match: /^\/panel\/empleados/,
    build: () => [
      {
        target: null,
        title: "Tu equipo",
        body: "El expediente de RRHH: contratación, seguridad social y documentos de cada empleado. Es la base de la nómina. Te muestro cómo funciona.",
      },
      {
        target: "empleados-nuevo",
        navigateTo: "/panel/empleados",
        title: "Añade un empleado",
        body: "Con “Añadir empleado” registras sus datos, contrato, salario y sede.",
      },
      {
        target: "empleados-cargos",
        title: "Define los cargos",
        body: "En “Cargos” creas los puestos del negocio (cajero, cocinero, mesero…) para asignarlos a cada persona.",
      },
      {
        target: "empleados-kpis",
        title: "Tu plantilla de un vistazo",
        body: "Total de empleados, activos y retirados, para conocer el tamaño de tu equipo.",
      },
      {
        target: "empleados-buscar",
        title: "Busca y filtra",
        body: "Encuentra por nombre, documento o cargo, y filtra por estado (activo, inactivo o retirado).",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Con el expediente completo, la nómina se calcula sola. Vuelve cuando quieras desde Personal → Empleados.",
      },
    ],
  },
  {
    id: "nomina-deducciones",
    match: /^\/panel\/nomina\/deducciones/,
    build: () => [
      {
        target: null,
        title: "Consumos y deducciones",
        body: "Los consumos de empleado (fiado) que se descuentan por nómina. Requieren aprobación antes de entrar a la colilla. Te muestro cómo.",
      },
      {
        target: "deducciones-nuevo",
        navigateTo: "/panel/nomina/deducciones",
        title: "Registra un consumo",
        body: "Con “Nuevo consumo” anotas un almuerzo, un adelanto o cualquier gasto del empleado. Queda pendiente de aprobación.",
      },
      {
        target: "deducciones-kpis",
        title: "Qué está pendiente",
        body: "Cuántos consumos faltan por aprobar y cuánto ya está aprobado para descontar en la próxima corrida.",
      },
      {
        target: "deducciones-filtro",
        title: "Filtra por estado",
        body: "Revisa los consumos pendientes, aprobados, aplicados o rechazados según lo que necesites.",
      },
      {
        target: "deducciones-tabla",
        title: "Aprueba o rechaza",
        body: "Cada consumo pendiente puede aprobarse (entra a la nómina) o rechazarse. Los que vienen del POS traen la etiqueta “POS”.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Al aprobar, el consumo se descuenta en la siguiente colilla. Vuelve cuando quieras desde Personal → Consumos / deducciones.",
      },
    ],
  },
  {
    id: "nomina",
    match: /^\/panel\/nomina/,
    build: () => [
      {
        target: null,
        title: "La nómina",
        body: "Calcula la nómina conforme a la normativa laboral colombiana 2026: devengados, deducciones, aportes y provisiones. Te muestro sus herramientas.",
      },
      {
        target: "nomina-tabs",
        navigateTo: "/panel/nomina",
        title: "Cinco herramientas",
        body: "Cambia entre Correr nómina (la corrida del período), Simulador, Liquidación definitiva, Historial y Parámetros del cálculo.",
      },
      {
        target: "nomina-correr",
        title: "Corre la nómina",
        body: "Elige el período y la cobertura (todas las sedes o una) y genera la corrida. Se calcula con los empleados activos y con salario del expediente.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Cada corrida produce los desprendibles que puedes imprimir o enviar por correo. Vuelve cuando quieras desde Personal → Nómina.",
      },
    ],
  },
  {
    id: "turnos",
    match: /^\/panel\/turnos/,
    build: () => [
      {
        target: null,
        title: "Horas trabajadas",
        body: "Consulta las horas y días de cada trabajador por sede. Son la base para las horas de nómina. Te muestro cómo leerlo.",
      },
      {
        target: "turnos-sede",
        navigateTo: "/panel/turnos",
        title: "Elige la sede",
        body: "Filtra por una sede en particular o mira todas juntas.",
      },
      {
        target: "turnos-rango",
        title: "Define el rango",
        body: "Ajusta las fechas “Desde” y “Hasta” para acotar el período que quieres revisar.",
      },
      {
        target: "turnos-kpis",
        title: "El total del período",
        body: "Horas trabajadas, número de trabajadores y días-turno registrados en el rango elegido.",
      },
      {
        target: "turnos-tabla",
        title: "Trabajador por trabajador",
        body: "El desglose de días y horas por persona y sede, que la nómina puede traer al simulador.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Estas horas alimentan el cálculo de la nómina. Vuelve cuando quieras desde Personal → Turnos.",
      },
    ],
  },
]
