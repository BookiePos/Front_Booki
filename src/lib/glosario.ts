/**
 * Glosario de términos del negocio, escrito para el comerciante y no para el
 * contador. Cada entrada se muestra dentro de un `<HelpTip>` junto a la
 * etiqueta del campo que la necesita, o de un `<Termino>` cuando la palabra
 * aparece suelta dentro de un texto, una columna de tabla o una insignia.
 *
 * Reglas de redacción (respétalas al añadir términos):
 * 1. Una o dos frases. Si necesitas tres, el término está mal explicado.
 * 2. Lenguaje llano: nada de "base gravable", "sujeto pasivo" ni "causación".
 * 3. Siempre un ejemplo concreto y colombiano, con plata en pesos si aplica.
 * 4. Di también *para qué le sirve*, no solo qué es.
 *
 * Por qué existe: el software habla de CUFE, FEFO, UVT, devengado o arqueo
 * porque la DIAN y la contabilidad hablan así, pero quien lo usa es alguien que
 * monta una panadería. Obligarle a buscar en Google cada palabra es obligarle a
 * abandonar la pantalla a mitad de una tarea.
 */

/** Una entrada del glosario: el nombre corto y su explicación en llano. */
export interface EntradaGlosario {
  /** Nombre del término tal como lo ve el usuario. Corto, sin artículos. */
  titulo: string
  /** Explicación de 1–2 frases con ejemplo. */
  texto: string
  /**
   * Palabras que, escritas en una tabla o en un párrafo, significan este
   * término. Las usa `<Termino>` para localizarlas y `buscarGlosario` para que
   * "primero en vencer" encuentre FEFO. No hace falta repetir el título ni la
   * clave: ya se buscan solos. Sin tildes ni mayúsculas.
   */
  alias?: readonly string[]
}

