"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

import {
  ApiError,
  INVITATION_ERROR_CODES,
  apiAcceptInvitation,
  apiGetInvitation,
  type InvitationInfo,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const STORAGE_KEY = "sistemapos.auth"

type Phase = "loading" | "invalid" | "form" | "submitting"

/** Qué se le dice a quien abre un enlace que no sirve, y qué salida se le da. */
interface InvalidState {
  title: string
  description: string
  /** `true` cuando iniciar sesión es de verdad lo que resuelve su caso. */
  offerLogin: boolean
}

/**
 * Un motivo, un mensaje.
 *
 * Antes todo caía en "Invitación no válida": una invitación vencida, una ya
 * usada, una cancelada y hasta un 500 del servidor. Eso mandaba a pedir ayuda a
 * quien podía resolverlo solo, y escondió durante días un fallo que no tenía
 * nada que ver con el enlace. El título ahora dice qué pasó y el texto dice qué
 * hacer; el botón de iniciar sesión aparece solo cuando eso es la salida.
 */
const INVALID_STATES: Record<string, InvalidState> = {
  [INVITATION_ERROR_CODES.EXPIRED]: {
    title: "Esta invitación venció",
    description:
      "Los enlaces caducan por seguridad. Pídele a quien te invitó que te la reenvíe: tarda un segundo.",
    offerLogin: false,
  },
  [INVITATION_ERROR_CODES.ACCEPTED]: {
    title: "Tu cuenta ya está activa",
    description:
      "Esta invitación ya se usó. Entra con tu correo y la contraseña que definiste.",
    offerLogin: true,
  },
  [INVITATION_ERROR_CODES.REVOKED]: {
    title: "La invitación fue cancelada",
    description:
      "Quien administra el negocio canceló este acceso. Si crees que es un error, contáctalo.",
    offerLogin: false,
  },
  [INVITATION_ERROR_CODES.LEGACY_LINK]: {
    title: "El enlace está desactualizado",
    description:
      "Se envió antes de una actualización del sistema. Pide que te reenvíen la invitación y el enlace nuevo funcionará.",
    offerLogin: false,
  },
  [INVITATION_ERROR_CODES.NOT_FOUND]: {
    title: "Este enlace no existe",
    description:
      "Puede que esté incompleto: al copiarlo del correo a veces se corta. Ábrelo desde el correo o pide que te lo reenvíen.",
    offerLogin: false,
  },
}

/** Cuando el fallo no es del enlace, se dice así en vez de culparlo. */
const UNEXPECTED_STATE: InvalidState = {
  title: "No pudimos validar la invitación",
  description:
    "Hubo un problema de nuestro lado, no con tu enlace. Vuelve a intentarlo en un momento; si sigue igual, avísale a quien te invitó.",
  offerLogin: false,
}

function invalidStateFor(err: unknown): InvalidState {
  if (!(err instanceof ApiError)) return UNEXPECTED_STATE
  const known = err.code ? INVALID_STATES[err.code] : undefined
  if (known) return known
  // Un 5xx sin código NO es culpa del enlace: decirlo evita que la gente
  // persiga un problema que no tiene.
  if (err.status >= 500) return UNEXPECTED_STATE
  return { title: "Enlace no válido", description: err.message, offerLogin: false }
}

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  const [phase, setPhase] = useState<Phase>("loading")
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [invalid, setInvalid] = useState<InvalidState>(UNEXPECTED_STATE)

  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!token) {
        setInvalid(INVALID_STATES[INVITATION_ERROR_CODES.NOT_FOUND]!)
        setPhase("invalid")
        return
      }
      try {
        const data = await apiGetInvitation(token)
        if (!active) return
        setInfo(data)
        setPhase("form")
      } catch (err) {
        if (!active) return
        setInvalid(invalidStateFor(err))
        setPhase("invalid")
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [token])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    setPhase("submitting")
    try {
      const res = await apiAcceptInvitation(token, { name, password })
      // Guarda la sesión y entra al panel (recarga para que AuthProvider la tome).
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tokens: res.tokens, user: res.user }),
      )
      window.location.href = "/"
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo aceptar la invitación.",
      )
      setPhase("form")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex items-center gap-2.5">
            <div className="font-display flex size-9 items-center justify-center rounded-lg bg-primary text-[18px] leading-none text-primary-foreground">
              S
            </div>
            <span className="font-display text-lg">BookiPos</span>
          </div>

          {phase === "loading" && (
            <>
              <CardTitle className="font-display text-xl">
                Validando invitación…
              </CardTitle>
              <CardDescription>Un momento, por favor.</CardDescription>
            </>
          )}

          {phase === "invalid" && (
            <>
              <CardTitle className="font-display text-xl">
                {invalid.title}
              </CardTitle>
              <CardDescription>{invalid.description}</CardDescription>
            </>
          )}

          {(phase === "form" || phase === "submitting") && info && (
            <>
              <CardTitle className="font-display text-xl">
                Activa tu cuenta
              </CardTitle>
              <CardDescription>
                Te uniste como <strong>{info.email}</strong> con el rol{" "}
                <strong>{info.roleName}</strong>. Elige tu nombre y una
                contraseña para continuar.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {phase === "loading" && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}

          {phase === "invalid" &&
            (invalid.offerLogin ? (
              <Button render={<Link href="/login" />} className="w-full">
                Ir a iniciar sesión
              </Button>
            ) : (
              // Sin salida propia: se ofrece la web, no un login que no va a
              // funcionar porque esta persona todavía no tiene cuenta.
              <Button
                variant="outline"
                render={<Link href="/" />}
                className="w-full"
              >
                Volver al inicio
              </Button>
            ))}

          {(phase === "form" || phase === "submitting") && info && (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="i-name">Tu nombre</Label>
                <Input
                  id="i-name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan García"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-password">Contraseña</Label>
                <Input
                  id="i-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-confirm">Confirmar contraseña</Label>
                <Input
                  id="i-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={phase === "submitting"}
              >
                {phase === "submitting"
                  ? "Activando…"
                  : "Activar cuenta e ingresar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
