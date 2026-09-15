# Historial de versiones — BookiPos (frontend)

Qué cambió en cada versión y cuándo, contado desde lo que ve quien usa el
sistema. Lo del lado del servidor está en el `CHANGELOG.md` de `Backend_booki`:
los dos repos comparten número de versión porque se despliegan juntos.

## Cómo se numera

`MAYOR.MENOR.PARCHE` — por ejemplo `1.1.0`.

| Cuál sube | Cuándo | Ejemplo |
|---|---|---|
| **Parche** (1.1.**0** → 1.1.**1**) | Se arregló algo que estaba mal, sin funciones nuevas | El total de una cuenta salía mal |
| **Menor** (1.**1**.0 → 1.**2**.0) | Funciones nuevas, sin romper lo que ya había | Esta entrega |
| **Mayor** (**1**.1.0 → **2**.0.0) | Algo dejó de funcionar como antes y hay que adaptarse | Cambiar cómo se guardan los precios y tener que migrar datos |

**Cuándo se sube el número:** al mezclar a `main` un grupo de cambios que ya es
una entrega — no en cada PR. Un PR suelto no cambia la versión; lo que la cambia
es decidir "esto ya es lo que va a usar el negocio".

---

## 1.4.0 — 14 de septiembre de 2026

Sale del primer día de carga real de datos en Crunchy Munch.

> **Se despliega DESPUÉS del backend 1.4.0.** La pantalla de roles guarda
> permisos de Dueño y Administrador, y el backend viejo los rechaza.

### El costo de la mercancía lo pone la entrada, no el alta del insumo

Se auditó un descuadre concreto: **una factura de $680 dejaba el inventario
valorado en $500**. No era un error de cuentas — la valoración estaba bien
hecha— sino del formulario, y la cadena era esta:

1. La ficha del insumo pedía un **"precio de compra"**, que casi siempre se
   escribía a ojo: al dar de alta un insumo todavía no se tiene la factura
   delante.
2. Al registrar la entrada de mercancía, la casilla del costo aparecía **ya
   rellena con ese número**.
3. El costo era **opcional**. Quien recibía una factura de $680 veía un $500
   puesto de antemano, lo daba por bueno y guardaba.
4. La mercancía entraba valorada a $500 y **nada avisaba**, porque para el
   sistema ese $500 lo había confirmado una persona.

Qué cambia:

- **Desaparece "precio de compra" de la ficha del insumo**, para todos los tipos
  (producto, ingrediente y montaje). Era lo que pedía el dueño y además era la
  raíz del descuadre.
- Esa ficha **deja de mandar el campo del costo**, ni al crear ni al editar. Sin
  casilla habría mandado un 0, y ese 0 habría borrado el costo que las entradas
  llevaban construido.
- En la entrada, **el costo es obligatorio y arranca en blanco**. Lo que se pagó
  la vez pasada se muestra debajo como dato —"La vez pasada lo compraste a
  $500 el bulto"—, que sirve para notar una subida y no se puede guardar sin
  querer.

Si de verdad no se sabe lo que costó algo que entra, para eso está el ajuste,
que no pretende ser una compra.

### Roles

Los roles que trae el sistema —Dueño, Administrador, Gerente, Cajero— ya se
pueden ajustar. Al abrir uno sin tocar, la ficha avisa de lo que implica: tal
como viene, cada función nueva de BookiPos le llega sola; una vez ajustado,
manda lo que quede escrito y las funciones que salgan después hay que dárselas.

---

## 1.3.0 — 13 de septiembre de 2026

Solo frontend. **El backend se queda en 1.2.0** y no hay que desplegarlo: esta
entrega no manda ni un campo nuevo, no pide variables de entorno, no migra nada
y no añade permisos. Se puede mezclar sola.

Sale de lo que el dueño echó de menos al usar la 1.2.0: que el orden de las
pantallas no se entendía, que las cifras largas se leían mal, que la tarjeta de
novedades era ilegible y que el cobro desperdiciaba media pantalla.

### Inventario y Productos — el orden, por fin escrito

El sistema siempre dio por supuesto un orden —primero registras lo que compras,
después armas lo que vendes— que no estaba dicho en ninguna pantalla. Quien
entraba a **Productos → Nuevo** y escogía "Del inventario" se encontraba un
desplegable vacío y ninguna pista de por qué: parecía que el programa estaba
roto.

