"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  LayoutDashboard,
  LoaderCircle,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react"

import { AuthBrandAside } from "@/components/auth/brand-aside"
import { BookiPosLogo } from "@/components/marketing/bookipos-logo"
import { ZoneLink } from "@/components/marketing/zone-link"
import { ApiError, type RegisterResponse } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type Fase = "confirmando" | "error" | "listo"

const PANEL_PERMISSIONS = [
  "reports.view",
  "finance.view",
  "inventory.view",
  "users.manage",
]

/**
 * Paso 2 del registro (ítem 4.11): el enlace del correo crea la empresa y abre
 * la sesión. El token se consume en el primer uso, así que se confirma una sola
 * vez aunque React monte el efecto dos veces en desarrollo.
 */
export default function ConfirmarRegistroPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  const router = useRouter()
  const { confirmRegister } = useAuth()

  const [fase, setFase] = useState<Fase>("confirmando")
  const [motivo, setMotivo] = useState("")
  const [sesion, setSesion] = useState<RegisterResponse | null>(null)
  const enviado = useRef(false)

  useEffect(() => {
    if (enviado.current || !token) return
    enviado.current = true
    confirmRegister(token)
      .then((res) => {
        setSesion(res)
        setFase("listo")
      })
      .catch((err: unknown) => {
        setMotivo(
          err instanceof ApiError
            ? err.message
            : "No se pudo confirmar el enlace. Revisa tu conexión e intenta de nuevo.",
        )
        setFase("error")
      })
  }, [token, confirmRegister])

  // Sin token en la ruta no hay nada que confirmar.
  const vista: Fase = token ? fase : "error"
  const motivoVisible = token ? motivo : "El enlace de confirmación no es válido."

  const permisos = sesion?.user.permissions ?? []
  const canPos = permisos.includes("pos.sell")
  const canPanel = PANEL_PERMISSIONS.some((p) => permisos.includes(p))
  const zonaPos = canPos && (
    <ZoneLink
      href="/pos"
      onNavigate={router.push}
      icon={<ShoppingCart className="size-6" aria-hidden />}
      title="Punto de venta"
      body="Vender, cobrar, abrir y cerrar caja."
    />
  )
  const zonaPanel = canPanel && (
    <ZoneLink
      href="/panel"
      onNavigate={router.push}
      icon={<LayoutDashboard className="size-6" aria-hidden />}
      title="Panel de operación"
      body="Inventario, cartera, nómina y reportes."
    />
  )

  return (
    <main className="zone-marketing grid min-h-svh bg-surface text-ink lg:grid-cols-[1fr_1.1fr]">
      <AuthBrandAside
        titulo="Tu negocio, listo para vender en minutos."
        bajada="Confirmamos tu correo y dejamos lista tu cuenta con los 14 días de prueba."
      />
      <div className="flex items-start justify-center px-5 py-14 sm:px-10 lg:items-center">
        <div className="w-full max-w-lg">
          <Link href="/" className="inline-block lg:hidden" aria-label="BookiPos — inicio">
            <BookiPosLogo />
          </Link>

          {vista === "confirmando" && (
            <div className="mt-10 flex items-center gap-3 text-ink-muted lg:mt-0" role="status">
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
              Creando tu negocio…
            </div>
          )}

          {vista === "error" && (
            <div className="mt-10 lg:mt-0">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <TriangleAlert className="size-6" aria-hidden />
              </span>
              <h1 className="mt-6 font-display text-4xl font-semibold text-ink">
                No pudimos confirmar
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">{motivoVisible}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
                <Link href="/registro" className="text-brand-700 underline underline-offset-4">
                  Volver a registrarme
                </Link>
                <Link href="/login" className="text-brand-700 underline underline-offset-4">
                  Iniciar sesión
                </Link>
              </div>
            </div>
          )}

          {vista === "listo" && sesion && (
            <div className="mt-10 lg:mt-0">
              <h1 className="font-display text-4xl font-semibold text-ink">
                ¡Listo, {sesion.user.name.split(" ")[0] ?? ""}!
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Tu negocio ya está creado. ¿Por dónde quieres empezar?
              </p>
              <div className="mt-8 space-y-3">
                {sesion.plan === "punto" ? (
                  <>
                    {zonaPos}
                    {zonaPanel}
                  </>
                ) : (
                  <>
                    {zonaPanel}
                    {zonaPos}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
