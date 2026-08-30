"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  ShoppingCart,
} from "lucide-react";
import { AuthBrandAside } from "@/components/auth/brand-aside";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { ZoneLink } from "@/components/marketing/zone-link";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Login único de BookiPos.
 *
 * Al vivir las tres zonas en el mismo origen, esta pantalla ya es SSO de
 * verdad: la sesión que abre aquí sirve tal cual en /panel y en /pos, sin
 * volver a pedir contraseña. Antes eran tres orígenes distintos y cada uno
 * guardaba su propia sesión.
 */
export default function LoginPage() {
  const emailId = useId();
  const passId = useId();
  const router = useRouter();
  const { login, user, canUsePos, canUseOperation } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await login(email, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No hay conexión con el servidor de BookiPos. Verifica tu internet e intenta de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  // Áreas a las que el usuario tiene acceso real. Se usan los mismos flags que
  // guardan cada zona (canUsePos / canUseOperation), para no ofrecer aquí una
  // puerta que luego el guard rebota. `inventory.view` u otros permisos que el
  // POS también usa NO habilitan el panel: eso lo decide OPERATION_PERMISSIONS.
  const canPos = canUsePos;
  const canPanel = canUseOperation;

  return (
    <main className="zone-marketing grid min-h-svh bg-surface text-ink lg:grid-cols-[1fr_1.1fr]">
      <AuthBrandAside
        titulo="La cuenta de la mesa 7 ya está en tu contabilidad."
        bajada="Entra y sigue donde quedaste. Tu caja, tu inventario y tu cartera siguen cuadrados."
      />

      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block lg:hidden" aria-label="BookiPos — inicio">
            <BookiPosLogo />
          </Link>

          {!done ? (
            <>
              <h1 className="mt-10 font-display text-4xl font-semibold text-ink lg:mt-0">
                Iniciar sesión
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                ¿Todavía no tienes cuenta?{" "}
                <Link
                  href="/registro"
                  className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Crea tu negocio
                </Link>
                .
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@negocio.com o tu usuario"
                    className="mt-2 h-13 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor={passId} className="block text-sm font-semibold text-ink">
                      Contraseña
                    </label>
                    <Link
                      href="/recuperar"
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      ¿La olvidaste?
                    </Link>
                  </div>
                  <div className="relative mt-2">
                    <input
                      id={passId}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
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
                  disabled={pending}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
                  {pending ? "Verificando…" : "Entrar"}
                </button>
              </form>
            </>
          ) : (
            <div>
              <h1 className="font-display text-4xl font-semibold text-ink">
                Hola, {user?.name.split(" ")[0] ?? ""}
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Sesión iniciada. ¿A dónde quieres entrar?
              </p>

              <div className="mt-8 space-y-3">
                {canPos && (
                  <ZoneLink
                    href="/pos"
                    onNavigate={router.push}
                    icon={<ShoppingCart className="size-6" aria-hidden="true" />}
                    title="Punto de venta"
                    body="Vender, cobrar, abrir y cerrar caja."
                  />
                )}
                {canPanel && (
                  <ZoneLink
                    href="/panel"
                    onNavigate={router.push}
                    icon={<LayoutDashboard className="size-6" aria-hidden="true" />}
                    title="Panel de operación"
                    body="Inventario, cartera, nómina y reportes."
                  />
                )}
                {!canPos && !canPanel && (
                  <p className="rounded-xl border border-hairline bg-surface-soft px-4 py-3 text-sm text-ink-muted">
                    Tu usuario no tiene permisos asignados todavía. Pídele a un
                    administrador que te habilite un módulo.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
