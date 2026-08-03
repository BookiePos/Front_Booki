"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

import {
  ApiError,
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

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  const [phase, setPhase] = useState<Phase>("loading")
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [invalidMsg, setInvalidMsg] = useState<string>("")

  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!token) {
        setInvalidMsg("Enlace de invitación no válido.")
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
        setInvalidMsg(
          err instanceof ApiError
            ? err.message
            : "No se pudo validar la invitación.",
        )
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
            <span className="font-display text-lg">GoCheck</span>
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
                Invitación no válida
              </CardTitle>
              <CardDescription>{invalidMsg}</CardDescription>
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

          {phase === "invalid" && (
            <Button render={<Link href="/login" />} className="w-full">
              Ir a iniciar sesión
            </Button>
          )}

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
