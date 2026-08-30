"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { CircleCheck, Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react"

import { AuthBrandAside } from "@/components/auth/brand-aside"
import { BookiPosLogo } from "@/components/marketing/bookipos-logo"
import { ApiError, apiResetPassword, apiValidatePasswordReset } from "@/lib/api"

/** Mismo mínimo que valida el backend (`ResetPasswordDto`). */
const MIN_PASSWORD = 6

type Fase = "validando" | "invalido" | "form" | "guardando" | "listo"

/**
 * Paso 2 de la recuperación: elegir la contraseña nueva.
 *
 * El enlace se valida al entrar para no enseñar un formulario que va a fallar
 * al enviarlo. Al guardar NO se inicia sesión a propósito: el cambio revoca
 * todas las sesiones abiertas de esa cuenta —incluida la de un posible
 * intruso—, así que el paso siguiente es entrar con la contraseña nueva.
 */
export default function RestablecerPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  const passId = useId()
  const confirmId = useId()

  const [fase, setFase] = useState<Fase>("validando")
  const [cuenta, setCuenta] = useState("")
  const [motivoInvalido, setMotivoInvalido] = useState("")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    async function validar() {
      if (!token) {
        setMotivoInvalido("El enlace de recuperación no es válido.")
        setFase("invalido")
        return
      }
      try {
        const { email } = await apiValidatePasswordReset(token)
        if (!activo) return
        setCuenta(email)
        setFase("form")
      } catch (err) {
        if (!activo) return
        setMotivoInvalido(
          err instanceof ApiError
            ? err.message
            : "No se pudo validar el enlace. Revisa tu conexión e intenta de nuevo.",
        )
        setFase("invalido")
      }
    }
    void validar()
    return () => {
      activo = false
    }
  }, [token])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    if (password !== confirm) {
      setError("Las dos contraseñas no coinciden.")
      return
    }
    setFase("guardando")
    try {
      await apiResetPassword(token, password)
      setFase("listo")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la contraseña. Revisa tu conexión e intenta de nuevo.",
      )
      setFase("form")
    }
  }

  return (
    <main className="zone-marketing grid min-h-svh bg-surface text-ink lg:grid-cols-[1fr_1.1fr]">
      <AuthBrandAside
        titulo="Una contraseña nueva y sigues donde quedaste."
        bajada="Al cambiarla se cierran todas las sesiones abiertas de tu cuenta, en cualquier equipo."
      />

      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block lg:hidden" aria-label="BookiPos — inicio">
            <BookiPosLogo />
          </Link>

          {fase === "validando" && (
            <div className="mt-10 lg:mt-0" aria-live="polite">
              <h1 className="font-display text-4xl font-semibold text-ink">
                Validando el enlace…
              </h1>
              <p className="mt-3 flex items-center gap-2 leading-relaxed text-ink-muted">
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                Un momento, por favor.
              </p>
            </div>
          )}

          {fase === "invalido" && (
            <div className="mt-10 lg:mt-0">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <TriangleAlert className="size-6" aria-hidden="true" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-semibold text-ink">
                Enlace no válido
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                {motivoInvalido} Los enlaces vencen en una hora y solo sirven una
                vez; pide uno nuevo y ábrelo desde el correo más reciente.
              </p>
              <div className="mt-8 space-y-3">
                <Link
                  href="/recuperar"
                  className="inline-flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99]"
                >
                  Pedir un enlace nuevo
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-hairline bg-white text-base font-semibold text-ink transition-colors hover:bg-surface-soft"
                >
                  Volver a iniciar sesión
                </Link>
              </div>
            </div>
          )}

          {(fase === "form" || fase === "guardando") && (
            <>
              <h1 className="mt-10 font-display text-4xl font-semibold text-ink lg:mt-0">
                Nueva contraseña
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Estás cambiando la contraseña de{" "}
                <strong className="text-ink">{cuenta}</strong>.
              </p>

              <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate>
                <div>
                  <label htmlFor={passId} className="block text-sm font-semibold text-ink">
                    Contraseña nueva
                  </label>
                  <div className="relative mt-2">
                    <input
                      id={passId}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      autoComplete="new-password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                      className="h-13 w-full rounded-xl border border-hairline bg-white px-4 pr-13 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      <span className="sr-only">
                        {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      </span>
                      {showPassword ? (
                        <EyeOff className="size-5" aria-hidden="true" />
                      ) : (
                        <Eye className="size-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor={confirmId} className="block text-sm font-semibold text-ink">
                    Repite la contraseña
                  </label>
                  <input
                    id={confirmId}
                    type={showPassword ? "text" : "password"}
                    name="confirm"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="mt-2 h-13 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500"
                  />
                </div>

                <div aria-live="polite">
                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                    >
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={fase === "guardando"}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {fase === "guardando" && (
                    <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                  )}
                  {fase === "guardando" ? "Guardando…" : "Guardar contraseña"}
                </button>
              </form>
            </>
          )}

          {fase === "listo" && (
            <div className="mt-10 lg:mt-0">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CircleCheck className="size-6" aria-hidden="true" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-semibold text-ink">
                Contraseña cambiada
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Ya puedes entrar con tu contraseña nueva. Por seguridad cerramos
                las sesiones que tuvieras abiertas en otros equipos.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99]"
              >
                Iniciar sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
