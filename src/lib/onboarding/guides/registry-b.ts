import type { GuideDescriptor } from "./types"

/**
 * Registro B de recorridos por sección (lo mantiene el Agente B).
 *
 * Módulos cubiertos: Finanzas (Caja y bancos, Gastos, Cuentas por pagar,
 * Estado de resultados, Reportes, Metas, Flujo de caja), Cumplimiento
 * (Impuestos, Facturación electrónica, Auditoría) y Configuración (Usuarios y
 * roles, Parámetros).
 *
 * Cada recorrido es informativo (spotlight + “Siguiente”): un paso intro
 * centrado, un primer paso con `navigateTo` a la ruta del módulo y varios pasos
 * que resaltan elementos con `data-tour`, y un cierre centrado. Sigue el patrón
 * de `sedeGuide` en ./core.ts.
 *
 * Nota: “Resoluciones” (/panel/resoluciones) ya tiene página, pero todavía no
 * tiene recorrido guiado propio.
 */
export const guidesB: GuideDescriptor[] = [
  // ── Finanzas ────────────────────────────────────────────────────────────────
  {
    id: "finanzas-bancos",
    match: /^\/panel\/finanzas\/bancos/,
    build: () => [
      {
        target: null,
        title: "Caja y bancos",
        body: "Aquí llevas tus cuentas de efectivo, bancos y billeteras: su saldo y cada movimiento. Te muestro lo esencial.",
      },
      {
        target: "bancos-saldo",
        navigateTo: "/panel/finanzas/bancos",
        title: "Tu saldo consolidado",
        body: "Estos indicadores resumen el saldo total de todas tus cuentas y el efectivo de hoy.",
      },
      {
        target: "bancos-cuentas",
        title: "Tus cuentas",
        body: "Cada cuenta muestra su tipo, sede, saldo inicial y saldo actual. Entra a “Movimientos” para ver su detalle.",
      },
      {
        target: "bancos-nueva",
        title: "Agrega una cuenta",
        body: "Con “Nueva cuenta” registras un banco, una caja de efectivo o una billetera digital.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Ya sabes moverte por Caja y bancos. Registra tus cuentas y concilia los bancos para tener tus saldos al día.",
      },
    ],
  },
  {
    id: "finanzas-gastos",
    match: /^\/panel\/finanzas\/gastos/,
    build: () => [
      {
        target: null,
        title: "Gastos",
        body: "Registra los gastos operativos de tu negocio por sede, con IVA y estado de pago. Empecemos.",
      },
      {
        target: "gastos-kpis",
        navigateTo: "/panel/finanzas/gastos",
        title: "Cuánto llevas gastado",
        body: "Estos indicadores muestran el gasto del período y cuánto tienes “por pagar”.",
      },
      {
        target: "gastos-filtro",
        title: "Filtra lo que buscas",
        body: "Acota por sede, rango de fechas y estado (pagados o por pagar) para encontrar un gasto en segundos.",
      },
      {
        target: "gastos-tabla",
        title: "El detalle de cada gasto",
        body: "Aquí ves concepto, categoría, sede, IVA y total. Puedes editar o eliminar cada registro.",
      },
      {
        target: "gastos-nuevo",
        title: "Registra un gasto",
        body: "Con “Nuevo gasto” capturas monto, IVA, proveedor y si es recurrente.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Registra tus gastos al día y el resto de Finanzas (P&L, flujo de caja) se alimentará solo.",
      },
    ],
  },
  {
    id: "finanzas-cxp",
    match: /^\/panel\/finanzas\/cxp/,
    build: () => [
      {
        target: null,
        title: "Cuentas por pagar",
        body: "Controla las facturas de proveedores pendientes de pago, con sus abonos y vencimientos. Te muestro cómo.",
      },
      {
        target: "cxp-kpis",
        navigateTo: "/panel/finanzas/cxp",
        title: "Lo que debes",
        body: "Estos indicadores resumen el total abierto y, en rojo, lo que ya está vencido.",
      },
      {
        target: "cxp-filtro",
        title: "Filtra por sede y estado",
        body: "Revisa solo las cuentas abiertas, con abono, pagadas o anuladas de una sede en particular.",
      },
      {
        target: "cxp-tabla",
        title: "El detalle de cada factura",
        body: "Ves proveedor, documento, vencimiento y saldo. Desde “Abono” registras un pago parcial o total.",
      },
      {
        target: "cxp-nueva",
        title: "Registra una cuenta por pagar",
        body: "Con “Nueva CxP” capturas la factura de un proveedor con su monto y fecha de vencimiento.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Ya conoces las Cuentas por pagar. Mantén los vencimientos al día y evita sorpresas de caja.",
      },
    ],
  },
  {
    id: "finanzas-pl",
    match: /^\/panel\/finanzas\/pl/,
    build: () => [
      {
        target: null,
        title: "Estado de resultados",
        body: "Aquí ves tu P&L del período (ingresos, costos, gastos y utilidad) y el comparativo Metas vs Real.",
      },
      {
        target: "pl-estado",
        navigateTo: "/panel/finanzas/pl",
        title: "El estado de resultados",
        body: "Esta vista arma tu P&L del período: margen bruto, gastos operativos, utilidad y el IVA por pagar.",
      },
      {
        target: "pl-vs",
        title: "Metas vs Real",
        body: "Cambia a esta vista para contrastar, mes a mes, tus metas contra lo que realmente ocurrió.",
      },
      {
        target: "pl-vistas",
        title: "Alterna cuando quieras",
        body: "Estos botones cambian entre ambas vistas. El selector de sede del encabezado aplica a las dos.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. El P&L se calcula con tus ventas, gastos, nómina y compras del período.",
      },
    ],
  },
  {
    id: "finanzas-reportes",
    match: /^\/panel\/finanzas\/reportes/,
    build: () => [
      {
        target: null,
        title: "Reportes financieros",
        body: "Estados financieros leídos del ledger de partida doble y las ventas de tu operación. Te muestro cómo usarlos.",
      },
      {
        target: "reportes-tipos",
        navigateTo: "/panel/finanzas/reportes",
        title: "Elige tu reporte",
        body: "Estado de resultados, balance general, balance de comprobación o ventas por día: cámbialo con un clic.",
      },
      {
        target: "reportes-filtro",
        title: "Acota el reporte",
        body: "Selecciona la sede (o consolidado) y el rango de fechas o el corte, según el reporte elegido.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Estos reportes se leen del ledger contable, así que reflejan tus asientos de partida doble.",
      },
    ],
  },
  {
    id: "finanzas-metas",
    match: /^\/panel\/finanzas\/metas/,
    build: () => [
      {
        target: null,
        title: "Metas",
        body: "Planea tu año por categoría y escenario. Estas metas son la base del comparativo vs Real. Empecemos.",
      },
      {
        target: "metas-lista",
        navigateTo: "/panel/finanzas/metas",
        title: "Tus metas del año",
        body: "Cada fila es una meta con su escenario, estado y total anual. Entra a “Editar” para ajustar sus líneas.",
      },
      {
        target: "metas-nuevo",
        title: "Crea una meta",
        body: "Con “Nueva meta” defines nombre, año, sede y escenario; luego capturas los montos mes a mes.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Marca la meta como “Activa” para verla en el comparativo Metas vs Real.",
      },
    ],
  },
  {
    id: "finanzas-flujo",
    match: /^\/panel\/finanzas\/flujo/,
    build: () => [
      {
        target: null,
        title: "Flujo de caja proyectado",
        body: "Estima cuánto durará tu efectivo (runway) con una proyección semanal de entradas y salidas. Te muestro cómo.",
      },
      {
        target: "flujo-filtro",
        navigateTo: "/panel/finanzas/flujo",
        title: "Ajusta la proyección",
        body: "Elige sede y horizonte, y decide si incluir estimados de ventas, nómina y gastos recurrentes.",
      },
      {
        target: "flujo-runway",
        title: "Tu runway",
        body: "Estos indicadores resumen saldo actual, entradas, salidas y hasta qué semana alcanza el efectivo.",
      },
      {
        target: "flujo-proyeccion",
        title: "Semana a semana",
        body: "La tabla desglosa entradas, salidas, neto y saldo proyectado de cada semana del horizonte.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Usa la proyección para anticipar déficits y planear tus pagos con tiempo.",
      },
    ],
  },
  // ── Cumplimiento ────────────────────────────────────────────────────────────
  {
    id: "impuestos",
    match: /^\/panel\/impuestos/,
    build: () => [
      {
        target: null,
        title: "Impuestos",
        body: "Configura los impuestos de tu negocio (IVA, INC, exento, excluido) con vigencias por fecha. Empecemos.",
      },
      {
        target: "impuestos-tabla",
        navigateTo: "/panel/impuestos",
        title: "Tus impuestos",
        body: "Cada fila muestra el código, tipo, la tarifa vigente y desde cuándo aplica. Haz clic para ver su histórico.",
      },
      {
        target: "impuestos-nuevo",
        title: "Crea un impuesto",
        body: "Con “Nuevo impuesto” defines el código, el tipo y su primera vigencia con la tarifa correspondiente.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Al cambiar una tarifa publicas una nueva vigencia y el sistema respeta las fechas.",
      },
    ],
  },
  {
    id: "facturacion",
    match: /^\/panel\/facturacion/,
    build: () => [
      {
        target: null,
        title: "Facturación electrónica",
        body: "Genera la factura electrónica de cada venta y sus notas crédito. Te muestro lo esencial.",
      },
      {
        target: "facturacion-dian",
        navigateTo: "/panel/facturacion",
        title: "Qué exige la DIAN",
        body: "Este bloque resume la normatividad y qué está listo o pendiente en el sistema. Ábrelo cuando tengas dudas.",
      },
      {
        target: "facturacion-ventas",
        title: "Tus ventas por facturar",
        body: "Cada venta de la sede aparece aquí. Con “Generar factura” creas su factura electrónica y su representación gráfica.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Completa el NIT y la resolución DIAN de la sede para que las facturas lleven CUFE.",
      },
    ],
  },
  {
    id: "auditoria",
    match: /^\/panel\/auditoria/,
    build: () => [
      {
        target: null,
        title: "Auditoría",
        body: "Registro inmutable de toda operación de escritura: quién hizo qué, cuándo y desde dónde. Te muestro cómo consultarlo.",
      },
      {
        target: "auditoria-filtros",
        navigateTo: "/panel/auditoria",
        title: "Filtra los eventos",
        body: "Acota por módulo, tipo de acción (crear, editar, borrar), usuario y rango de fechas.",
      },
      {
        target: "auditoria-tabla",
        title: "La bitácora",
        body: "Cada fila muestra la fecha, el usuario, la acción, el recurso afectado y si la operación fue exitosa.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. La auditoría es de solo lectura: nadie puede alterar el histórico de operaciones.",
      },
    ],
  },
  // ── Configuración ───────────────────────────────────────────────────────────
  {
    id: "config-usuarios",
    match: /^\/panel\/config\/usuarios/,
    build: () => [
      {
        target: null,
        title: "Usuarios y roles",
        body: "Gestiona el acceso y los permisos de tu equipo: cuentas, invitaciones y roles a la medida. Empecemos.",
      },
      {
        target: "usuarios-tabs",
        navigateTo: "/panel/config/usuarios",
        title: "Usuarios y roles",
        body: "Alterna entre la lista de usuarios y la definición de roles con estos dos botones.",
      },
      {
        target: "usuarios-lista",
        title: "Tu equipo",
        body: "Cada usuario muestra su rol, las sedes donde opera y su estado. Edítalo para ajustar rol o permisos.",
      },
      {
        target: "usuarios-invitaciones",
        title: "Invitaciones",
        body: "Aquí siguen las personas invitadas que aún no activan su cuenta. Puedes reenviar o revocar la invitación.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Crea roles con los permisos justos y asígnalos a tu equipo para un acceso ordenado.",
      },
    ],
  },
  {
    id: "config-parametros",
    match: /^\/panel\/config\/parametros/,
    build: () => [
      {
        target: null,
        title: "Parámetros",
        body: "Tarifas, recargos y topes del sistema, versionados por fecha de vigencia. Te muestro cómo funcionan.",
      },
      {
        target: "parametros-grupos",
        navigateTo: "/panel/config/parametros",
        title: "Parámetros por grupo",
        body: "Los parámetros se organizan por tema. Haz clic en cualquiera para ver su histórico y publicar un nuevo valor.",
      },
      {
        target: "parametros-actualizar",
        title: "Refresca la vista",
        body: "Con este botón vuelves a cargar los parámetros para ver los últimos valores publicados.",
      },
      {
        target: null,
        title: "¡Listo!",
        body: "Eso es todo. Al cambiar un parámetro publicas una nueva vigencia; el sistema aplica el valor según su fecha.",
      },
    ],
  },
]
