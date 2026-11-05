"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ShieldOff,
  Loader2,
  RefreshCw,
  Send,
  Search,
  ClipboardCheck,
  Square,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  ajustarNomina,
  consultarNomina,
  emitirNominaPeriodo,
  listarNominaDocumentos,
  prepararNominaPeriodo,
  transmitirNomina,
  type DocumentoNomina,
  type PrevueloTrabajador,
  type ResultadoTrabajadorEmision,
  type TipoNotaAjuste,
} from "@/lib/erp/api-einvoicing"
import {
  ESTADO_EMISION_LABELS,
  ESTADO_PREVUELO_LABELS,
  emitirEnBucle,
  esMesValido,
  estadoPrevuelo,
  etiquetaDian,
  etiquetaTipoDocumento,
  mensajeErrorNominaPeriodo,
  mesAnterior,
  puedeAjustar,
  puedeConsultar,
  puedeReintentar,
  resumenEmision,
  resumenPrevuelo,
  tonoDian,
  tonoEmision,
  type EstadoPrevuelo,
  type ProgresoEmision,
  type TonoDian,
  type TonoResultado,
} from "@/lib/erp/nomina-electronica-periodo"
import { useLoadEffect } from "@/hooks/use-load-effect"
import { fmtDate } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Field, NativeSelect } from "@/components/ui/field"
import { FormAlert } from "@/components/ui/form-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Variante = "default" | "secondary" | "outline" | "destructive"

const VARIANTE_PREVUELO: Record<EstadoPrevuelo, Variante> = {
  listo: "default",
  bloqueado: "destructive",
  ya_emitido: "outline",
}
const VARIANTE_TONO: Record<TonoResultado, Variante> = {
  ok: "default",
  aviso: "secondary",
  error: "destructive",
}
const VARIANTE_DIAN: Record<TonoDian, Variante> = {
  ok: "default",
  aviso: "secondary",
  error: "destructive",
  neutro: "outline",
}

