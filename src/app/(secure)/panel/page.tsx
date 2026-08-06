"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { useAuth } from "@/lib/auth-context"

import { PageHeader } from "@/components/erp/page-header"
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist"
import { DashboardGrid } from "@/components/dashboard/dashboard-grid"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { user, tipoNegocio } = useAuth()

  return (
    <>
      <PageHeader
        title="Panel ejecutivo"
        section="Panel"
        description={`Bienvenido${
          user?.name ? `, ${user.name.split(" ")[0]}` : ""
        }. Resumen operativo de ${
          tipoNegocio === "restaurante"
            ? "tu restaurante"
            : tipoNegocio === "retail"
              ? "tu tienda"
              : "tu negocio"
        }.`}
        actions={
          <div data-tour="nueva-venta" className="flex items-center gap-2">
            <Button render={<Link href="/pos" />}>
              <ShoppingCart />
              Nueva venta
            </Button>
          </div>
        }
      />

      <OnboardingChecklist />

      {/* Tablero personalizable: cada usuario elige, ordena y dimensiona sus
          widgets (persistido por usuario en localStorage). */}
      <DashboardGrid />
    </>
  )
}