export const GLOSARIO = {
  // ─────────────────────────────────────────────────────────────────────
  // Producto y catálogo
  // ─────────────────────────────────────────────────────────────────────
  sku: {
    titulo: "SKU",
    texto:
      "El código con el que identificas cada producto en tu negocio. Puede ser el que trae de fábrica o uno tuyo, como 1001 para la Coca-Cola de 400 ml; lo importante es que no se repita.",
    alias: ["codigo interno", "referencia"],
  },
  codigoBarras: {
    titulo: "Código de barras",
    texto:
      "El código de rayas que trae el empaque y que lee la pistola en la caja, para no buscar el producto a mano. Si el producto no trae ninguno —una empanada, por ejemplo— déjalo vacío.",
    alias: ["ean", "codigo de barras"],
  },
  categoria: {
    titulo: "Categoría",
    texto:
      "El grupo al que pertenece el producto: bebidas, aseo, panadería. Te sirve para encontrarlo rápido en el punto de venta y para ver en los reportes qué grupo te deja más plata.",
  },
  unidad: {
    titulo: "Unidad de medida",
    texto:
      "Cómo cuentas ese producto: unidades, kilos, litros o cajas. Usa siempre la unidad con la que lo vendes — si compras la gaseosa por caja de 24 pero la vendes suelta, mide en unidades y no en cajas.",
    alias: ["unidad de medida", "und", "medida"],
  },
  variantes: {
    titulo: "Variantes",
    texto:
      "El mismo producto en distintas presentaciones: talla, color o tamaño. La camiseta negra S y la negra M se cuentan y se venden aparte, pero viven bajo un mismo producto.",
    alias: ["variante", "presentacion", "presentaciones"],
  },
  eje: {
    titulo: "Eje de variante",
    texto:
      "La característica por la que se abren las variantes: talla, color, sabor. Si pones dos ejes —talla y color— el sistema arma todas las combinaciones: negra S, negra M, blanca S…",
  },
  perecedero: {
    titulo: "Producto perecedero",
    texto:
      "El que se vence o se daña con el tiempo, como la leche, el pan o el pollo. Al marcarlo te pedimos la fecha de vencimiento y te avisamos antes de que se te dañe en la nevera.",
    alias: ["perecedero", "perecederos"],
  },
  insumo: {
    titulo: "Insumo",
    texto:
      "La materia prima que entra en un plato o en un producto pero que no vendes suelta: la harina, el aceite, la carne cruda. Se compra y se descuenta del inventario cuando produces.",
    alias: ["insumos", "materia prima"],
  },
  montaje: {
    titulo: "Montaje",
    texto:
      "Lo que usas en el negocio pero no vendes: platos, vasos, cubiertos, uniformes. Se lleva por unidades y con lotes, para saber cuántos tienes y cuántos se te van rompiendo.",
    alias: ["montajes", "menaje"],
  },
  receta: {
    titulo: "Receta",
    texto:
      "La lista de ingredientes que lleva un plato y cuánto de cada uno. Al vender una bandeja paisa se descuentan solos del inventario los 150 g de carne, el huevo y el chicharrón, sin que apuntes nada.",
    alias: ["recetas", "ficha tecnica", "composicion", "escandallo"],
  },
  productoCompuesto: {
    titulo: "Producto compuesto",
    texto:
      "El que se arma con otros productos en vez de comprarse hecho: un combo de hamburguesa con papas y gaseosa. Al venderlo se descuenta cada parte por separado.",
    alias: ["combo", "compuesto"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Precio y margen
  // ─────────────────────────────────────────────────────────────────────
  costo: {
    titulo: "Costo",
    texto:
      "Lo que a ti te vale el producto, sin lo que le sumas para ganar. Si la caja de 24 gaseosas te cuesta $36.000, el costo de una gaseosa es $1.500.",
  },
  precioVenta: {
    titulo: "Precio de venta",
    texto:
      "Lo que le cobras al cliente, con el IVA ya incluido. La diferencia con el costo es tu ganancia: si la gaseosa te cuesta $1.500 y la vendes en $2.500, ganas $1.000.",
    alias: ["precio de venta", "pvp"],
  },
  costoPromedio: {
    titulo: "Costo promedio",
    texto:
      "Lo que te vale en promedio una unidad cuando la has comprado a precios distintos. Si compraste 10 a $1.000 y 10 a $1.400, el costo promedio queda en $1.200 y con ese se calcula tu ganancia.",
    alias: ["costo promedio", "promedio ponderado"],
  },
  margen: {
    titulo: "Margen",
    texto:
      "Cuánto te queda de cada venta después de descontar el costo, en porcentaje. Vender a $2.500 algo que te costó $1.500 deja un margen del 40 %: de cada $100 vendidos, $40 son tuyos.",
    alias: ["margen", "margen bruto", "rentabilidad"],
  },
  utilidadBruta: {
    titulo: "Utilidad bruta",
    texto:
      "Lo que te queda de las ventas después de pagar solo la mercancía, antes del arriendo, los sueldos y la luz. Es la primera señal de si estás vendiendo a buen precio.",
    alias: ["utilidad bruta", "ganancia bruta"],
  },
  utilidadNeta: {
    titulo: "Utilidad neta",
    texto:
      "La plata que de verdad te queda al final del mes, después de pagar todo: mercancía, arriendo, sueldos, servicios e impuestos. Es tu ganancia real.",
    alias: ["utilidad neta", "ganancia neta", "resultado del periodo"],
  },
  costoDeVentas: {
    titulo: "Costo de ventas",
    texto:
      "Lo que te costó la mercancía que efectivamente vendiste en el período, no la que compraste. Si vendiste 100 gaseosas que te salían a $1.500, tu costo de ventas es $150.000.",
    alias: ["costo de ventas", "cogs", "costo de la mercancia vendida"],
  },
  ticketPromedio: {
    titulo: "Ticket promedio",
    texto:
      "Cuánto gasta en promedio cada cliente en una visita: las ventas del día divididas entre el número de tiquetes. Subirlo vendiendo un acompañamiento suele ser más fácil que traer clientes nuevos.",
    alias: ["ticket promedio", "ticket prom", "ticket medio"],
  },
  puntoEquilibrio: {
    titulo: "Punto de equilibrio",
    texto:
      "Cuánto tienes que vender en el mes para no perder ni ganar. Si tus gastos fijos son $6.000.000 y de cada venta te queda el 40 %, necesitas vender $15.000.000 para quedar en ceros.",
    alias: ["punto de equilibrio", "break even"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Inventario
  // ─────────────────────────────────────────────────────────────────────
  existencia: {
    titulo: "Existencia",
    texto:
      "Cuántas unidades tienes ahora mismo en la bodega o en la estantería de esa sede. Baja sola con cada venta y sube con cada compra o producción.",
    alias: ["existencias", "en stock", "stock", "disponible"],
  },
  stockMinimo: {
    titulo: "Stock mínimo",
    texto:
      "La cantidad a partir de la cual quieres que te avisemos para volver a pedir. Si vendes 10 cajas a la semana y el proveedor se demora 3 días, pon 5.",
    alias: ["stock minimo", "minimo", "punto de reorden"],
  },
  lote: {
    titulo: "Lote",
    texto:
      "Un grupo de unidades que entraron juntas, normalmente con la misma fecha de vencimiento. Sirve para vender primero lo más viejo y para saber qué sacar si el proveedor reporta un problema.",
    alias: ["lotes"],
  },
  fefo: {
    titulo: "FEFO",
    texto:
      "La regla de sacar primero lo que se vence antes (del inglés «first expired, first out»). El sistema escoge solo el lote más próximo a vencer, así no se te queda la leche vieja al fondo de la nevera.",
    alias: ["fefo", "primero en vencer"],
  },
  peps: {
    titulo: "PEPS",
    texto:
      "«Primero en entrar, primero en salir»: se vende primero lo que llegó antes. Es la regla estándar en Colombia para valorar el inventario y evita que lo viejo se quede acumulado.",
    alias: ["peps", "fifo", "primeras en entrar"],
  },
  merma: {
    titulo: "Merma",
    texto:
      "Lo que se pierde sin venderse: se venció, se rompió, se derramó o alguien se lo llevó. Registrarla es lo que hace que el inventario del sistema cuadre con lo que ves en la bodega.",
    alias: ["merma", "mermas", "desperdicio"],
  },
  ajusteInventario: {
    titulo: "Ajuste de inventario",
    texto:
      "Corregir a mano lo que el sistema dice que tienes para que coincida con lo que contaste de verdad. Siempre queda registrado quién lo hizo y por qué.",
    alias: ["ajuste", "ajustes", "ajuste de inventario"],
  },
  kardex: {
    titulo: "Kárdex",
    texto:
      "La historia de movimientos de un producto: cada entrada, salida, venta y ajuste con su fecha y su responsable. Es donde miras cuando no entiendes por qué te faltan seis unidades.",
    alias: ["kardex", "kardex", "movimientos"],
  },
  traslado: {
    titulo: "Traslado",
    texto:
      "Mover mercancía de una sede a otra. Sale del inventario de la sede que envía y entra en el de la que recibe, sin que parezca una venta ni una compra.",
    alias: ["traslados", "traslado entre sedes"],
  },
  conteoFisico: {
    titulo: "Conteo físico",
    texto:
      "Contar a mano lo que hay en la bodega para compararlo con lo que dice el sistema. Lo normal es hacerlo una vez al mes con lo que más rota, no con todo el catálogo.",
    alias: ["conteo fisico", "toma fisica", "inventario fisico"],
  },
  rotacion: {
    titulo: "Rotación",
    texto:
      "Cada cuánto se vende todo lo que tienes de un producto. Lo que rota rápido merece más espacio; lo que lleva tres meses quieto te tiene la plata dormida en la bodega.",
    alias: ["rotacion"],
  },
  valorizado: {
    titulo: "Inventario valorizado",
    texto:
      "Cuánta plata tienes metida en mercancía ahora mismo: cada producto por su costo. Es lo que le enseñas al banco o al contador cuando te preguntan qué vale tu bodega.",
    alias: ["valorizado", "valor del inventario"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Producción
  // ─────────────────────────────────────────────────────────────────────
  tanda: {
    titulo: "Tanda",
    texto:
      "Una hornada o preparación completa: lo que sale de una sola vez del horno o de la olla. Si con una receta salen 40 panes, esa es una tanda.",
    alias: ["tandas", "batch", "hornada"],
  },
  rinde: {
    titulo: "Rinde",
    texto:
      "Cuántas unidades salen de una tanda. Si la receta gasta 2 kg de harina y te da 40 panes, el rinde es 40.",
    alias: ["rinde", "rendimiento"],
  },
  parteProduccion: {
    titulo: "Parte de producción",
    texto:
      "El reporte de fin de jornada: cuánto se produjo de verdad y cuánto se dañó. Con él entran al inventario los panes buenos y salen los insumos que se gastaron.",
    alias: ["parte de produccion", "parte", "cierre de produccion"],
  },
  ordenProduccion: {
    titulo: "Orden de producción",
    texto:
      "La instrucción de producir cierta cantidad de un producto: «hoy, 3 tandas de pan de queso». Reserva los insumos y le dice al equipo qué hacer.",
    alias: ["orden de produccion", "op"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Punto de venta y caja
  // ─────────────────────────────────────────────────────────────────────
  pos: {
    titulo: "POS / Punto de venta",
    texto:
      "La pantalla donde se cobra: se arma el pedido, se cobra y se imprime el tiquete. «POS» viene de «point of sale», que es como se llama la caja registradora moderna.",
    alias: ["pos", "punto de venta", "caja registradora"],
  },
  turno: {
    titulo: "Turno de caja",
    texto:
      "El período entre que un cajero abre la caja y la cierra. Todo lo que se cobre queda amarrado a ese turno, así sabes quién respondía por la plata a cada hora.",
    alias: ["turno", "turnos", "turno de caja"],
  },
  baseCaja: {
    titulo: "Base de caja",
    texto:
      "La plata suelta con la que arranca el cajero para poder dar cambio, normalmente entre $50.000 y $200.000. No es venta: al cerrar se descuenta para saber cuánto entró de verdad.",
    alias: ["base", "base de caja", "apertura"],
  },
  arqueo: {
    titulo: "Arqueo de caja",
    texto:
      "Contar el efectivo del cajón al cerrar y compararlo con lo que el sistema dice que debería haber. La diferencia se llama sobrante o faltante y queda registrada.",
    alias: ["arqueo", "cuadre de caja", "cierre de caja"],
  },
  descuadre: {
    titulo: "Sobrante / faltante",
    texto:
      "La diferencia entre el efectivo contado y el esperado al cerrar el turno. Faltante es que hay menos plata de la que debería; sobrante, que hay más — las dos cosas hay que revisarlas.",
    alias: ["descuadre", "faltante", "sobrante", "diferencia"],
  },
  tiquete: {
    titulo: "Tiquete",
    texto:
      "El papelito que se imprime con lo que el cliente compró. Cuenta como soporte de la venta, pero no reemplaza a la factura electrónica cuando el cliente la pide.",
    alias: ["tiquete", "tiquetes", "ticket", "recibo"],
  },
  contado: {
    titulo: "Contado",
    texto:
      "La venta que se paga en el momento, sea en efectivo, por tarjeta o por transferencia. Lo contrario es fiar, que en el sistema se llama crédito.",
  },
  credito: {
    titulo: "Venta a crédito",
    texto:
      "Fiarle al cliente: se lleva la mercancía hoy y paga después. Queda como saldo a su nombre y va descontando el cupo que le diste.",
    alias: ["credito", "fiado", "a credito"],
  },
  propina: {
    titulo: "Propina",
    texto:
      "Lo que el cliente deja de más para el equipo. En Colombia es voluntaria y hay que preguntarla; no es ingreso del negocio, así que se reporta aparte de las ventas.",
  },
  devolucion: {
    titulo: "Devolución",
    texto:
      "Cuando el cliente regresa un producto y le devuelves la plata. La mercancía vuelve al inventario y, si la venta llevaba factura electrónica, hay que emitir una nota crédito.",
    alias: ["devolucion", "devoluciones"],
  },
  datafono: {
    titulo: "Datáfono",
    texto:
      "La maquinita donde se pasa la tarjeta. Cobra una comisión por cada venta (normalmente entre el 2 % y el 4 %), así que lo que te llega al banco es menos de lo que cobraste.",
    alias: ["datafono", "tarjeta"],
  },
  nequi: {
    titulo: "Nequi / Daviplata",
    texto:
      "Las billeteras del celular con las que muchos clientes pagan por QR o por transferencia. Se registran como un medio de pago aparte del efectivo porque la plata cae en otra cuenta.",
    alias: ["nequi", "daviplata", "billetera", "transferencia"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Clientes y cartera
  // ─────────────────────────────────────────────────────────────────────
  cxc: {
    titulo: "Cuentas por cobrar (CxC)",
    texto:
      "La plata que te deben los clientes a los que les fiaste. Es venta hecha pero no cobrada: cuenta en tus ventas, pero todavía no está en tu bolsillo.",
    alias: ["cxc", "cuentas por cobrar", "cartera"],
  },
  cupo: {
    titulo: "Cupo de crédito",
    texto:
      "El máximo que le dejas deber a un cliente. Si el cupo es $300.000 y ya debe $280.000, solo puede fiar $20.000 más hasta que abone.",
    alias: ["cupo", "cupo de credito"],
  },
  abono: {
    titulo: "Abono",
    texto:
      "Un pago parcial a una deuda. Si el cliente debe $200.000 y te da $50.000, eso es un abono y le quedan $150.000 de saldo.",
    alias: ["abono", "abonado", "abonos"],
  },
  saldo: {
    titulo: "Saldo",
    texto:
      "Lo que falta por pagar o lo que queda disponible, según dónde lo veas. En un cliente es lo que te debe; en una cuenta bancaria, la plata que hay.",
  },
  cartera: {
    titulo: "Cartera vencida",
    texto:
      "Lo que te deben y ya pasó la fecha de pago. Es la parte de las cuentas por cobrar que hay que perseguir: entre más días pasan, menos probable es cobrarla.",
    alias: ["cartera vencida", "mora", "vencida"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Compras y proveedores
  // ─────────────────────────────────────────────────────────────────────
  ordenCompra: {
    titulo: "Orden de compra",
    texto:
      "El pedido formal que le haces al proveedor antes de que llegue la mercancía. Sirve para reclamar si te mandan menos o te cobran de más.",
    alias: ["orden de compra", "oc", "pedido"],
  },
  recepcion: {
    titulo: "Recepción",
    texto:
      "Registrar lo que de verdad llegó del pedido, que no siempre es lo que pediste. Solo lo recibido entra al inventario y solo eso se le paga al proveedor.",
    alias: ["recepcion", "recibido", "recibir"],
  },
  cxp: {
    titulo: "Cuentas por pagar (CxP)",
    texto:
      "Lo que le debes a tus proveedores. Tenerlas a la vista evita la sorpresa de que tres facturas se venzan el mismo viernes.",
    alias: ["cxp", "cuentas por pagar"],
  },
  plazoPago: {
    titulo: "Plazo de pago",
    texto:
      "Los días que te da el proveedor para pagarle, contados desde la factura. «30 días» significa que la factura del 5 de marzo se paga el 4 de abril.",
    alias: ["plazo", "plazo de pago", "dias de credito"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Finanzas
  // ─────────────────────────────────────────────────────────────────────
  pl: {
    titulo: "P&L / Estado de resultados",
    texto:
      "El informe que muestra, mes a mes, cuánto vendiste, cuánto gastaste y cuánto te quedó. «P&L» viene de «profit and loss»: ganancias y pérdidas.",
    alias: ["p&l", "pyg", "estado de resultados", "perdidas y ganancias"],
  },
  flujoCaja: {
    titulo: "Flujo de caja",
    texto:
      "La plata que entra y sale por días, sin importar cuándo se hizo la venta. Sirve para ver si te alcanza para la nómina del viernes, que es distinto de si el mes fue rentable.",
    alias: ["flujo de caja", "flujo"],
  },
  gastoFijo: {
    titulo: "Gasto fijo",
    texto:
      "El que pagas todos los meses vendas o no vendas: arriendo, sueldos, internet. Es el que hay que cubrir sí o sí antes de empezar a ganar.",
    alias: ["gasto fijo", "gastos fijos", "fijo"],
  },
  gastoVariable: {
    titulo: "Gasto variable",
    texto:
      "El que sube y baja con las ventas: empaques, bolsas, comisiones del datáfono, domicilios. Si vendes el doble, este gasto también sube.",
    alias: ["gasto variable", "gastos variables", "variable"],
  },
  conciliacion: {
    titulo: "Conciliación bancaria",
    texto:
      "Comparar lo que dice tu extracto del banco con lo que registraste aquí, para que no se quede nada suelto. Lo que no cuadra se llama partida conciliatoria y toca revisarlo.",
    alias: ["conciliacion", "conciliar", "conciliacion bancaria"],
  },
  extracto: {
    titulo: "Extracto bancario",
    texto:
      "El listado de movimientos que te da el banco del mes. Es la verdad contra la que se compara lo que tú registraste.",
    alias: ["extracto", "extracto bancario"],
  },
  meta: {
    titulo: "Meta",
    texto:
      "El objetivo de ventas que te pones para el mes o la semana. Sirve para ver a mitad de mes si vas bien o si toca apretar, en vez de enterarte el día 30.",
    alias: ["meta", "metas", "objetivo"],
  },
  escenario: {
    titulo: "Escenario",
    texto:
      "Una simulación de cómo te iría si las cosas salen mejor o peor de lo esperado: optimista, realista y pesimista. Sirve para saber cuánto aguantas antes de quedarte sin caja.",
    alias: ["escenario", "escenarios"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Impuestos
  // ─────────────────────────────────────────────────────────────────────
  dian: {
    titulo: "DIAN",
    texto:
      "La entidad que recauda los impuestos en Colombia. Es la que exige la factura electrónica y a la que le entregas el IVA que le cobraste a tus clientes.",
    alias: ["dian"],
  },
  iva: {
    titulo: "IVA",
    texto:
      "El impuesto que le cobras al cliente en la venta y que después le entregas a la DIAN. La tarifa general en Colombia es del 19 %, pero hay productos que pagan menos o no pagan nada.",
    alias: ["iva"],
  },
  ivaGravado: {
    titulo: "IVA gravado",
    texto:
      "El producto sí paga IVA y tú se lo cobras al cliente, casi siempre al 19 %: una gaseosa, un jabón, una cerveza. Es lo más común en una tienda.",
    alias: ["gravado", "gravados"],
  },
  ivaExento: {
    titulo: "IVA exento",
    texto:
      "El producto está dentro del IVA pero con tarifa de 0 %: no le cobras nada al cliente. Es el caso de la carne, la leche, los huevos y el pescado fresco.",
    alias: ["exento", "exentos"],
  },
  ivaExcluido: {
    titulo: "IVA excluido",
    texto:
      "El producto queda por fuera del IVA: ni lo cobras ni lo declaras, como las frutas y verduras frescas. Se parece al exento, pero la DIAN los reporta distinto, así que marca el que sea.",
    alias: ["excluido", "excluidos"],
  },
  inc: {
    titulo: "INC (impuesto al consumo)",
    texto:
      "El impuesto del 8 % que se cobra en restaurantes y bares en vez del IVA. Si vendes comida preparada para consumir ahí, casi seguro es el que te aplica.",
    alias: ["inc", "impoconsumo", "impuesto al consumo"],
  },
  retefuente: {
    titulo: "Retención en la fuente",
    texto:
      "Un adelanto del impuesto de renta que tu cliente empresa te descuenta al pagarte. No lo pierdes: se lo restas a lo que debas en la declaración anual.",
    alias: ["retefuente", "retencion en la fuente", "retencion"],
  },
  reteica: {
    titulo: "ReteICA",
    texto:
      "La retención del impuesto de industria y comercio, que es municipal. La tarifa la pone cada alcaldía y depende de la actividad del negocio.",
    alias: ["reteica", "ica", "industria y comercio"],
  },
  reteiva: {
    titulo: "ReteIVA",
    texto:
      "Cuando un cliente grande te retiene una parte del IVA que le facturaste, en vez de pagártelo todo a ti. Esa parte se la gira él directamente a la DIAN.",
    alias: ["reteiva"],
  },
  uvt: {
    titulo: "UVT",
    texto:
      "La «unidad de valor tributario»: una cifra que la DIAN actualiza cada año y con la que expresa topes y sanciones. En vez de decir «$49.799», la norma dice «1 UVT».",
    alias: ["uvt", "uvts"],
  },
  regimenSimple: {
    titulo: "Régimen simple",
    texto:
      "Un régimen opcional en el que pagas un solo impuesto bimestral en lugar de varios por separado. Suele convenirle a los negocios pequeños, pero hay que inscribirse.",
    alias: ["regimen simple", "simple", "rst"],
  },
  responsableIva: {
    titulo: "Responsable de IVA",
    texto:
      "Si tu negocio está obligado a cobrar IVA y declararlo. Antes se llamaba «régimen común»; el que no lo es —el antiguo «régimen simplificado»— no cobra IVA.",
    alias: ["responsable de iva", "regimen comun"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Facturación electrónica
  // ─────────────────────────────────────────────────────────────────────
  facturaElectronica: {
    titulo: "Factura electrónica",
    texto:
      "La factura oficial que se le manda a la DIAN por internet y que llega al correo del cliente. Es obligatoria para casi todos los negocios formales en Colombia.",
    alias: ["factura electronica", "fe"],
  },
  cufe: {
    titulo: "CUFE",
    texto:
      "El código largo y único que la DIAN le pone a cada factura electrónica, como su huella digital. Con él cualquiera puede verificar en la página de la DIAN que la factura es real.",
    alias: ["cufe"],
  },
  resolucion: {
    titulo: "Resolución de facturación",
    texto:
      "El permiso de la DIAN que dice con qué prefijo y entre qué números puedes facturar, y hasta cuándo. Si se te acaba el rango o se vence, no puedes seguir facturando.",
    alias: ["resolucion", "resoluciones", "vigencias"],
  },
  prefijo: {
    titulo: "Prefijo",
    texto:
      "Las letras que van antes del número de la factura, como «FE» en FE-1024. Te las asigna la DIAN en la resolución y no te las puedes inventar.",
    alias: ["prefijo"],
  },
  rangoNumeracion: {
    titulo: "Rango de numeración",
    texto:
      "Los números que puedes usar para facturar, por ejemplo del 1 al 5.000. Cuando te queden pocos hay que pedirle a la DIAN un rango nuevo antes de que se acabe.",
    alias: ["rango", "rango de numeracion", "numeracion"],
  },
  notaCredito: {
    titulo: "Nota crédito",
    texto:
      "El documento que anula o rebaja una factura ya enviada a la DIAN, porque una factura electrónica no se puede borrar. Es lo que se emite cuando hay una devolución.",
    alias: ["nota credito", "notas credito"],
  },
  notaDebito: {
    titulo: "Nota débito",
    texto:
      "Lo contrario de la nota crédito: aumenta el valor de una factura ya emitida, por ejemplo si se te olvidó cobrar el domicilio.",
    alias: ["nota debito"],
  },
  ubl: {
    titulo: "UBL / XML",
    texto:
      "El formato de archivo en el que viaja la factura hasta la DIAN. No tienes que abrirlo ni entenderlo: se genera solo, pero se guarda porque la DIAN puede pedirlo.",
    alias: ["ubl", "xml"],
  },
  proveedorTecnologico: {
    titulo: "Proveedor tecnológico",
    texto:
      "La empresa autorizada por la DIAN que transmite tus facturas. El sistema se conecta con ella; tú solo facturas.",
    alias: ["proveedor tecnologico", "pt"],
  },
  ambientePruebas: {
    titulo: "Ambiente de pruebas",
    texto:
      "El modo en que la DIAN te deja practicar antes de facturar de verdad. Las facturas de pruebas no valen como documento legal: son un ensayo.",
    alias: ["ambiente de pruebas", "habilitacion", "pruebas"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Identificación
  // ─────────────────────────────────────────────────────────────────────
  nit: {
    titulo: "NIT",
    texto:
      "El número de identificación tributaria de una empresa, el equivalente a la cédula de una persona. Se necesita para facturarle a un negocio.",
    alias: ["nit"],
  },
  dv: {
    titulo: "Dígito de verificación (DV)",
    texto:
      "El número suelto que va después del NIT, separado por un guion: 900123456-7. Lo calcula la DIAN y sirve para detectar NIT mal escritos.",
    alias: ["dv", "digito de verificacion"],
  },
  rut: {
    titulo: "RUT",
    texto:
      "El documento de la DIAN donde dice quién eres ante ellos: tu NIT, tu régimen y las actividades que puedes ejercer. Te lo piden para abrir cuentas y para facturar a empresas.",
    alias: ["rut"],
  },
  tipoDocumento: {
    titulo: "Tipo de documento",
    texto:
      "Con qué se identifica la persona: CC es cédula de ciudadanía, CE cédula de extranjería, TI tarjeta de identidad, PA pasaporte y PEP el permiso para venezolanos.",
    alias: ["tipo doc", "tipo de documento", "cc", "ce", "pep"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Nómina y personal
  // ─────────────────────────────────────────────────────────────────────
  nomina: {
    titulo: "Nómina",
    texto:
      "El pago de los sueldos del período y todo lo que lo acompaña: horas extras, descuentos y aportes. Se liquida normalmente cada quincena o cada mes.",
    alias: ["nomina"],
  },
  smmlv: {
    titulo: "SMMLV",
    texto:
      "El salario mínimo mensual legal vigente, que el Gobierno fija cada año. Muchos cálculos de nómina se miden en múltiplos de él.",
    alias: ["smmlv", "salario minimo", "sueldo minimo", "minimo legal"],
  },
  devengado: {
    titulo: "Devengado",
    texto:
      "Todo lo que el trabajador se ganó en el período antes de descuentos: sueldo, horas extras, auxilio de transporte y comisiones.",
    alias: ["devengado", "devengados", "total devengado"],
  },
  deduccion: {
    titulo: "Deducción",
    texto:
      "Lo que se le descuenta al trabajador del sueldo: salud, pensión, préstamos y lo que consumió en el negocio. Se resta del devengado.",
    alias: ["deduccion", "deducciones", "descuento"],
  },
  netoPagar: {
    titulo: "Neto a pagar",
    texto:
      "La plata que de verdad recibe el trabajador: el devengado menos las deducciones. Es lo que sale de tu cuenta el día de pago.",
    alias: ["neto", "neto a pagar"],
  },
  auxilioTransporte: {
    titulo: "Auxilio de transporte",
    texto:
      "Un valor que el Gobierno fija cada año y que debes pagarle a quien gane hasta dos salarios mínimos. No hace parte del sueldo, pero sí se usa para calcular prima y cesantías.",
    alias: ["auxilio de transporte", "auxilio"],
  },
  horasExtra: {
    titulo: "Horas extra",
    texto:
      "Las que se trabajan por encima de la jornada legal. Se pagan con recargo: 25 % más si son de día y 75 % más si son de noche.",
    alias: ["horas extra", "horas extras", "extras"],
  },
  recargoNocturno: {
    titulo: "Recargo nocturno",
    texto:
      "El 35 % adicional por trabajar entre las 9 de la noche y las 6 de la mañana, aunque no sea hora extra. Si además es domingo o festivo, los recargos se suman.",
    alias: ["recargo nocturno", "nocturno", "recargo"],
  },
  dominicales: {
    titulo: "Dominicales y festivos",
    texto:
      "Trabajar domingo o festivo se paga con un 75 % de recargo, y además da derecho a un día compensatorio si se hace habitualmente.",
    alias: ["dominicales", "festivos", "dominical"],
  },
  prima: {
    titulo: "Prima de servicios",
    texto:
      "Un sueldo extra al año que se paga en dos mitades: la primera en junio y la segunda en diciembre. Es obligatoria para todo trabajador con contrato laboral.",
    alias: ["prima", "prima de servicios"],
  },
  cesantias: {
    titulo: "Cesantías",
    texto:
      "Un mes de sueldo por cada año trabajado, que se consigna en un fondo antes del 14 de febrero. Es el ahorro del trabajador para cuando se quede sin empleo.",
    alias: ["cesantias"],
  },
  interesesCesantias: {
    titulo: "Intereses de cesantías",
    texto:
      "El 12 % anual sobre las cesantías, que se le paga directamente al trabajador a más tardar el 31 de enero.",
    alias: ["intereses de cesantias", "intereses"],
  },
  vacaciones: {
    titulo: "Vacaciones",
    texto:
      "15 días hábiles de descanso pagado por cada año trabajado. Se pueden acumular hasta dos períodos, pero no se deberían dejar vencer.",
    alias: ["vacaciones"],
  },
  liquidacion: {
    titulo: "Liquidación",
    texto:
      "La cuenta final cuando alguien se retira: lo que se le debe de sueldo, prima, cesantías y vacaciones hasta ese día. Hay que pagarla al terminar el contrato.",
    alias: ["liquidacion", "liquidar"],
  },
  eps: {
    titulo: "EPS",
    texto:
      "La entidad de salud a la que está afiliado el trabajador. El aporte es del 12,5 % del sueldo: el 8,5 % lo pones tú y el 4 % se le descuenta a él.",
    alias: ["eps", "salud"],
  },
  afp: {
    titulo: "AFP (pensión)",
    texto:
      "El fondo donde se ahorra la pensión del trabajador, como Porvenir o Colpensiones. El aporte es del 16 %: 12 % tuyo y 4 % descontado al trabajador.",
    alias: ["afp", "pension", "fondo de pension"],
  },
  arl: {
    titulo: "ARL",
    texto:
      "El seguro contra accidentes de trabajo. Lo pagas tú por completo y la tarifa depende de qué tan riesgoso sea el oficio.",
    alias: ["arl", "riesgos laborales"],
  },
  nivelRiesgo: {
    titulo: "Nivel de riesgo ARL",
    texto:
      "Qué tan peligroso es el cargo, del I al V. Un cajero suele ser nivel I (0,522 %) y alguien que maneja moto o maquinaria puede llegar a nivel IV o V.",
    alias: ["nivel de riesgo", "riesgo arl"],
  },
  cajaCompensacion: {
    titulo: "Caja de compensación",
    texto:
      "Entidades como Comfama o Compensar, a las que aportas el 4 % del sueldo. Le dan al trabajador subsidio familiar, recreación y créditos.",
    alias: ["caja de compensacion", "compensacion", "ccf"],
  },
  fondoCesantias: {
    titulo: "Fondo de cesantías",
    texto:
      "Donde se guardan las cesantías del trabajador hasta que las necesite: Porvenir, Protección, Colfondos o el FNA. Él escoge cuál.",
    alias: ["fondo de cesantias", "cesantias fondo"],
  },
  pila: {
    titulo: "PILA",
    texto:
      "La planilla única con la que se pagan de una sola vez salud, pensión, ARL y parafiscales de todos los empleados. Se paga cada mes según el último dígito del NIT.",
    alias: ["pila", "planilla", "seguridad social", "aportes"],
  },
  parafiscales: {
    titulo: "Parafiscales",
    texto:
      "Los aportes al SENA (2 %), el ICBF (3 %) y la caja de compensación (4 %). Los paga el empleador y no se le descuentan al trabajador.",
    alias: ["parafiscales", "parafiscal"],
  },
  salarioIntegral: {
    titulo: "Salario integral",
    texto:
      "Un sueldo alto (mínimo 13 salarios mínimos) que ya incluye prima, cesantías y recargos en un solo valor. Solo se puede pactar por escrito.",
    alias: ["salario integral", "integral"],
  },
  contratoObraLabor: {
    titulo: "Contrato por obra o labor",
    texto:
      "Dura lo que dure el trabajo para el que se contrató, sin fecha fija de fin. Cuando la obra termina, termina el contrato.",
    alias: ["obra o labor", "obra labor"],
  },
  contratoAprendizaje: {
    titulo: "Contrato de aprendizaje",
    texto:
      "El del aprendiz del SENA. Tiene reglas propias: en la etapa lectiva se paga el 50 % del mínimo y en la práctica el 75 %.",
    alias: ["aprendizaje", "aprendiz", "sena"],
  },
  consumoEmpleado: {
    titulo: "Consumo de empleado",
    texto:
      "Lo que el trabajador se lleva o consume del negocio y se le descuenta después de la nómina: el almuerzo, una gaseosa, un producto fiado.",
    alias: ["consumo", "consumos"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Organización y configuración
  // ─────────────────────────────────────────────────────────────────────
  sede: {
    titulo: "Sede",
    texto:
      "Cada local o punto de venta de tu negocio. Cada sede tiene su propio inventario y su propia caja, y los reportes los puedes ver por separado o todos juntos.",
    alias: ["sede", "sedes", "sucursal"],
  },
  rol: {
    titulo: "Rol",
    texto:
      "Un paquete de permisos con nombre: «Cajero», «Administrador», «Dueño». En vez de darle permisos uno por uno a cada persona, le asignas un rol.",
    alias: ["rol", "roles"],
  },
  permiso: {
    titulo: "Permiso",
    texto:
      "La autorización para hacer una cosa concreta: ver inventario, anular una venta, abrir caja. Quien no lo tenga, ni siquiera ve el botón.",
    alias: ["permiso", "permisos"],
  },
  cargo: {
    titulo: "Cargo",
    texto:
      "El puesto que ocupa la persona en el negocio: cajero, cocinero, mesero. Es distinto del rol: el cargo es laboral, el rol dice qué puede tocar en el sistema.",
    alias: ["cargo", "cargos", "puesto"],
  },
  auditoria: {
    titulo: "Auditoría",
    texto:
      "El registro de quién hizo qué y cuándo: quién anuló una venta, quién cambió un precio, quién ajustó el inventario. No se puede borrar ni editar.",
    alias: ["auditoria", "bitacora", "trazabilidad"],
  },
  parametros: {
    titulo: "Parámetros",
    texto:
      "Los valores que rigen todo el sistema: tarifas de impuestos, salario mínimo, porcentaje de propina, moneda. Se configuran una vez y aplican a todas las sedes.",
    alias: ["parametros", "configuracion"],
  },
  plan: {
    titulo: "Plan",
    texto:
      "El paquete que tienes contratado y qué módulos incluye. Si un módulo aparece bloqueado es porque tu plan no lo trae, no porque esté dañado.",
    alias: ["plan", "suscripcion"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Restaurante
  // ─────────────────────────────────────────────────────────────────────
  mesa: {
    titulo: "Mesa",
    texto:
      "Cada puesto del salón al que se le abre una cuenta. El pedido se le va cargando y solo se cobra cuando el cliente pide la cuenta.",
    alias: ["mesa", "mesas"],
  },
  comanda: {
    titulo: "Comanda",
    texto:
      "El pedido que sale hacia la cocina con lo que hay que preparar. Es lo que evita que el mesero tenga que ir a gritarlo.",
    alias: ["comanda", "comandas"],
  },
  domicilio: {
    titulo: "Domicilio",
    texto:
      "El pedido que se lleva a la casa del cliente. Suele tener un costo aparte y, si entra por una aplicación, una comisión que te descuentan.",
    alias: ["domicilio", "domicilios"],
  },
} as const satisfies Record<string, EntradaGlosario>

/** Términos válidos del glosario. `HelpTip` lo usa para validar en compilación. */
export type TerminoGlosario = keyof typeof GLOSARIO

/** Lista ordenada alfabéticamente por título. La usa el buscador del glosario. */
export const TERMINOS_GLOSARIO = (
  Object.keys(GLOSARIO) as TerminoGlosario[]
).sort((a, b) => GLOSARIO[a].titulo.localeCompare(GLOSARIO[b].titulo, "es"))

/**
 * Lee una entrada con el tipo ancho `EntradaGlosario`.
 *
 * `as const satisfies` es lo que da el autocompletado y valida en compilación
 * que ninguna entrada se quede sin título, pero a cambio cada una queda con su
 * tipo literal exacto: las que no declaran `alias` no tienen la propiedad y
 * TypeScript se niega a leerla. Este acceso las devuelve todas al tipo común.
 */
export function obtenerEntrada(clave: TerminoGlosario): EntradaGlosario {
  return GLOSARIO[clave]
}

/** Quita tildes y pasa a minúsculas, para comparar "Kárdex" con "kardex". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Índice palabra → término, construido una sola vez. Incluye la clave, el
 * título y los alias de cada entrada, todos normalizados.
 */
const INDICE: ReadonlyMap<string, TerminoGlosario> = (() => {
  const mapa = new Map<string, TerminoGlosario>()
  for (const clave of Object.keys(GLOSARIO) as TerminoGlosario[]) {
    const entrada = obtenerEntrada(clave)
    const llaves = [clave, entrada.titulo, ...(entrada.alias ?? [])]
    for (const llave of llaves) {
      const k = normalizar(llave)
      // El primero gana: así una clave explícita no la pisa el alias de otro.
      if (k && !mapa.has(k)) mapa.set(k, clave)
    }
  }
  return mapa
})()

/**
 * Busca el término del glosario que corresponde a una palabra escrita en la
 * interfaz. Tolera tildes, mayúsculas y las variantes registradas como alias,
 * así que `resolverTermino("Kárdex")`, `("kardex")` y `("movimientos")`
 * devuelven lo mismo.
 */
export function resolverTermino(palabra: string): TerminoGlosario | undefined {
  const k = normalizar(palabra)
  const directo = INDICE.get(k)
  if (directo) return directo

  // Plural → singular, en las dos direcciones. Sin esto habría que registrar
  // cada término dos veces ("orden de compra" y "órdenes de compra"), y en una
  // tabla las cabeceras van casi siempre en plural mientras el glosario define
  // el concepto en singular. Solo aplica a la última palabra: en "órdenes de
  // compra" la que se pluraliza es la primera, así que se prueban ambas.
  for (const variante of variantesDeNumero(k)) {
    const hallado = INDICE.get(variante)
    if (hallado) return hallado
  }
  return undefined
}

/** Formas en singular/plural que vale la pena probar para una expresión. */
function variantesDeNumero(k: string): string[] {
  const out: string[] = []
  const singularizar = (w: string) =>
    w.endsWith("es") && w.length > 4
      ? [w.slice(0, -2), w.slice(0, -1)]
      : w.endsWith("s") && w.length > 3
        ? [w.slice(0, -1)]
        : []
  const pluralizar = (w: string) =>
    /[aeiou]$/.test(w) ? [`${w}s`] : [`${w}es`, `${w}s`]

  const palabras = k.split(" ")
  for (const indice of [palabras.length - 1, 0]) {
    const w = palabras[indice]
    if (!w) continue
    for (const alterna of [...singularizar(w), ...pluralizar(w)]) {
      const copia = [...palabras]
      copia[indice] = alterna
      out.push(copia.join(" "))
    }
  }
  return out
}

/** Filtra el glosario por título, texto o alias. Para el buscador. */
export function buscarGlosario(consulta: string): TerminoGlosario[] {
  const q = normalizar(consulta)
  if (!q) return TERMINOS_GLOSARIO
  return TERMINOS_GLOSARIO.filter((clave) => {
    const e = obtenerEntrada(clave)
    return (
      normalizar(e.titulo).includes(q) ||
      normalizar(e.texto).includes(q) ||
      (e.alias ?? []).some((a) => normalizar(a).includes(q))
    )
  })
}
