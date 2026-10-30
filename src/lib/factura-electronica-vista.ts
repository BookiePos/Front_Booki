/**
 * Qué muestra la factura electrónica impresa a partir del documento que guarda
 * el backend (`documento-venta.ts`, Fase 2 del estudio de FE).
 *
 * Los documentos anteriores a la Fase 2 no traen `payableAmount`: se leen como
 * antes (IVA por línea con `ivaRate`, totales base + IVA). Los nuevos traen el
 * tributo de cada línea y los totales por tributo, y las filas suman el TOTAL.
 */

interface LineaVista {
  ivaRate: number
  taxScheme?: "01" | "04"
  taxRate?: number
  perUnitTax?: { unidades: number; valorUnitario: number; valor: number }
}

interface DocumentoVista {
  taxableBase: number
  ivaTotal: number
  discountTotal: number
  total: number
  incTotal?: number
  icaTotal?: number
  bagTaxTotal?: number
  charges?: { chargeIndicator: boolean; reason: string; amount: number }[]
  chargeTotal?: number
  payableAmount?: number
}

/** El documento trae los campos de la Fase 2. */
export function esDocumentoConTributos(doc: Pick<DocumentoVista, "payableAmount">): boolean {
  return doc.payableAmount !== undefined && doc.payableAmount !== null
}

/** Tributo y tarifa de una línea: «IVA 19 %», «INC 8 %», «Exento», «Sin impuesto». */
export function etiquetaTributo(l: LineaVista, conTributos: boolean): string {
  if (!conTributos) return `IVA ${l.ivaRate}%`
  const tarifa = l.taxRate ?? 0
  if (l.taxScheme === "04") return `INC ${tarifa}%`
  if (l.taxScheme === "01") return tarifa > 0 ? `IVA ${tarifa}%` : "Exento"
  return "Sin impuesto"
}

/** Detalle del INC de bolsas de una línea, o `undefined` si no lleva. */
export function detalleBolsa(
  l: LineaVista,
  fmt: (n: number) => string,
): string | undefined {
  const b = l.perUnitTax
  if (!b || b.valor <= 0) return undefined
  return `INC bolsas ${b.unidades} × ${fmt(b.valorUnitario)} = ${fmt(b.valor)}`
}

export interface FilaTotal {
  clave: string
  label: string
  value: number
}

/**
 * Filas de totales sobre el TOTAL. En un documento nuevo: base, IVA, INC, ICA,
 * INC de bolsas y propina (solo las que tienen valor, salvo base e IVA), y su
 * suma es `payableAmount`. En uno viejo: base e IVA, como antes.
 */
export function filasDeTotales(doc: DocumentoVista): FilaTotal[] {
  const filas: FilaTotal[] = [
    { clave: "base", label: "Base gravable", value: doc.taxableBase },
    { clave: "iva", label: "IVA", value: doc.ivaTotal },
  ]
  if (!esDocumentoConTributos(doc)) return filas
  if ((doc.incTotal ?? 0) > 0) filas.push({ clave: "inc", label: "INC", value: doc.incTotal! })
  if ((doc.icaTotal ?? 0) > 0) filas.push({ clave: "ica", label: "ICA", value: doc.icaTotal! })
  if ((doc.bagTaxTotal ?? 0) > 0) {
    filas.push({ clave: "bolsas", label: "INC de bolsas", value: doc.bagTaxTotal! })
  }
  // `chargeTotal` ya viene con signo: se usa tal cual.
  const cargos = doc.chargeTotal ?? 0
  if (cargos !== 0) filas.push({ clave: "propina", label: "Propina", value: cargos })
  return filas
}

/** TOTAL del documento: `payableAmount` si lo trae, `total` si es anterior. */
export function totalAPagar(doc: DocumentoVista): number {
  return esDocumentoConTributos(doc) ? doc.payableAmount! : doc.total
}

/**
 * El descuento es informativo en un documento nuevo (las bases ya vienen netas):
 * no se resta como fila. En uno viejo se mostraba como fila, y se conserva.
 */
export function descuentoComoFila(doc: DocumentoVista): boolean {
  return !esDocumentoConTributos(doc) && doc.discountTotal > 0
}
