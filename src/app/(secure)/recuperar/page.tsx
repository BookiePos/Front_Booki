"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { LoaderCircle, MailCheck } from "lucide-react"

import { AuthBrandAside } from "@/components/auth/brand-aside"
import { BookiPosLogo } from "@/components/marketing/bookipos-logo"
import { ApiError, apiForgotPassword } from "@/lib/api"

/**
 * Paso 1 de la recuperación: pedir el correo con el enlace.
 *
 * La confirmación NO dice si la cuenta existe —el backend tampoco lo dice— para
 * que este formulario no sirva para averiguar qué correos están registrados.
 * Por eso el mensaje de éxito está redactado en condicional.
 */
export default function RecuperarPage() {
  const emailId = useId()

  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await apiForgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No hay conexión con el servidor de BookiPos. Verifica tu internet e intenta de nuevo.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="zone-marketing grid min-h-svh bg-surface text-ink lg:grid-cols-[1fr_1.1fr]">
      <AuthBrandAside
        titulo="Recuperar el acceso no debería frenarte el turno."
        bajada="Te mandamos un enlace al correo de tu cuenta. Es válido una sola vez y por poco tiempo."
      />

      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block lg:hidden" aria-label="BookiPos — inicio">
            <BookiPosLogo />
          </Link>

          {!sent ? (
            <>
              <h1 className="mt-10 font-display text-4xl font-semibold text-ink lg:mt-0">
                Recuperar contraseña
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Escribe tu correo o tu usuario y te enviamos un enlace para
                crear una contraseña nueva.
              </p>

              <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate>
                <div>
                  <label htmlFor={emailId} className="block text-sm font-semibold text-ink">
                    Correo o usuario
                  </label>
                  <input
                    id={emailId}
                    type="text"
                    name="email"
                    required
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@negocio.com o tu usuario"
                    className="mt-2 h-13 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500"
                  />
                </div>

                {/* aria-live: el lector de pantalla anuncia el error sin robar el foco */}
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
                  disabled={pending || email.trim().length === 0}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
                  {pending ? "Enviando…" : "Enviarme el enlace"}
                </button>
              </form>

              <p className="mt-8 text-sm text-ink-muted">
                ¿Ya la recordaste?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Volver a iniciar sesión
                </Link>
                .
              </p>
            </>
          ) : (
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <MailCheck className="size-6" aria-hidden="true" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-semibold text-ink">
                Revisa tu correo
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Si <strong className="text-ink">{email.trim()}</strong>{" "}
                corresponde a una cuenta de BookiPos, te llegó un enlace para
                crear tu contraseña nueva. Vence en una hora y solo funciona una
                vez.
              </p>
              <p className="mt-4 text-sm text-ink-muted">
                ¿No lo ves? Mira en spam o en correo no deseado. Si tu usuario se
                creó sin correo, la contraseña te la restablece el dueño del
                negocio desde el panel.
              </p>

              <div className="mt-8 space-y-3">
                <Link
                  href="/login"
                  className="inline-flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99]"
                >
                  Ir a iniciar sesión
                </Link>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-hairline bg-white text-base font-semibold text-ink transition-colors hover:bg-surface-soft"
                >
                  Usar otro correo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
