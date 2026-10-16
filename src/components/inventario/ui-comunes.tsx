"use client"

import {
  MOVEMENT_TYPE_LABELS,
  type Sede,
  type InvProduct,
  type MovementType,
} from "@/lib/erp/api-inventory"
import { type Supplier } from "@/lib/erp/api-suppliers"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Selección inicial del selector de proveedor: prioriza la referencia
 * registrada, luego el texto legado (buscando por nombre) y por último nada.
 */
export function initialSupplierSel(
  suppliers: Supplier[],
  supplierId?: string,
  supplierText?: string,
): string {
  if (supplierId && suppliers.some((s) => s._id === supplierId)) {
    return supplierId
  }
  if (supplierText) {
    const byName = suppliers.find(
      (s) => s.name.toLowerCase() === supplierText.toLowerCase(),
    )
    if (byName) return byName._id
    // Texto libre que no corresponde a ningún proveedor: se conserva.
    return "legacy"
  }
  return "none"
}

/** Selector de proveedores activos con opción para el texto legado. */
export function SupplierSelect({
  id,
  suppliers,
  value,
  legacyText,
  onChange,
}: {
  id: string
  suppliers: Supplier[]
  value: string
  legacyText: string
  onChange: (v: string) => void
}) {
  const items: Record<string, string> = {
    none: "Sin proveedor",
    ...(legacyText ? { legacy: `${legacyText} (no registrado)` } : {}),
    ...Object.fromEntries(
      suppliers
        .filter((s) => s.active || s._id === value)
        .map((s) => [s._id, s.name]),
    ),
  }
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(v) => {
        if (v !== null) onChange(v)
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Sin proveedor" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([k, label]) => (
          <SelectItem key={k} value={k}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Días hasta el vencimiento comparando fechas de calendario (no horas). */
export function daysUntil(date: string): number {
  const d = new Date(date)
  const expiry = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((expiry - today) / 86400000)
}

/** Fecha local en formato YYYY-MM-DD para inputs type="date". */
export function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const d = daysUntil(date)
  if (d < 0) return <Badge variant="destructive">Vencido</Badge>
  if (d === 0) return <Badge variant="destructive">Vence hoy</Badge>
  if (d <= 7) return <Badge variant="destructive">Vence en {d} d</Badge>
  if (d <= 60) return <Badge variant="outline">Vence en {d} d</Badge>
  // Más de dos meses: se expresa en meses para no mostrar "Vence en 240 d".
  return <Badge variant="outline">Vence en {Math.round(d / 30)} m</Badge>
}

export function MovementBadge({ type }: { type: MovementType }) {
  const negative = ["adjust_out", "waste", "transfer_out", "sale"].includes(
    type,
  )
  return (
    <Badge variant={negative ? "destructive" : "secondary"}>
      {MOVEMENT_TYPE_LABELS[type] ?? type}
    </Badge>
  )
}

export function TableSkeleton({
  cols = 5,
  rows = 5,
}: {
  cols?: number
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Mapas value→etiqueta para que el Select muestre nombres y no ids. */
export function productItems(list: InvProduct[]): Record<string, string> {
  return Object.fromEntries(list.map((p) => [p._id, `${p.name} · ${p.sku}`]))
}

export function sedeItems(list: Sede[]): Record<string, string> {
  return Object.fromEntries(list.map((s) => [s._id, s.name]))
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  )
}
