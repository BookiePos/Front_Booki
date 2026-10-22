"use client"

import * as React from "react"
import { toast } from "sonner"
import { Banknote, Printer, Settings2, Usb, Cable } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import type { Sale } from "@/lib/pos/api-sales"
import type { Sede } from "@/lib/pos/api-inventory"
import {
  guardarConfig,
  leerConfig,
  type ConfigImpresion,
  type TipoTransporte,
} from "@/lib/impresion/config"
import {
  abrirCajonTermico,
  imprimirPruebaTermica,
  imprimirVentaTermica,
} from "@/lib/impresion/servicio"
import {
  hayTermica,
  soporteTermico,
  vincularImpresora,
} from "@/lib/impresion/transporte"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { CheckboxField, Field, NativeSelect } from "@/components/ui/field"
import { FormAlert, FormDialog } from "@/components/ui/form-dialog"

function mensaje(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return "Error inesperado"
}

/**
 * Imprime el comprobante por la vía elegida en este equipo. Con impresora
 * térmica envía ESC/POS directo, sin diálogo. Si no hay soporte, no hay
 * impresora vinculada o la escritura falla, cae al diálogo del navegador
 * (el comportamiento de siempre) para que la venta nunca se quede sin tirilla.
 */
export async function imprimirComprobante(
  sale: Sale,
  sede: Sede | undefined,
): Promise<void> {
  const c = leerConfig()
  if (c.modo === "termica" && hayTermica()) {
    try {
      await imprimirVentaTermica(sale, sede, c)
      return
    } catch (err) {
      toast.error(
        `${mensaje(err)} Se abre el diálogo de impresión del navegador.`,
      )
    }
  }
  window.print()
}

/** Botón «Impresora» + ficha de ajustes, para la pantalla de cobro completado. */
export function ImpresoraTermicaButton({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={className}
        aria-label="Ajustes de impresora"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-4" />
      </Button>
      {open && <AjustesImpresora open={open} onOpenChange={setOpen} />}
    </>
  )
}

/** Botón que abre el cajón; solo para quien puede mover caja. */
export function AbrirCajonButton({ className }: { className?: string }) {
  const { hasPermission } = useAuth()
  const [busy, setBusy] = React.useState(false)
  const [config] = React.useState<ConfigImpresion>(() => leerConfig())
  // Sin impresora térmica elegida no hay a quién mandarle el pulso.
  if (!hasPermission("caja.movement")) return null
  if (config.modo !== "termica" || !hayTermica()) return null
  return (
    <Button
      variant="outline"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await abrirCajonTermico(leerConfig())
        } catch (err) {
          toast.error(mensaje(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Banknote className="size-4" />
      Abrir cajón
    </Button>
  )
}

function AjustesImpresora({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { hasPermission } = useAuth()
  const canDrawer = hasPermission("caja.movement")
  const [c, setC] = React.useState<ConfigImpresion>(() => leerConfig())
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const soporte = soporteTermico()
  const vinculada = !!c.transporte

  function cambiar(patch: Partial<ConfigImpresion>) {
    const next = { ...c, ...patch }
    setC(next)
    guardarConfig(next)
  }

  async function vincular(tipo: TipoTransporte) {
    setError(null)
    setBusy(tipo)
    try {
      const v = await vincularImpresora(tipo, c.baudios)
      cambiar({
        transporte: v.tipo,
        vendorId: v.vendorId,
        productId: v.productId,
        modo: "termica",
      })
      toast.success("Impresora vinculada")
    } catch (err) {
      // Cerrar el selector sin elegir no es un error que mostrar.
      if (!(err instanceof DOMException && err.name === "NotFoundError")) {
        setError(mensaje(err))
      }
    } finally {
      setBusy(null)
    }
  }

  async function ejecutar(nombre: string, fn: () => Promise<void>, ok: string) {
    setError(null)
    setBusy(nombre)
    try {
      await fn()
      toast.success(ok)
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Impresora de comprobantes"
      description="Se guarda en este navegador, no en tu cuenta."
      icon={Printer}
      size="xl"
      footer={<Button onClick={() => onOpenChange(false)}>Listo</Button>}
    >
      <div className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}

        <Field
          label="Cómo imprimir"
          hint={
            hayTermica()
              ? "La térmica imprime directo, sin diálogo. Si falla, se usa el navegador."
              : "Este navegador no permite impresión directa. Usa Chrome o Edge en HTTPS."
          }
        >
          <Segmented
            ariaLabel="Cómo imprimir"
            value={c.modo}
            onValueChange={(modo) => cambiar({ modo })}
            options={[
              { value: "navegador", label: "Navegador" },
              {
                value: "termica",
                label: "Impresora térmica",
                disabled: !hayTermica(),
              },
            ]}
          />
        </Field>

        {c.modo === "termica" && (
          <>
            <Field label="Ancho del papel">
              <Segmented
                ariaLabel="Ancho del papel"
                value={String(c.ancho) as "58" | "80"}
                onValueChange={(v) => cambiar({ ancho: v === "58" ? 58 : 80 })}
                options={[
                  { value: "58", label: "58 mm (32 columnas)" },
                  { value: "80", label: "80 mm (48 columnas)" },
                ]}
              />
            </Field>

            <Field
              id="imp-pagina"
              label="Página de códigos"
              hint="Si las tildes o la ñ salen mal, prueba CP850."
            >
              <NativeSelect
                id="imp-pagina"
                value={c.paginaCodigos}
                onChange={(v) =>
                  cambiar({ paginaCodigos: v === "cp850" ? "cp850" : "cp858" })
                }
                options={[
                  { value: "cp858", label: "CP858 (recomendada)" },
                  { value: "cp850", label: "CP850" },
                ]}
              />
            </Field>

            <Field
              label="Impresora"
              hint={
                vinculada
                  ? `Vinculada por ${c.transporte === "usb" ? "USB" : "puerto serial"}. El permiso queda recordado en este navegador.`
                  : "Elige el dispositivo una sola vez; el navegador lo recuerda."
              }
            >
              <div className="flex flex-wrap gap-2">
                {soporte.usb && (
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void vincular("usb")}
                  >
                    <Usb className="size-4" />
                    {vinculada && c.transporte === "usb" ? "Cambiar USB" : "Vincular por USB"}
                  </Button>
                )}
                {soporte.serial && (
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void vincular("serial")}
                  >
                    <Cable className="size-4" />
                    {vinculada && c.transporte === "serial"
                      ? "Cambiar puerto"
                      : "Vincular por puerto serial"}
                  </Button>
                )}
              </div>
            </Field>

            <CheckboxField
              id="imp-cajon"
              label="Abrir el cajón al imprimir ventas en efectivo"
              hint="Solo si el cajón está conectado a la impresora (puerto RJ11)."
              checked={c.cajonAlCobrar}
              onCheckedChange={(v) => cambiar({ cajonAlCobrar: v })}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!vinculada || busy !== null}
                onClick={() =>
                  void ejecutar("prueba", () => imprimirPruebaTermica(c), "Prueba enviada")
                }
              >
                <Printer className="size-4" />
                Imprimir prueba
              </Button>
              {canDrawer && (
                <Button
                  variant="outline"
                  disabled={!vinculada || busy !== null}
                  onClick={() =>
                    void ejecutar("cajon", () => abrirCajonTermico(c), "Cajón abierto")
                  }
                >
                  <Banknote className="size-4" />
                  Abrir cajón
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </FormDialog>
  )
}