- **Tira de tres pasos** en Productos: Inventario → Productos → Punto de venta,
  con una frase de qué se hace en cada uno y enlace a los tres. Se puede cerrar
  y se queda cerrada.
- **Estado vacío** cuando no hay nada en inventario: en vez de una tabla vacía,
  la explicación de por qué hace falta —sin eso el sistema no puede descontar
  existencias ni calcular la ganancia— y el botón para ir a crearlo.
- **Dentro de la ficha del producto**, si el inventario está vacío el buscador
  se sustituye por el aviso y el camino de salida. Si hay ítems, cada opción
  muestra en qué se mide y cuántas existencias tiene: quien pone el precio
  necesita saber si está cobrando por gramo o por unidad.
- **La pestaña "Productos" del inventario pasa a llamarse "Insumos y
  mercancía".** Se llamaba igual que la pantalla Productos del menú y eran cosas
  distintas.
- **Cada pestaña del inventario dice qué se ve en ella** en una frase.
- **Los botones sueltos de la cabecera** (conteo, merma, importar, exportar,
  actualizar precios) se agruparon en un menú **Herramientas**, cada uno con su
  frase de qué hace. "Conteo" o "Merma" no le dicen nada a quien nunca los ha
  usado, y probarlos para averiguarlo da miedo en una pantalla que toca el
  inventario.

### Unidades de medida

- **Se leen completas y agrupadas**: "se cuenta de a uno" (unidad), "se pesa"
  (gramo, kilogramo, libra, arroba) y "se mide líquido" (mililitro, litro).
  Antes era una lista de seis abreviaturas —`g`, `kg`, `lb`, `l`, `ml`— y no
  había forma de saber si `lb` era libra o litro.
- **La arroba, que no existía**: 12,5 kg exactos. Es como se compra media
  Colombia —panela, papa, queso, café— y no estaba por ningún lado.
- **La libra pasa de 453,592 g a 500 g.** Es un cambio de comportamiento, no una
  función nueva: el sistema traía la libra internacional y aquí nadie compra con
  esa. Al pedir "una libra de mantequilla" llegan 500 gramos, así que registrar
  453,592 metía a la bodega un 9 % menos de lo que de verdad entró. Con 500
  cuadra además el resto del sistema: una arroba son 25 libras y 12,5 kg, cuenta
  que no sale con la libra internacional. **Solo afecta a las entradas de
  mercancía que se escriban en libras a partir de ahora**; lo ya guardado no se
  toca, porque lo que se guarda son las unidades de consumo, no las libras.
- **El bulto va en la presentación de compra, no entre las unidades.** Un bulto
  no es una medida, es un empaque: el de harina trae 25 kg, el de papa 50 y el
  de arroz 12,5. Guardado como unidad, el sistema sabría "tres bultos" y no
  cuánta harina hay. La presentación ahora sugiere bulto, arroba, kilo, libra,
  saco, garrafa, litro, botella, caja, paquete, canasta y docena, y rellena el
  contenido de las que tienen uno fijo.

### Las cifras, con el punto de los miles

`45000` y `450000` se ven casi iguales en una casilla numérica del navegador, y
un cero de más en un precio no lo ve nadie hasta que se cobró mal. Ahora se
escribe **$45.000** mientras se teclea, en Inventario, Productos, Producción,
listas de precios, comandas de restaurante, órdenes de compra y descuentos de
sede. Las cantidades también (**25.000 g**), con la unidad dentro del campo.

El costo por unidad de consumo admite decimales, que es donde hacen falta: un
bulto de $95.000 con 25.000 g da $3,80 el gramo, y redondear a $4 inflaría cada
receta. El costo de una orden de compra **no** los admite, porque río abajo se
guarda redondeado a peso entero y dejar escribirlos sería guardar otra cosa sin
avisar.

### Punto de venta — el cobro usa el monitor entero

El modal de cobro era una columna de 512 px con catorce bloques apilados —medio
de pago, devuelta, cliente, vendedor, dividir la cuenta, domicilio, fiado y
factura electrónica— mientras el resto del monitor quedaba en gris. Y el scroll
movía el velo entero, no el cuerpo: al bajar a buscar la devuelta se iban de la
pantalla el título y el botón de cobrar, y el detalle de lo que se estaba
cobrando quedaba tapado por el velo. El cajero confirmaba a ciegas.

- **Tres columnas en PC**, apiladas en móvil: *qué estás cobrando* (el ticket,
  con el total fijo abajo), *cómo paga* (medio de pago, con cuánto paga y la
  devuelta en grande) y *de quién es la venta* (cliente, vendedor, tipo de
  pedido, dividir la cuenta, factura electrónica).
