"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Bike, Loader2 } from "lucide-react"

import { ApiError } from "@/lib/api"
import {
  listDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deactivateDeliveryZone,
  type DeliveryZone,
} from "@/lib/pos/api-delivery"
import { money } from "@/lib/erp/finance-format"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, CheckboxField } from "@/components/ui/field"
import { useConfirm } from "@/components/ui/confirm-dialog"

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

/**
 * Zonas de domicilio de una sede, con tarifa fija.
 *
 * Van por sede porque el precio depende de desde dónde sale el domicilio: la
 * misma dirección cuesta distinto según la sede que la despache.
 *
 * No hay cálculo por kilómetros y es a propósito: una API de mapas se paga
 * todos los meses y en Medellín se equivoca, porque dos direcciones a 800
 * metros en línea recta pueden tener una montaña en medio. Para el pedido que
 * no cae en ninguna zona, el terminal deja escribir el valor a mano.
 */
export function DeliveryZonesCard({
  sedeId,
  canManage,
}: {
  sedeId: string
  canManage: boolean
}) {
  const confirm = useConfirm()
  const [zones, setZones] = React.useState<DeliveryZone[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [editando, setEditando] = React.useState<DeliveryZone | null>(null)

  const cargar = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setZones(await listDeliveryZones(sedeId, true))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  React.useEffect(() => {
    let vivo = true
    async function arrancar() {
      await Promise.resolve()
      if (!vivo || !sedeId) return
      await cargar()
    }
    void arrancar()
    return () => {
      vivo = false
    }
  }, [sedeId, cargar])

  async function desactivar(z: DeliveryZone) {
    const ok = await confirm({
      title: `¿Quitar la zona ${z.name}?`,
      description:
        "Deja de aparecer al cobrar un domicilio. Las ventas que ya se hicieron conservan lo que se cobró.",
      confirmLabel: "Quitar",
      destructive: true,
    })
    if (!ok) return
    try {
      await deactivateDeliveryZone(z._id)
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const activas = zones.filter((z) => z.active)

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-lg">
                Zonas de domicilio
              </CardTitle>
              <CardDescription>
                Cuánto cobras por llevar un pedido a cada barrio. Al cobrar, si
                la dirección no cae en ninguna, el valor se escribe a mano.
              </CardDescription>
            </div>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditando(null)
                  setOpen(true)
                }}
              >
                <Plus />
                Nueva
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && <FormAlert>{error}</FormAlert>}

          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : activas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Bike className="size-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Sin zonas todavía. Puedes cobrar domicilios escribiendo el valor
                a mano, pero con zonas el precio deja de depender de quién tome
                el pedido.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {activas.map((z) => (
                <li
                  key={z._id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <Bike className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {z.name}
                  </span>
                  <Badge variant="secondary" className="tnum">
                    {money.format(z.fee)}
                  </Badge>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar la zona ${z.name}`}
                        onClick={() => {
                          setEditando(z)
                          setOpen(true)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar la zona ${z.name}`}
                        onClick={() => void desactivar(z)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ZonaDialog
        open={open}
        onOpenChange={setOpen}
        sedeId={sedeId}
        zona={editando}
        onSaved={() => void cargar()}
      />
    </>
  )
}

const ZONA_FORM_ID = "ficha-zona-domicilio"

function ZonaDialog({
  open,
  onOpenChange,
  sedeId,
  zona,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedeId: string
  zona: DeliveryZone | null
  onSaved: () => void
}) {
  const [name, setName] = React.useState("")
  const [fee, setFee] = React.useState(0)
  const [active, setActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let vivo = true
    async function reset() {
      await Promise.resolve()
      if (!vivo || !open) return
      setName(zona?.name ?? "")
      setFee(zona?.fee ?? 0)
      setActive(zona?.active ?? true)
      setError(null)
    }
    void reset()
    return () => {
      vivo = false
    }
  }, [open, zona])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (zona) {
        await updateDeliveryZone(zona._id, { name, fee, active })
      } else {
        await createDeliveryZone({ sedeId, name, fee, active })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={Bike}
      title={zona ? `Zona ${zona.name}` : "Nueva zona de domicilio"}
      description="Un barrio y lo que cobras por llevarle un pedido."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ZONA_FORM_ID}
            disabled={saving || !name.trim()}
            className="sm:min-w-32"
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        id={ZONA_FORM_ID}
        onSubmit={guardar}
        className="flex flex-col gap-5"
      >
        {error && <FormAlert>{error}</FormAlert>}

        <FormSection title="La zona">
          <FieldGrid cols={2}>
            <Field id="z-name" label="Nombre" required>
              <Input
                id="z-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Laureles"
                required
              />
            </Field>
            <Field
              id="z-fee"
              label="Cobro del domicilio"
              hint="Lo que le cobras al cliente por llevárselo."
            >
              <MoneyInput
                id="z-fee"
                value={fee}
                onValueChange={(v) => setFee(v ?? 0)}
                placeholder="5000"
              />
            </Field>
          </FieldGrid>

          {zona && (
            <CheckboxField
              id="z-active"
              label="Zona activa"
              hint="Si la desactivas deja de aparecer al cobrar, pero se conserva junto con las ventas que ya se hicieron."
              checked={active}
              onCheckedChange={setActive}
            />
          )}
        </FormSection>
      </form>
    </FormDialog>
  )
}
