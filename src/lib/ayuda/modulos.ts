/**
 * Ayuda de cada módulo: qué es, cómo se hacen las tareas de siempre y qué
 * significan las palabras que aparecen en esa pantalla.
 *
 * El recorrido guiado enseña DÓNDE están las cosas, una vez. Esto responde lo
 * que se pregunta todos los días: "¿cómo hago para…?" y "¿qué es esto?". Por
 * eso vive en un panel que se abre al lado, sin tapar la pantalla: la persona
 * lee el paso y lo hace ahí mismo.
 *
 * Reglas de redacción (las mismas del glosario):
 * - Frases cortas y en llano, como se lo explicarías a quien atiende el mostrador.
 * - Cada tarea, de tres a cinco pasos, con el nombre EXACTO del botón entre comillas.
 * - Las palabras técnicas no se explican aquí: se enlazan al glosario.
 *
 * Una pantalla sin entrada propia muestra la que le corresponde por prefijo
 * (`/panel/finanzas/bancos/123` usa la de Bancos) y, si no hay ninguna, el
 * panel arma lo que puede con su recorrido guiado.
 */
import type { TerminoGlosario } from "@/lib/glosario"

export interface TareaAyuda {
  /** "Cómo…" en infinitivo: "Registrar una compra". */
  titulo: string
  pasos: string[]
}

export interface AyudaModulo {
  /** Rutas a las que aplica. Las más específicas van primero en la lista. */
  match: RegExp
  titulo: string
  /** Para qué le sirve al negocio, en una o dos frases. */
  paraQue: string
  tareas: TareaAyuda[]
  /** Palabras de esta pantalla que conviene entender. */
  terminos: TerminoGlosario[]
  /** Un consejo que ahorra errores o plata. Opcional. */
  consejo?: string
}

