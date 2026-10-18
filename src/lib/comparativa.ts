/**
 * Datos de la comparativa pública (ítem 7.7).
 *
 * Regla: de BookiPos afirmamos lo que hace hoy; de las demás marcas solo
 * etiquetas prudentes según sus sitios públicos a la fecha indicada, o
 * «Verifícalo en su sitio» cuando no hay certeza. Sin precios de terceros.
 * Actualizar `fecha` cada vez que se revise la tabla.
 */
export const COMPETIDORES = ["Siigo", "Alegra", "Loggro"] as const;

export const NO_VERIFICADO = "Verifícalo en su sitio";

type Fila = {
  capacidad: string;
  bookipos: string;
  otros: readonly [string, string, string];
};

const SIN_DATO = [NO_VERIFICADO, NO_VERIFICADO, NO_VERIFICADO] as const;

export const COMPARATIVA: {
  fecha: string;
  descargo: string;
  diferenciales: readonly { titulo: string; texto: string }[];
  filas: readonly Fila[];
} = {
  fecha: "octubre de 2026",
  descargo:
    "Siigo, Alegra y Loggro son marcas de sus respectivos dueños y no tienen relación con BookiPos. Esta comparación es orientativa: se basa en lo que cada marca publica en su sitio a la fecha indicada, y sus planes y funciones cambian. Donde no estamos seguros lo decimos así. Antes de decidir, confirma con cada proveedor. Si ves un dato desactualizado, escríbenos y lo corregimos.",
  diferenciales: [
    {
      titulo: "Costo real por receta",
      texto:
        "Cada plato se costea con los precios de tus últimas compras, así ves el margen real y no el que supones.",
    },
    {
      titulo: "Compras por foto",
      texto:
        "Fotografías la factura del proveedor y BookiPos propone los ítems para que los revises, en vez de digitarlos uno a uno.",
    },
    {
      titulo: "Todo en un solo sistema",
      texto:
        "Punto de venta, inventario, compras, nómina y contabilidad hablan entre sí: una venta o una compra generan su asiento solos.",
    },
  ],
  filas: [
    { capacidad: "Costo real por receta", bookipos: "Incluido", otros: SIN_DATO },
    {
      capacidad: "Compras a partir de la foto de la factura",
      bookipos: "Incluido",
      otros: SIN_DATO,
    },
    {
      capacidad: "Punto de venta e inventario en el mismo sistema",
      bookipos: "Incluido",
      otros: SIN_DATO,
    },
    {
      capacidad: "Contabilidad que se alimenta sola de ventas y compras",
      bookipos: "Incluido",
      otros: SIN_DATO,
    },
    {
      capacidad: "Nómina con asistencia y turnos",
      bookipos: "Incluido",
      otros: SIN_DATO,
    },
  ],
};
