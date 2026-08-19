"use client"

import Link from "next/link"
import { Lock, Sparkles } from "lucide-react"

import type { PlanFeature } from "@/lib/api"
import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Plan mínimo que habilita cada capacidad. Se usa para orientar al usuario
 * hacia el escalón correcto en vez de mandarlo a leer toda la tabla.
 */
const FEATURE_INFO: Record<
  PlanFeature,
  { titulo: string; cta: string; planSugerido: string }
> = {
  pos: {
    titulo: "El punto de venta no está en tu plan.",
    cta: "Actívalo para empezar a cobrar.",
    planSugerido: "Punto",
  },
  inventory: {
    titulo: "El control de inventario no está en tu plan.",
    cta: "Actívalo para manejar tu stock.",
    planSugerido: "Punto",
  },
  caja: {
    titulo: "El arqueo de caja no está en tu plan.",
    cta: "Actívalo para cuadrar tus turnos.",
    planSugerido: "Punto",
  },
  customers: {
    titulo: "El directorio de clientes no está en tu plan.",
    cta: "Actívalo para guardar tus clientes.",
    planSugerido: "Punto",
  },
  reports: {
    titulo: "Los reportes de venta no están en tu plan.",
    cta: "Actívalos para medir tu negocio.",
    planSugerido: "Punto",
  },
  einvoicing: {
    titulo: "La facturación electrónica no está en tu plan.",
    cta: "Actívala para emitir ante la DIAN.",
    planSugerido: "Punto",
  },
  restaurant: {
    titulo: "El módulo de restaurante no está en tu plan.",
    cta: "Actívalo para mesas, comandas y propinas.",
    planSugerido: "Negocio",
  },
  lots: {
    titulo: "Lotes y vencimientos no están en tu plan.",
    cta: "Actívalos para trazabilidad y control de mermas.",
    planSugerido: "Negocio",
  },
  purchasing: {
    titulo: "Compras y proveedores no están en tu plan.",
    cta: "Actívalos para órdenes de compra y recepción.",
    planSugerido: "Negocio",
  },
  expenses: {
    titulo: "Gastos y flujo de caja no están en tu plan.",
    cta: "Actívalos para ver a dónde se va la plata.",
    planSugerido: "Negocio",
  },
  accounting: {
    titulo: "La contabilidad no está en tu plan.",
    cta: "Actívala para estados financieros, CxP y CxC.",
    planSugerido: "Control",
  },
  audit: {
    titulo: "La auditoría no está en tu plan.",
    cta: "Actívala para rastrear cada acción sensible.",
    planSugerido: "Control",
  },
  payroll: {
    titulo: "La nómina no está en tu plan.",
    cta: "Actívala para liquidar tu equipo colombiano.",
    planSugerido: "Control",
  },
  multi_sede: {
    titulo: "El multi-sede no está en tu plan.",
    cta: "Actívalo para consolidar varios locales.",
    planSugerido: "Cadena",
  },
  transfers: {
    titulo: "Los traslados entre sedes no están en tu plan.",
    cta: "Actívalos para mover stock entre bodegas.",
    planSugerido: "Cadena",
  },
  roles_per_sede: {
    titulo: "Los permisos por sede no están en tu plan.",
    cta: "Actívalos para roles distintos en cada local.",
    planSugerido: "Cadena",
  },
}

/**
 * Pantalla de upsell: se muestra cuando el plan del usuario no incluye la
 * capacidad que la página exige. Tono amable, sin culpar; invita a ver planes.
 */
export function PlanUpsell({ feature }: { feature: PlanFeature }) {
  const info = FEATURE_INFO[feature]

  return (
    <>
      <PageHeader
        title="Función no disponible en tu plan"
        section="Tu plan"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Lock className="size-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              Esta función no está en tu plan
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {info.titulo} {info.cta} Disponible desde el plan{" "}
              <span className="font-semibold text-foreground">
                {info.planSugerido}
              </span>
              .
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#precios"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-opacity hover:opacity-90"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Ver planes
            </Link>
            <Link
              href="/panel"
              className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Volver al panel
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