- **Cabecera y pie no se mueven.** El total y el botón de cobrar están siempre a
  la vista, por largo que sea el formulario.
- **Lo que casi nunca se toca va plegado**, con un resumen de una línea que dice
  cómo quedó ("Consumidor final", "Mostrador"). Es la respuesta al "tenemos
  demasiadas opciones": siguen todas, pero no gritando a la vez. Si un bloque
  pide un dato sin el que no se puede cobrar, el plegado desaparece.
- **Enter sigue cobrando y Escape sigue cerrando.** Enter solo cobra desde el
  campo del efectivo o con el foco fuera de todo control: si cobrara desde
  cualquier campo, teclear el nombre de un cliente y pulsar Enter registraría la
  venta a media faena.
- **Menos huecos vacíos en el terminal**: la rejilla sube a cuatro columnas en
  monitores anchos y el catálogo llega a seis, en vez de dejar filas de tres
  productos con medio monitor en blanco.

### Formularios que scrollean donde deben

El mismo fallo estaba en varios sitios: el velo hacía de contenedor con scroll y
la tarjeta crecía sin límite, así que en una pantalla corta el título se iba por
arriba y los botones por abajo a la vez. Arreglado en el cobro del POS, la
nómina del POS, la bienvenida, el buscador (Ctrl K) y la tarjeta de novedades:
cabecera y pie fijos, scroll solo en el cuerpo y alto medido en `svh` —con `vh`
el modal se sale por abajo justo cuando aparece el teclado del celular.

### Novedades

La tarjeta de novedades era una lista de cinco párrafos en letra pequeña, sin
una sola imagen y sin forma de llegar a lo que anunciaba. Ahora son **tres
páginas**, una idea por página, con letra grande, un esquema dibujado por página
y **un botón por novedad que cierra la tarjeta y abre esa pantalla**. Se pasa de
página con los botones, con los puntos de abajo o con las flechas del teclado.

---

## 1.2.0 — 12 de septiembre de 2026

Lo que salió de usar la 1.1.0 detrás del mostrador. Sin variables de entorno
nuevas, sin migraciones y sin permisos nuevos.

> **Se despliega DESPUÉS del backend 1.2.0, no antes.** El cobro manda dos
> campos nuevos (`seller` y `packaging`) y la ficha del producto manda
> `packaging`. El backend viejo valida con `forbidNonWhitelisted`, así que los
> rechazaría: con el frontend nuevo y el backend viejo **no se podría cobrar**.

### Punto de venta — al cobrar

- **Devuelta exacta.** "¿Con cuánto paga?" va justo debajo del medio de pago,
  en pesos con puntos de miles, y la devuelta sale en grande; si no alcanza,
  dice cuánto falta. Enter confirma el cobro. Antes era una casilla numérica
  del navegador, donde "75.400" se podía leer como 75,4 pesos, y el botón
  "Exacto" no contaba la propina ni el domicilio. La pantalla de "venta
  registrada" repite la devuelta en grande, y el recibo dice "Devuelta".
- **Cliente.** Consumidor final o cliente registrado, con "Agregar cliente"
  sin salir del cobro. Consumidor final viaja como la DIAN lo nombra
  (`222222222222`), así que puede llevar factura electrónica. Elegir un cliente
  registrado ahora copia su nombre y documento a la venta: antes la venta
  quedaba sin nombre.
- **Vendedor.** Quien cobra, o cualquier empleado de la lista. Queda en el
  recibo y en Ventas. No se reinicia entre ventas: suele ser la misma persona
  todo el turno.
- **Empaque extra.** La bolsa de más de este cobro. Sale del inventario y suma
  al costo; no se le cobra al cliente.
- **Cada venta empieza limpia.** Cliente, lista de precios, factura electrónica
  y empaque extra ya no se heredan de la venta anterior.

### Punto de venta — buscador

Barra de arriba, o Ctrl K. Busca a la vez en pantallas, productos para vender,
existencias, cuentas abiertas, ventas (por número, cliente, vendedor o producto)
y clientes. Tocar un resultado lleva a esa pantalla ya filtrada (`lib/pos/busqueda.ts`).

Busca por palabras y sin tildes. Los filtros de Venta, Ventas e Inventario
también: con la frase entera, "galleta chocolate" no encontraba "Galleta de
chocolate", que es por lo que el buscador parecía no servir.

