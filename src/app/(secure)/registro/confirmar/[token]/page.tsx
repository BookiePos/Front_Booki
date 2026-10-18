"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  LoaderCircle,
  MailCheck,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react"

import { AuthBrandAside } from "@/components/auth/brand-aside"
import { BookiPosLogo } from "@/components/marketing/bookipos-logo"
import { ZoneLink } from "@/components/marketing/zone-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiResendRegister, ApiError, type RegisterResponse } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type Fase = "pendiente" | "confirmando" | "error" | "listo"

const PANEL_PERMISSIONS = [
  "reports.view",
  "finance.view",
  "inventory.view",
  "users.manage",
]

/**
 * Paso 2 del registro (ítem 4.11): el enlace del correo crea la empresa y abre
 * la sesión.
 *
 * Ya no confirma sola al cargar (revisión 2): los escáneres de enlaces de los
 * correos y las vistas previas hacen GET a la URL y gastarían el token de un
 * solo uso. Hace falta un clic en «Confirmar», y el token viaja en el body del
 * POST, no en la ruta. La página sale con `Referrer-Policy: no-referrer` (ver
 * next.config.ts y el layout) para que el token de la URL no se filtre en el
 * Referer de ninguna petición.
 */
export default function ConfirmarRegistroPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  const router = useRouter()
  const { confirmRegister } = useAuth()

  const [fase, setFase] = useState<Fase>("pendiente")
  const [motivo, setMotivo] = useState("")
  const [sesion, setSesion] = useState<RegisterResponse | null>(null)

  const [email, setEmail] = useState("")
  const [reenvio, setReenvio] = useState<"idle" | "enviando" | "enviado">("idle")
  const [reenvioError, setReenvioError] = useState("")

  function confirmar() {
    if (!token || fase === "confirmando") return
    setFase("confirmando")
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
  }

  function reenviar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || reenvio === "enviando") return
    setReenvio("enviando")
    setReenvioError("")
    apiResendRegister(email.trim())
      .then(() => setReenvio("enviado"))
      .catch((err: unknown) => {
        setReenvio("idle")
        setReenvioError(
          err instanceof ApiError
            ? err.message
            : "No se pudo reenviar el correo. Intenta de nuevo.",
        )
      })
  }

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

          {vista === "pendiente" && (
            <div className="mt-10 lg:mt-0">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <MailCheck className="size-6" aria-hidden />
              </span>
              <h1 className="mt-6 font-display text-4xl font-semibold text-ink">
                Confirma tu correo
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Un clic y creamos tu negocio con los 14 días de prueba.
              </p>
              <Button type="button" size="lg" className="mt-8" onClick={confirmar}>
                Confirmar
              </Button>
            </div>
          )}

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

              <form onSubmit={reenviar} className="mt-8 space-y-3">
                <label htmlFor="reenviar-email" className="text-sm font-semibold text-ink">
                  ¿El enlace venció o no te llegó? Te mandamos otro.
                </label>
                <Input
                  id="reenviar-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" disabled={reenvio === "enviando"}>
                  Reenviar correo
                </Button>
                {reenvio === "enviado" && (
                  <p role="status" className="text-sm text-ink-muted">
                    Si hay un registro pendiente con ese correo, te enviamos un enlace nuevo. El
                    anterior ya no sirve.
                  </p>
                )}
                {reenvioError && (
                  <p role="alert" className="text-sm text-red-700">
                    {reenvioError}
                  </p>
                )}
              </form>

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
