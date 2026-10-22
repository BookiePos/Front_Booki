/**
 * Programa para contadores (ítem 7.8). Contenido de la página pública
 * `/contadores`. Solo afirma lo que el rol de sistema «Contador» del backend
 * ya hace; no hay precios, comisiones ni plazos: eso lo fija el dueño.
 */

/** Permisos del rol Contador en el backend (espejo; `check-permisos` valida las cadenas). */
export const PERMISOS_CONTADOR = ["finance.view", "reports.view", "payroll.view"] as const

export const CONTADORES = {
  titulo: "BookiPos para contadores",
  intro:
    "Tu cliente lleva su negocio en BookiPos y tú entras a revisar su contabilidad con tu propio usuario, sin pedirle exportes ni pantallazos.",
  ve: [
    "Reportes y estados financieros: estado de resultados, balance general y balance de prueba",
    "P&L y flujo de caja",
    "Gastos, cuentas por pagar y cuentas por cobrar de clientes",
    "Caja y bancos",
    "Compras y facturas de proveedor escaneadas",
  ],
  noHace: [
    "Vender ni abrir o cerrar caja",
    "Crear ni modificar asientos, gastos, compras o inventario",
    "Correr ni cerrar la nómina",
    "Crear usuarios, cambiar roles o permisos",
    "Cambiar el plan ni ver o modificar cobros de BookiPos",
    "Ver datos de otras empresas, ni de sedes que el dueño no le abrió",
  ],
  pasos: [
    {
      titulo: "Tu cliente te invita",
      texto:
        "El dueño entra a Configuración, Usuarios, pulsa «Invitar», escribe tu correo y elige el rol «Contador».",
    },
    {
      titulo: "Eliges tu contraseña",
      texto: "Te llega un correo con un enlace para crear tu acceso. Es personal: no compartes la clave del dueño.",
    },
    {
      titulo: "Entras al panel",
      texto:
        "Ves solo lo contable de esa empresa y de las sedes que el dueño te asignó. Puedes salir cuando quieras y él puede retirarte el acceso.",
    },
  ],
  /** Nota de alcance: depende del plan, sin nombrar precios. */
  nota:
    "Qué pantallas están disponibles depende del plan que tenga contratado tu cliente: si un módulo no está en su plan, tampoco aparece para ti.",
  demo: {
    titulo: "Pide una demo",
    texto:
      "Escríbenos y te mostramos el panel del contador con datos de ejemplo, para que veas qué tendrías antes de recomendarlo a un cliente.",
    asunto: "Demo para contadores",
    cuerpo: "Hola, soy contador/a y quiero una demo de BookiPos. Mi nombre y firma: ",
  },
} as const
