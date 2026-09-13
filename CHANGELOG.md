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