export const AYUDA_MODULOS: AyudaModulo[] = [
  // ── Punto de venta ─────────────────────────────────────────────────────────
  {
    match: /^\/pos\/caja/,
    titulo: "Caja del turno",
    paraQue:
      "Cada turno empieza contando la plata del cajón y termina contándola otra vez. En medio, el sistema lleva la cuenta de lo que debería haber.",
    tareas: [
      {
        titulo: "Abrir la caja",
        pasos: [
          "Cuenta cuántos billetes y monedas de cada uno tienes en el cajón y escríbelo en su fila. Enter pasa a la siguiente.",
          "Si ya lo contaste, cambia a “Solo el total”. Si arrancas con lo mismo de ayer, toca “Usar la misma base”.",
          "Toca “Abrir caja”. Desde ese momento ya puedes vender.",
        ],
      },
      {
        titulo: "Sacar o meter plata en medio del turno",
        pasos: [
          "En “Movimientos” elige Ingreso, Salida o Sangría.",
          "Escribe el monto y el motivo (por ejemplo, “pago al domiciliario”).",
          "Toca “Agregar”. Lo que debe haber en el cajón se ajusta solo.",
        ],
      },
      {
        titulo: "Cerrar la caja",
        pasos: [
          "Toca “Cerrar caja” y cuenta el cajón igual que al abrir.",
          "Junto al botón ves si cuadra, si sobra o si falta.",
          "Si no cuadra, escribe por qué y toca “Cerrar turno”.",
        ],
      },
    ],
    terminos: ["turno", "baseCaja", "arqueo", "descuadre"],
    consejo:
      "Saca la plata grande con una sangría durante el día: menos efectivo en el cajón es menos riesgo, y el cierre sigue cuadrando.",
  },
  {
    match: /^\/pos\/ventas/,
    titulo: "Ventas del día",
    paraQue: "Todas las ventas de esta sede, para reimprimir un tiquete, devolver algo o anular un error.",
    tareas: [
      {
        titulo: "Devolver un producto",
        pasos: [
          "Busca la venta y ábrela.",
          "Toca “Devolución” y marca qué productos y cuántos vuelven.",
          "Elige cómo se le devuelve la plata al cliente y confirma. Lo devuelto regresa al inventario.",
        ],
      },
      {
        titulo: "Reimprimir un tiquete",
        pasos: ["Abre la venta.", "Toca “Imprimir”."],
      },
    ],
    terminos: ["tiquete", "devolucion", "notaCredito"],
  },
  {
    match: /^\/pos\/inventario/,
    titulo: "Inventario en la caja",
    paraQue: "Lo que hay en esta sede, para responderle al cliente sin ir a la bodega, y recibir mercancía sin salir del terminal.",
    tareas: [
      {
        titulo: "Saber si hay un producto",
        pasos: ["Escribe el nombre o pasa el lector de barras.", "La columna de existencias dice cuánto queda en esta sede."],
      },
    ],
    terminos: ["existencia", "stockMinimo", "lote"],
  },
  {
    match: /^\/pos\/nomina/,
    titulo: "Control de horas",
    paraQue: "La hora de entrada y de salida de cada trabajador de esta sede. De aquí salen las horas extra y los recargos de la nómina.",
    tareas: [
      {
        titulo: "Anotar las horas del día",
        pasos: [
          "Elige la fecha.",
          "Escribe la hora de entrada y la de salida de cada trabajador.",
          "Toca “Confirmar”. Cada hora confirmada queda bloqueada.",
        ],
      },
      {
        titulo: "Corregir una hora ya confirmada",
        pasos: ["Toca “Solicitar edición” en ese trabajador.", "Escribe la hora correcta y por qué.", "Un administrador la aprueba."],
      },
    ],
    terminos: ["turno", "horasExtra", "recargoNocturno", "desprendible"],
  },
  {
    match: /^\/pos\/facturacion/,
    titulo: "Factura electrónica",
    paraQue: "Las facturas que salieron de esta caja hacia la DIAN y su estado.",
    tareas: [
      {
        titulo: "Hacerle factura a un cliente que la pide",
        pasos: [
          "Al cobrar, en “Factura electrónica DIAN”, elige facturar.",
          "Escribe sus datos: tipo y número de documento, nombre y correo.",
          "Cobra como siempre. La factura le llega al correo cuando la DIAN la acepta.",
        ],
      },
    ],
    terminos: ["facturaElectronica", "cufe", "notaCredito", "dian"],
  },
  {
    match: /^\/pos($|\/(domicilios|plataformas))/,
    titulo: "Vender",
    paraQue: "La pantalla de cobrar: tocas productos, el sistema suma y te dice la devuelta.",
    tareas: [
      {
        titulo: "Hacer una venta",
        pasos: [
          "Toca los productos o escanea su código. Cada toque suma uno.",
          "Toca “Cobrar” (o F4).",
          "Elige cómo paga. En efectivo, toca el billete con que paga y verás la devuelta.",
          "Toca “Confirmar”. El inventario se descuenta solo.",
        ],
      },
      {
        titulo: "Dejar una cuenta abierta (mesa o pedido para después)",
        pasos: [
          "Arma el pedido como siempre.",
          "Toca “Guardar como cuenta” y ponle un nombre (Mesa 4, Juan).",
          "Para seguirla o cobrarla, ábrela desde “Cuentas”.",
        ],
      },
      {
        titulo: "Cobrar con dos medios de pago",
        pasos: ["En el cobro toca “Dividir pago”.", "Reparte el total entre efectivo, tarjeta, transferencia o fiado.", "Confirma cuando la suma dé el total."],
      },
    ],
    terminos: ["tiquete", "propina", "contado", "credito", "datafono", "domicilio"],
    consejo:
      "Si se recarga la página o se cierra el navegador a mitad de una venta, al volver la venta sigue ahí.",
  },

  // ── Panel ──────────────────────────────────────────────────────────────────
  {
    match: /^\/panel\/caja/,
    titulo: "Caja de todas las sedes",
    paraQue: "Cómo va el efectivo de cada sede en un día: quién abrió, cuánto se vendió y si el cierre cuadró.",
    tareas: [
      {
        titulo: "Revisar un día que no cuadró",
        pasos: [
          "Elige el día arriba.",
          "Busca la sede con diferencia en rojo.",
          "Mira la nota que dejó el cajero al cerrar y sus movimientos de caja.",
        ],
      },
    ],
    terminos: ["arqueo", "descuadre", "baseCaja"],
    consejo: "Las cajas se abren y se cierran en el punto de venta. Aquí solo se revisan.",
  },
  {
    match: /^\/panel\/inventario/,
    titulo: "Inventario",
    paraQue:
      "Todo lo que compras —insumos y mercancía—, cuánto tienes en cada sede y la historia de cada entrada y salida. Lo que vendes se arma en Productos y precios.",
    tareas: [
      {
        titulo: "Registrar mercancía que llegó",
        pasos: [
          "Toca “Entrada”.",
          "Elige el producto: el cursor salta solo a la cantidad.",
          "Escribe cuánto llegó y el precio de la factura. Abajo ves el total para compararlo con la factura.",
          "Toca “Registrar entrada”.",
        ],
      },
      {
        titulo: "Corregir el inventario después de contar",
        pasos: [
          "En “Herramientas” elige “Conteo físico”.",
          "Escribe lo que contaste de cada producto.",
          "Revisa las diferencias y aplica. Queda registrado quién lo hizo y por qué.",
        ],
      },
      {
        titulo: "Dar de alta un insumo nuevo",
        pasos: [
          "Toca “Nuevo insumo”.",
          "Ponle nombre y cómo lo mides (unidades, kilos, litros).",
          "Si te llega en bultos o cajas, define la presentación de compra.",
          "Guarda. Ya puedes registrar su primera entrada.",
        ],
      },
    ],
    terminos: ["insumo", "existencia", "presentacionCompra", "lote", "fefo", "merma", "ajusteInventario", "kardex"],
    consejo:
      "El precio de compra nunca viene escrito: escribe siempre el de la factura de hoy. Si se toma el de la vez pasada, el costo de lo que vendes queda mal.",
  },
  {
    match: /^\/panel\/produccion/,
    titulo: "Producción",
    paraQue:
      "Para lo que preparas antes de vender: el pan que horneas de madrugada, la salsa de la semana. Los insumos salen del inventario y lo que fabricas entra con su costo real.",
    tareas: [
      {
        titulo: "Crear la receta de un lote",
        pasos: [
          "Toca “Nueva receta”.",
          "Elige qué sale del proceso y cuántas unidades rinde un lote.",
          "Agrega los insumos de una tanda completa, no de una unidad.",
          "Guarda. Ves cuánto cuesta cada unidad con los precios de hoy.",
        ],
      },
      {
        titulo: "Fabricar",
        pasos: [
          "Toca “Nueva orden” y elige la receta y cuántos lotes.",
          "Cuando termines, abre la orden y toca “Terminar”.",
          "Escribe cuánto salió de verdad. Los insumos se descuentan y lo fabricado entra al inventario.",
        ],
      },
      {
        titulo: "Ponerlo a la venta",
        pasos: ["En el tablero de terminados, toca “Publicar”.", "Ponle precio de venta. Ya aparece en la caja."],
      },
    ],
    terminos: ["tanda", "rinde", "ordenProduccion", "parteProduccion", "costo", "margen"],
    consejo: "La receta de lote no es la receta del menú: una dice cómo se fabrica, la otra qué se descuenta al vender.",
  },
  {
    match: /^\/panel\/finanzas\/saldos-favor/,
    titulo: "Saldos a favor",
    paraQue: "Lo que cada cliente tiene a favor por devoluciones, rebajas o descuentos. Lo puede gastar en cualquier sede.",
    tareas: [
      {
        titulo: "Revisar a quién le debes",
        pasos: [
          "Mira la lista de clientes con saldo a favor.",
          "Si dice “Descuadre”, lo que hay por cliente no coincide con la contabilidad: pásaselo a tu contador.",
        ],
      },
    ],
    terminos: ["saldo", "devolucion", "notaCredito"],
  },
  {
    match: /^\/panel\/config\/plan/,
    titulo: "Plan y facturación",
    paraQue: "Qué plan de BookiPos tienes, qué incluye y tus pagos.",
    tareas: [
      {
        titulo: "Cambiar de plan",
        pasos: ["En “Elige tu plan”, toca el que quieres.", "Agrega complementos si los necesitas.", "Revisa el total a cobrar y paga."],
      },
    ],
    terminos: ["plan", "sede"],
  },
  {
    match: /^\/panel\/productos/,
    titulo: "Productos y precios",
    paraQue: "Lo que vendes en la caja, su precio y cuánto te cuesta, para saber cuánto te queda de cada venta.",
    tareas: [
      {
        titulo: "Crear un producto que se vende",
        pasos: [
          "Toca “Nuevo producto”.",
          "Si es algo que compras ya hecho, elígelo del inventario. Si lo preparas, arma su receta con los insumos.",
          "Ponle el precio de venta. El margen se calcula solo.",
          "Guarda. Aparece de inmediato en la caja.",
        ],
      },
      {
        titulo: "Cambiar el precio de un producto",
        pasos: ["Búscalo en la lista y ábrelo.", "Cambia el precio de venta y mira cómo queda el margen.", "Guarda. La caja cobra el precio nuevo desde la siguiente venta."],
      },
    ],
    terminos: ["precioVenta", "costo", "margen", "receta", "categoria", "listaPrecios"],
    consejo: "Un margen en rojo significa que ese producto se vende por debajo de lo que cuesta.",
  },
  {
    match: /^\/panel\/compras\/facturas/,
    titulo: "Facturas por foto",
    paraQue: "Le tomas una foto a la factura del proveedor y el sistema la lee por ti. Tú revisas y apruebas.",
    tareas: [
      {
        titulo: "Cargar una factura",
        pasos: [
          "Toca para subir la foto o el PDF que te llegó al correo.",
          "Espera unos segundos mientras se lee.",
          "Revisa cada renglón: producto, cantidad y precio. Corrige lo que haga falta.",
          "Toca “Aplicar”. La mercancía entra al inventario; lo que no es mercancía va con “Aplicar en gastos”.",
        ],
      },
    ],
    terminos: ["recepcion", "cxp", "costo"],
    consejo: "Nada entra solo: hasta que no apruebas, la factura no toca el inventario.",
  },
  {
    match: /^\/panel\/compras/,
    titulo: "Compras",
    paraQue: "Lo que le pides a tus proveedores y lo que realmente llegó.",
    tareas: [
      {
        titulo: "Pedir mercancía",
        pasos: ["Toca “Nueva orden”.", "Elige el proveedor y agrega los productos con su cantidad y precio.", "Guarda y envíasela al proveedor."],
      },
      {
        titulo: "Recibir lo que llegó",
        pasos: ["Abre la orden y toca “Recibir”.", "Escribe lo que llegó de verdad, aunque sea menos de lo pedido.", "Confirma. El inventario sube solo."],
      },
    ],
    terminos: ["ordenCompra", "recepcion", "cxp", "plazoPago"],
  },
  {
    match: /^\/panel\/proveedores/,
    titulo: "Proveedores",
    paraQue: "A quién le compras, con su NIT, contacto y plazo de pago.",
    tareas: [
      {
        titulo: "Agregar un proveedor",
        pasos: ["Toca “Nuevo proveedor”.", "Escribe nombre, NIT y teléfono.", "Si te da crédito, pon a cuántos días le pagas."],
      },
    ],
    terminos: ["nit", "dv", "plazoPago", "cxp"],
  },
  {
    match: /^\/panel\/clientes\/directorio/,
    titulo: "Clientes",
    paraQue: "Tus clientes registrados: para facturarles, fiarles y saber cuánto te compran.",
    tareas: [
      {
        titulo: "Registrar un cliente",
        pasos: ["Toca “Nuevo cliente”.", "Escribe documento, nombre y teléfono o correo.", "Si le vas a fiar, ponle un cupo."],
      },
    ],
    terminos: ["tipoDocumento", "cupo", "cxc"],
  },
  {
    match: /^\/panel\/clientes/,
    titulo: "Fiado por cobrar",
    paraQue: "Quién te debe, cuánto y desde cuándo.",
    tareas: [
      {
        titulo: "Recibir un abono",
        pasos: ["Busca al cliente.", "Toca “Abono” y escribe cuánto pagó y cómo.", "Confirma. El saldo baja y queda el recibo."],
      },
    ],
    terminos: ["cxc", "abono", "saldo", "cartera", "cupo"],
    consejo: "Revisa esta pantalla cada semana: lo que más tiempo lleva sin pagarse es lo que más cuesta cobrar.",
  },
  {
    match: /^\/panel\/finanzas\/gastos/,
    titulo: "Gastos",
    paraQue: "Todo lo que sale y no es mercancía: arriendo, servicios, domicilios, publicidad.",
    tareas: [
      {
        titulo: "Anotar un gasto",
        pasos: ["Toca “Nuevo gasto”.", "Elige la categoría, la sede y el monto.", "Di con qué se pagó (caja, banco). Guarda."],
      },
      {
        titulo: "Gastos que se repiten cada mes",
        pasos: ["En la pestaña “Recurrentes” crea el gasto con su monto y el día del mes.", "El sistema lo anota solo cada mes."],
      },
    ],
    terminos: ["gastoFijo", "gastoVariable", "pl"],
  },
  {
    match: /^\/panel\/finanzas\/cxp/,
    titulo: "Por pagar",
    paraQue: "Las facturas de proveedores que todavía debes y cuándo vencen.",
    tareas: [
      {
        titulo: "Anotar una factura por pagar",
        pasos: ["Toca “Nueva cuenta por pagar”.", "Elige proveedor, monto y fecha de vencimiento.", "Guarda."],
      },
      {
        titulo: "Registrar un pago",
        pasos: ["Busca la factura y toca “Abono”.", "Escribe cuánto pagaste y de dónde salió la plata.", "Confirma."],
      },
    ],
    terminos: ["cxp", "plazoPago", "abono", "saldo"],
  },
  {
    match: /^\/panel\/finanzas\/(bancos|conciliacion)/,
    titulo: "Bancos y caja",
    paraQue: "Cuánta plata tienes en cada cuenta y si coincide con lo que dice el banco.",
    tareas: [
      {
        titulo: "Cuadrar el banco con el extracto",
        pasos: ["Abre la cuenta y toca “Conciliar”.", "Pega el texto del extracto: el sistema empareja cada línea por monto y fecha.", "Lo que quede sin pareja es lo que hay que revisar."],
      },
    ],
    terminos: ["conciliacion", "extracto", "flujoCaja"],
  },
  {
    match: /^\/panel\/finanzas\/(pl|reportes|metas|flujo)/,
    titulo: "Resultados",
    paraQue: "Si el negocio gana o pierde plata, y en qué se va.",
    tareas: [
      {
        titulo: "Saber si este mes ganaste",
        pasos: ["Elige el mes.", "Ventas menos lo que costó lo vendido es tu utilidad bruta.", "Réstale gastos y nómina: eso es lo que de verdad te quedó."],
      },
    ],
    terminos: ["pl", "utilidadBruta", "utilidadNeta", "costoDeVentas", "puntoEquilibrio", "flujoCaja"],
    consejo: "Vender mucho no es ganar: mira la utilidad, no solo las ventas.",
  },
  {
    match: /^\/panel\/nomina/,
    titulo: "Nómina",
    paraQue: "Lo que le pagas a cada trabajador, con los valores de ley de Colombia ya puestos.",
    tareas: [
      {
        titulo: "Pagar la primera quincena",
        pasos: [
          "En “Pagar nómina” elige pagar por quincenas.",
          "Revisa lo de cada persona: días, sueldo, horas extra y recargos del 1 al 15.",
          "Si a alguien le pagas menos, cámbialo (nunca más de lo calculado).",
          "Toca “Registrar pago de la primera quincena” y di de dónde sale la plata.",
        ],
      },
      {
        titulo: "Cerrar el mes",
        pasos: ["Calcula la nómina del mes.", "Revisa los avisos (turnos sin salida, novedades).", "Ciérrala. La primera quincena ya viene restada."],
      },
    ],
    terminos: ["quincena", "devengado", "deduccion", "netoPagar", "horasExtra", "recargoNocturno", "smmlv", "auxilioTransporte", "prima", "cesantias"],
    consejo: "Los turnos sin hora de salida se pagan sin horas extra. Corrígelos en Equipo → Turnos antes de cerrar.",
  },
  {
    match: /^\/panel\/empleados/,
    titulo: "Personas",
    paraQue: "Quién trabaja contigo, con su contrato, salario y seguridad social.",
    tareas: [
      {
        titulo: "Agregar a alguien que entra a trabajar",
        pasos: ["Toca “Añadir empleado”.", "Escribe sus datos, el salario y el tipo de contrato.", "Elige su EPS, fondo de pensión y nivel de riesgo (ARL)."],
      },
    ],
    terminos: ["salarioIntegral", "eps", "afp", "arl", "nivelRiesgo", "cajaCompensacion"],
  },
  {
    match: /^\/panel\/turnos/,
    titulo: "Turnos",
    paraQue: "Las horas que trabajó cada persona. De aquí salen las horas extra y los recargos de la nómina.",
    tareas: [
      {
        titulo: "Corregir un turno",
        pasos: ["Busca a la persona y el día.", "Corrige la hora de entrada o de salida.", "Guarda. La nómina lo toma al recalcular."],
      },
    ],
    terminos: ["turno", "jornadaMaxima", "horasExtra", "recargoNocturno", "dominicales"],
  },
  {
    match: /^\/panel\/(facturacion|resoluciones)/,
    titulo: "Facturación electrónica",
    paraQue: "Todo lo que necesitas para facturar ante la DIAN: tu resolución, tus facturas y su estado.",
    tareas: [
      {
        titulo: "Empezar a facturar",
        pasos: [
          "Sigue el asistente: datos del RUT, resolución de numeración y firma.",
          "Haz las pruebas que pide la DIAN.",
          "Cuando la DIAN te habilite, las ventas que lo pidan salen con factura electrónica.",
        ],
      },
    ],
    terminos: ["facturaElectronica", "resolucion", "prefijo", "rangoNumeracion", "cufe", "notaCredito", "ambientePruebas"],
    consejo: "Pide la próxima resolución antes de que se acabe el rango: la DIAN no responde al instante.",
  },
  {
    match: /^\/panel\/impuestos/,
    titulo: "Impuestos",
    paraQue: "Cuánto IVA, INC y retenciones llevas en el periodo, para declarar sin sorpresas.",
    tareas: [
      {
        titulo: "Ver cuánto vas a pagar",
        pasos: ["Elige el periodo.", "Mira lo cobrado en ventas menos lo pagado en compras.", "Pásale el reporte a tu contador."],
      },
    ],
    terminos: ["iva", "inc", "retefuente", "reteica", "regimenSimple", "responsableIva", "uvt"],
  },
  {
    match: /^\/panel\/sedes/,
    titulo: "Sedes",
    paraQue: "Cada local de tu negocio, con su dirección, su caja y sus datos fiscales.",
    tareas: [
      {
        titulo: "Abrir una sede nueva",
        pasos: ["Toca “Nueva sede”.", "Escribe nombre y dirección.", "Declara su responsabilidad fiscal para que los impuestos salgan bien."],
      },
    ],
    terminos: ["sede", "nit", "responsableIva", "inc"],
  },
  {
    match: /^\/panel\/config\/usuarios/,
    titulo: "Usuarios y roles",
    paraQue: "Quién entra al sistema y qué puede hacer cada uno.",
    tareas: [
      {
        titulo: "Invitar a un cajero",
        pasos: ["Toca “Invitar”.", "Escribe su correo y elige el rol Cajero.", "Si solo trabaja en una sede, márcala. Le llega un correo para crear su clave."],
      },
    ],
    terminos: ["rol", "permiso", "sede"],
    consejo: "Dale a cada persona solo lo que necesita. Un cajero no necesita ver la nómina.",
  },
  {
    match: /^\/panel$/,
    titulo: "Inicio",
    paraQue: "Cómo va el negocio hoy frente al mismo día de la semana pasada, y lo que hay que resolver.",
    tareas: [
      {
        titulo: "Leer el Inicio en un minuto",
        pasos: [
          "Arriba, lo vendido y si va por encima o por debajo de la semana pasada.",
          "En “Para resolver”, lo que necesita tu atención hoy: cajas sin abrir, cosas por acabarse.",
          "Abajo, lo más vendido, cómo te pagan y cómo va el mes.",
        ],
      },
    ],
    terminos: ["ticketPromedio", "utilidadNeta", "cxc", "cxp"],
  },
]

/** La ayuda de la pantalla abierta, o `undefined` si no hay ninguna que aplique. */
export function ayudaParaRuta(pathname: string): AyudaModulo | undefined {
  return AYUDA_MODULOS.find((m) => m.match.test(pathname))
}
