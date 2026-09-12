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