### Productos

- **Empaque.** Sección nueva en la ficha del producto: qué bolsa, caja o vaso
  gasta cada unidad vendida. Sirve para los productos del inventario y los de
  receta. El listado lo muestra debajo de lo que descuenta cada producto.

### Novedades

La tarjeta sale **cada vez que se inicia sesión** (y al abrir el navegador de
nuevo), una sola vez por sesión. Antes, cerrada con "Entendido", no volvía a
salir para esa versión. La marca pasó de `localStorage` a `sessionStorage`.

---

## 1.1.1 — 12 de septiembre de 2026

**Tarjeta de novedades.** Al entrar al panel o al terminal aparece una tarjeta
con lo que trae la última versión.

Va aparte de la 1.1.0 porque no cambia lo que el sistema hace por el negocio:
solo cuenta lo que ya se había entregado. Por eso la tarjeta dice "Versión
1.1.0" — es la versión que anuncia, no la que la trae.

Existe porque nadie lee un historial de versiones en GitHub: quien usa esto está
detrás de un mostrador, y una función nueva que no se anuncia dentro de la
aplicación sencillamente no existe.

Cuándo sale, en `src/lib/novedades.ts`: con cada versión nueva, y después una
vez al día hasta que la persona la cierra con "Entendido". Cerrarla es decir "ya
la leí" y no vuelve a salir para esa versión. No bloquea nada — se quita con
Escape o tocando fuera.

Para anunciar la próxima versión basta con cambiar `NOVEDADES`: el número de
versión es la clave, y en cuanto no coincide con el que la persona vio, la
tarjeta vuelve a salir.

---

## 1.1.0 — 12 de septiembre de 2026

Diez funcionalidades nuevas, en veinte pull requests. **Nada de esto requirió
tocar Vercel ni Atlas.**

### Inventario

- **Presentación de compra.** En la ficha del insumo se define cómo llega del
  proveedor: "bulto de 25 kg". De ahí salen los precios, las entradas y los
  costos de las recetas. Se borró el parche que adivinaba gramos→kilos.
  *Al estrenarlo, el diálogo "Actualizar precios" ofrece un botón que deja por
  escrito lo que la pantalla ya venía suponiendo, sin cambiar ningún precio.*
- **Conteo.** Planilla con todos los productos de la sede, esperado contra
  contado, y todos los ajustes de un golpe. Se puede imprimir en blanco para
  recorrer la bodega. Una casilla vacía significa "no lo conté", nunca "hay
  cero".
- **Rastrear lote.** Se escribe el código y sale la cadena completa: a qué
  tandas entró, en qué lotes salió y a qué clientes llegó, con teléfono.
- **Merma.** Qué se botó, por qué y cuánto costó, de mayor a menor plata
  perdida.

### Ventas y clientes

- **Listas de precios.** Se administran en Productos y se asignan al cliente en
  su ficha. Se cobran solas, sin que el cajero tenga que acordarse.
- **Devolución parcial.** Sobre una venta, se devuelven solo las unidades que
  volvieron, con su motivo, diciendo si vuelven al estante o a la basura y cómo
  se devuelve la plata.
- **Dividir la cuenta.** Por ítem o en partes iguales; la mesa queda abierta
  hasta que no falte nada. El total de una cuenta de mesa ahora es lo que falta,
  no el total de la comanda.

### Domicilios

- **Zonas con tarifa fija** en la ficha de la sede, más valor a mano para el
  pedido raro.
- **Tipo de pedido en el cobro** (mostrador, mesa, para llevar, domicilio) con
  dirección, teléfono, indicaciones y repartidor. El cobro se suma al total en
  vivo.
- **Pestaña Domicilios** con las entregas del día, el teléfono como enlace para
  llamar, y el cuadre de cuánta plata trae cada repartidor.

### Compras

- **Factura por foto en bultos.** Cada renglón trae una casilla "Viene en
  bultos (de 25 kg)" que llega marcada cuando el producto tiene presentación, y
  muestra cuánto entra de verdad al inventario.

---

## 1.0.0 — antes del 12 de septiembre de 2026

Lo que ya estaba funcionando: web pública, panel de operación y punto de venta,
con 38 formularios en tarjeta flotante y un glosario de 127 términos.

No hay historial detallado de esta versión: el número se empezó a llevar a
partir de la 1.1.0, y se le puso 1.0.0 a lo que ya estaba en uso.