export default function NominaElectronicaPage() {
  const { hasPermission } = useAuth()
  const permitido = hasPermission("payroll.einvoice")
  const confirm = useConfirm()

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState("")
  const [periodo, setPeriodo] = React.useState(() => mesAnterior())
  const [cargandoSedes, setCargandoSedes] = React.useState(true)

  const [prevuelo, setPrevuelo] = React.useState<PrevueloTrabajador[] | null>(null)
  const [revisando, setRevisando] = React.useState(false)
  const [errorRevision, setErrorRevision] = React.useState<string | null>(null)

  const [emitiendo, setEmitiendo] = React.useState(false)
  const [progreso, setProgreso] = React.useState<ProgresoEmision | null>(null)
  const [resultados, setResultados] = React.useState<ResultadoTrabajadorEmision[] | null>(null)
  const [avisoEmision, setAvisoEmision] = React.useState<string | null>(null)
  const [errorEmision, setErrorEmision] = React.useState<string | null>(null)
  const señal = React.useRef({ aborted: false })

  const [docs, setDocs] = React.useState<DocumentoNomina[] | null>(null)
  const [cargandoDocs, setCargandoDocs] = React.useState(false)
  const [errorDocs, setErrorDocs] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState<string | null>(null)
  const [mensajeDoc, setMensajeDoc] = React.useState<{ id: string; texto: string; error: boolean } | null>(null)

  React.useEffect(() => {
    if (!permitido) return
    let activo = true
    listSedes()
      .then((s) => {
        if (!activo) return
        const activas = s.filter((x) => x.active)
        setSedes(activas)
        setSedeId((actual) => actual || activas[0]?._id || "")
      })
      .catch((e) => activo && setErrorRevision(mensajeErrorNominaPeriodo(e)))
      .finally(() => activo && setCargandoSedes(false))
    return () => {
      activo = false
    }
  }, [permitido])

  const mesOk = esMesValido(periodo)
  const listo = mesOk && !!sedeId

  const cargarDocs = React.useCallback(async () => {
    if (!listo) return
    setCargandoDocs(true)
    setErrorDocs(null)
    try {
      setDocs(await listarNominaDocumentos(periodo, sedeId))
    } catch (e) {
      setErrorDocs(mensajeErrorNominaPeriodo(e))
    } finally {
      setCargandoDocs(false)
    }
  }, [listo, periodo, sedeId])

  // Al cambiar de sede o mes, lo mostrado deja de corresponder: se limpia.
  function limpiar() {
    setPrevuelo(null)
    setResultados(null)
    setAvisoEmision(null)
    setErrorEmision(null)
    setErrorRevision(null)
    setMensajeDoc(null)
    setDocs(null)
  }

  useLoadEffect(cargarDocs, permitido && listo)

  async function revisar() {
    setRevisando(true)
    setErrorRevision(null)
    setResultados(null)
    try {
      const r = await prepararNominaPeriodo(periodo, sedeId)
      setPrevuelo(r.trabajadores)
    } catch (e) {
      setPrevuelo(null)
      setErrorRevision(mensajeErrorNominaPeriodo(e))
    } finally {
      setRevisando(false)
    }
  }

  const resumen = prevuelo ? resumenPrevuelo(prevuelo) : null

  async function emitir() {
    if (!resumen) return
    const ok = await confirm({
      title: `Emitir ${resumen.listo} documento(s) ante la DIAN`,
      description: (
        <>
          Se firmarán y enviarán a la DIAN las nóminas electrónicas de {periodo} de los
          trabajadores marcados como listos. Es un documento fiscal: una vez aceptado solo
          se corrige con una nota de ajuste. Los bloqueados no se emiten.
        </>
      ),
      confirmLabel: "Emitir ante la DIAN",
    })
    if (!ok) return
    señal.current = { aborted: false }
    setEmitiendo(true)
    setProgreso({ llamadas: 0, procesados: 0, pendientes: null })
    setResultados([])
    setAvisoEmision(null)
    setErrorEmision(null)
    const r = await emitirEnBucle({
      emitir: (cursor) => emitirNominaPeriodo(periodo, sedeId, cursor),
      signal: señal.current,
      onProgreso: setProgreso,
    })
    setResultados(r.resultados)
    if (r.error) setErrorEmision(r.error)
    if (r.cancelado) {
      setAvisoEmision("Emisión cancelada. Lo ya enviado a la DIAN se conserva; puedes continuar emitiendo después.")
    }
    setEmitiendo(false)
    void cargarDocs()
    void revisar()
  }

  async function accionDoc(d: DocumentoNomina, fn: () => Promise<{ mensajes: string[]; dianStatus?: string }>, ok: string) {
    setOcupado(d.id)
    setMensajeDoc(null)
    try {
      const r = await fn()
      const texto = [ok, r.dianStatus ? `Estado DIAN: ${etiquetaDian(r.dianStatus)}.` : "", ...r.mensajes]
        .filter(Boolean)
        .join(" ")
      setMensajeDoc({ id: d.id, texto, error: false })
      toast.success(ok)
      await cargarDocs()
    } catch (e) {
      // El 409 del backend ya explica el motivo: se muestra tal cual.
      setMensajeDoc({ id: d.id, texto: mensajeErrorNominaPeriodo(e), error: true })
    } finally {
      setOcupado(null)
    }
  }

  async function ajustar(d: DocumentoNomina, tipo: TipoNotaAjuste) {
    const reemplazar = tipo === "reemplazar"
    const ok = await confirm({
      title: reemplazar ? `Corregir (reemplazar) ${d.fullNumber}` : `Eliminar ${d.fullNumber}`,
      description: reemplazar ? (
        <>
          Se emite ante la DIAN una nota de ajuste que reemplaza este documento con los valores
          recalculados desde las corridas de nómina actuales. El documento original queda
          superado. Si cambió la identidad del trabajador no se puede reemplazar.
        </>
      ) : (
        <>
          Se emite ante la DIAN una nota de ajuste que anula este documento: el trabajador queda
          sin nómina electrónica en {d.periodo}. Después puedes emitir uno nuevo.
        </>
      ),
      confirmLabel: reemplazar ? "Emitir ajuste" : "Eliminar ante la DIAN",
      destructive: !reemplazar,
    })
    if (!ok) return
    await accionDoc(
      d,
      () => ajustarNomina(d.id, tipo),
      reemplazar ? "Nota de ajuste de reemplazo enviada." : "Nota de eliminación enviada.",
    )
  }

  if (!permitido) {
    return (
      <>
        <PageHeader section="Personal" title="Nómina electrónica" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>payroll.einvoice</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        section="Personal"
        title="Nómina electrónica"
        description="Revisa el mes, emite la nómina electrónica de tus trabajadores ante la DIAN y corrige lo ya aceptado."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-3">
          <Field id="ne-sede" label="Sede" className="w-56">
            <NativeSelect
              id="ne-sede"
              value={sedeId}
              onChange={(v) => {
                limpiar()
                setSedeId(v)
              }}
              disabled={cargandoSedes || emitiendo}
              placeholder={cargandoSedes ? "Cargando…" : "Selecciona una sede"}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
            />
          </Field>
          <Field
            id="ne-mes"
            label="Mes (AAAA-MM)"
            className="w-40"
            error={periodo && !mesOk ? "Usa el formato 2026-10" : undefined}
          >
            <Input
              id="ne-mes"
              type="month"
              value={periodo}
              onChange={(e) => {
                limpiar()
                setPeriodo(e.target.value)
              }}
              disabled={emitiendo}
            />
          </Field>
          <Button onClick={() => void revisar()} disabled={!listo || revisando || emitiendo} className="gap-1.5">
            {revisando ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
            Revisar mes
          </Button>
        </CardContent>
      </Card>

      {errorRevision && (
        <div className="mb-4">
          <FormAlert>{errorRevision}</FormAlert>
        </div>
      )}

      {prevuelo && resumen && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Revisión de {periodo}
              <Badge variant="default">{resumen.listo} listos</Badge>
              <Badge variant="destructive">{resumen.bloqueado} bloqueados</Badge>
              <Badge variant="outline">{resumen.ya_emitido} ya emitidos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-2">
            {prevuelo.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay trabajadores con nómina en este mes y sede. Liquida primero la nómina.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trabajador</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Qué falta o conviene revisar</TableHead>
                      <TableHead className="text-right">Ficha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prevuelo.map((t) => {
                      const e = estadoPrevuelo(t)
                      return (
                        <TableRow key={t.empleadoId}>
                          <TableCell className="font-medium">
                            {t.nombre}
                            {t.documentoExistente && (
                              <span className="block text-xs text-muted-foreground">
                                {t.documentoExistente.fullNumber} · {etiquetaDian(t.documentoExistente.dianStatus)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_PREVUELO[e]}>{ESTADO_PREVUELO_LABELS[e]}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {t.bloqueos.length === 0 && t.advertencias.length === 0 ? (
                              <span className="text-muted-foreground">Sin observaciones</span>
                            ) : (
                              <ul className="flex flex-col gap-1 text-sm">
                                {t.bloqueos.map((b, i) => (
                                  <li key={`b${i}`} className="flex gap-1.5 text-destructive">
                                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                                    {b}
                                  </li>
                                ))}
                                {t.advertencias.map((a, i) => (
                                  <li key={`a${i}`} className="text-muted-foreground">
                                    · {a}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {e === "bloqueado" && (
                              <Link
                                href={`/panel/empleados?editar=${t.empleadoId}`}
                                className="text-sm text-primary underline-offset-4 hover:underline"
                              >
                                Corregir en la ficha
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-3">
              <Button onClick={() => void emitir()} disabled={emitiendo || resumen.listo === 0} className="gap-1.5">
                <Send className="size-4" />
                Emitir los listos ({resumen.listo})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(emitiendo || resultados) && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {emitiendo ? "Emitiendo ante la DIAN…" : "Resultado de la emisión"}
              {resultados && !emitiendo && <ResumenEmision rs={resultados} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {emitiendo && progreso && (
              <div className="flex flex-wrap items-center gap-3" role="status" aria-live="polite">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span className="text-sm">
                  {progreso.procesados} procesados
                  {progreso.pendientes !== null ? ` · ${progreso.pendientes} pendientes` : ""}
                </span>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => (señal.current.aborted = true)}>
                  <Square className="size-3.5" />
                  Cancelar
                </Button>
              </div>
            )}
            {avisoEmision && <p className="text-sm text-muted-foreground">{avisoEmision}</p>}
            {errorEmision && <FormAlert>{errorEmision}</FormAlert>}
            {resultados && resultados.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trabajador</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultados.map((r, i) => (
                      <TableRow key={`${r.empleadoId}-${i}`}>
                        <TableCell className="font-medium">{r.nombre}</TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_TONO[tonoEmision(r.estado)]}>{ESTADO_EMISION_LABELS[r.estado]}</Badge>
                        </TableCell>
                        <TableCell>{r.fullNumber ?? "—"}</TableCell>
                        <TableCell className="whitespace-normal text-sm text-muted-foreground">
                          {r.mensajes.join(" ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Documentos de {mesOk ? periodo : "—"}
            <Button
              variant="outline"
              size="icon"
              title="Actualizar"
              aria-label="Actualizar documentos"
              disabled={!listo || cargandoDocs}
              onClick={() => void cargarDocs()}
            >
              <RefreshCw className={`size-4 ${cargandoDocs ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-2">
          {errorDocs && (
            <div className="px-4 pb-3">
              <FormAlert>{errorDocs}</FormAlert>
            </div>
          )}
          {cargandoDocs && !docs ? (
            <div className="flex flex-col gap-2 px-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !listo ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Elige sede y mes.</p>
          ) : docs && docs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aún no hay documentos en este mes. Usa «Revisar mes» y luego «Emitir los listos».
            </p>
          ) : docs ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Trabajador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado DIAN</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <React.Fragment key={d.id}>
                      <TableRow className={d.vigente && !d.superado ? "" : "opacity-60"}>
                        <TableCell className="font-medium">{d.fullNumber}</TableCell>
                        <TableCell>
                          {d.empleado.nombre ?? "—"}
                          <span className="block text-xs text-muted-foreground">{d.empleado.documento}</span>
                        </TableCell>
                        <TableCell>
                          {etiquetaTipoDocumento(d)}
                          {d.superado && <span className="block text-xs text-muted-foreground">Superado</span>}
                          {!d.vigente && <span className="block text-xs text-muted-foreground">No vigente</span>}
                        </TableCell>
                        <TableCell>{fmtDate(d.issueDate)}</TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_DIAN[tonoDian(d.dianStatus)]}>{etiquetaDian(d.dianStatus)}</Badge>
                          {d.rechazoMotivo && (
                            <span className="mt-1 block max-w-xs whitespace-normal text-xs text-destructive">
                              {d.rechazoMotivo}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {puedeReintentar(d) && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ocupado === d.id}
                                onClick={() =>
                                  void accionDoc(d, () => transmitirNomina(d.id), "Reintento de envío realizado.")
                                }
                              >
                                <Send className="size-3.5" />
                                Reintentar envío
                              </Button>
                            )}
                            {puedeConsultar(d) && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ocupado === d.id}
                                onClick={() => void accionDoc(d, () => consultarNomina(d.id), "Estado consultado.")}
                              >
                                <Search className="size-3.5" />
                                Consultar estado
                              </Button>
                            )}
                            {puedeAjustar(d) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ocupado === d.id}
                                  onClick={() => void ajustar(d, "reemplazar")}
                                >
                                  <Pencil className="size-3.5" />
                                  Corregir (reemplazar)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ocupado === d.id}
                                  onClick={() => void ajustar(d, "eliminar")}
                                >
                                  <Trash2 className="size-3.5" />
                                  Eliminar
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {mensajeDoc?.id === d.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="whitespace-normal">
                            {mensajeDoc.error ? (
                              <FormAlert>{mensajeDoc.texto}</FormAlert>
                            ) : (
                              <p className="text-sm text-muted-foreground" role="status">
                                {mensajeDoc.texto}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}

function ResumenEmision({ rs }: { rs: ResultadoTrabajadorEmision[] }) {
  const r = resumenEmision(rs)
  return (
    <>
      {r.emitido > 0 && <Badge variant="default">{r.emitido} emitidos</Badge>}
      {r.existente > 0 && <Badge variant="outline">{r.existente} ya aceptados</Badge>}
      {r.en_curso > 0 && <Badge variant="secondary">{r.en_curso} en curso</Badge>}
      {r.bloqueado > 0 && <Badge variant="destructive">{r.bloqueado} bloqueados</Badge>}
      {r.error > 0 && <Badge variant="destructive">{r.error} con error</Badge>}
    </>
  )
}
