"use client"

import * as React from "react"
import { Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { listSedes, updateSede, type Sede } from "@/lib/erp/api-inventory"
import { validarImagenQr } from "@/lib/erp/conciliacion-pagos"
import { errorMessage } from "@/lib/erp/finance-format"

import { useResetOnChange } from "@/hooks/use-reset-on-change"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"

/**
 * QR estático o llave Bre-B del negocio (ítem 6.4). No hay integración de
 * cobro: el POS solo lo MUESTRA en el cobro por transferencia para que el
 * cliente pague escaneando. Se guarda por sede.
 */
export function CobroDigitalConfig() {
  const { hasPermission } = useAuth()
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState("")
  const [llave, setLlave] = React.useState("")
  const [titular, setTitular] = React.useState("")
  const [imagen, setImagen] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    listSedes()
      .then((sd) => {
        if (!active) return
        const activas = sd.filter((s) => s.active)
        setSedes(activas)
        setSedeId((cur) => cur || activas[0]?._id || "")
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useResetOnChange(() => {
    const c = sedes.find((s) => s._id === sedeId)?.cobroDigital
    setLlave(c?.qrLlave ?? "")
    setTitular(c?.qrTitular ?? "")
    setImagen(c?.qrImagen ?? "")
    setError(null)
  }, [sedeId, sedes])

  if (!hasPermission("sede.manage")) return null

  function elegirImagen(file: File | undefined) {
    if (!file) return
    const problema = validarImagenQr(file.type, file.size)
    if (problema) {
      setError(problema)
      return
    }
    setError(null)
    const lector = new FileReader()
    lector.onload = () => setImagen(String(lector.result))
    lector.readAsDataURL(file)
  }

  async function guardar() {
    setBusy(true)
    setError(null)
    try {
      const sede = await updateSede(sedeId, {
        cobroDigital: {
          qrLlave: llave.trim(),
          qrTitular: titular.trim(),
          qrImagen: imagen,
        },
      })
      setSedes((prev) => prev.map((s) => (s._id === sedeId ? { ...s, ...sede } : s)))
      toast.success("Guardado: el POS ya lo muestra al cobrar por transferencia")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div>
          <p className="flex items-center gap-2 font-display text-base">
            <QrCode className="size-4" />
            QR o llave Bre-B para cobrar
          </p>
          <p className="text-sm text-muted-foreground">
            Lo que cargues aquí se muestra en el cobro del POS cuando el cliente
            paga por transferencia, Nequi, Daviplata o QR.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <FieldGrid>
          <Field id="cd-sede" label="Sede">
            <NativeSelect
              id="cd-sede"
              value={sedeId}
              onChange={setSedeId}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
            />
          </Field>
          <Field id="cd-llave" label="Llave Bre-B o número">
            <Input id="cd-llave" value={llave} maxLength={120} onChange={(e) => setLlave(e.target.value)} placeholder="@mi-negocio o 300 123 4567" />
          </Field>
          <Field id="cd-titular" label="A nombre de">
            <Input id="cd-titular" value={titular} maxLength={120} onChange={(e) => setTitular(e.target.value)} />
          </Field>
          <Field id="cd-img" label="Imagen del QR" hint="PNG, JPG o WEBP, menos de 100 KB">
            <Input id="cd-img" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => elegirImagen(e.target.files?.[0])} />
          </Field>
        </FieldGrid>
        {imagen && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen} alt="QR cargado" className="size-24 rounded-md border border-border bg-white object-contain" />
            <Button variant="ghost" size="sm" onClick={() => setImagen("")}>
              Quitar imagen
            </Button>
          </div>
        )}
        <Button className="self-start" onClick={() => void guardar()} disabled={busy || !sedeId}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}
