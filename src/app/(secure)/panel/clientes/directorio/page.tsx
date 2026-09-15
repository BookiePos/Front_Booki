"use client"

import * as React from "react"
import { SearchParamSync } from "@/components/erp/search-param-sync"
import { ShieldOff, Users, Plus, RefreshCw, Search, Pencil } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  type Customer,
  type CustomerDocType,
} from "@/lib/erp/api-customers"
import { money, errorMessage } from "@/lib/erp/finance-format"
import { listPriceLists, type PriceList } from "@/lib/erp/api-catalog"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
  CheckboxField,
} from "@/components/ui/field"
import { Termino } from "@/components/ui/help-tip"

const DOC_TYPES: CustomerDocType[] = ["CC", "NIT", "CE", "PAS"]

export default function DirectorioClientesPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("customers.view")
  const canManage = hasPermission("customers.manage")

  const [rows, setRows] = React.useState<Customer[]>([])
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Customer | null>(null)
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listCustomers({ search: search.trim() || undefined, includeInactive: true }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [search])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Comercial" title="Directorio de clientes" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>customers.view</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <SearchParamSync onValue={setSearch} />
      <PageHeader
        section="Comercial"
        title="Directorio de clientes"
        description={
          <>
            Quiénes son tus clientes, con el <Termino>cupo</Termino> que le dejas
            fiar a cada uno. De aquí salen los datos de la factura y las{" "}
            <Termino>cuentas por cobrar</Termino>.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManage && (
              <Button className="gap-1.5" onClick={() => setCreating(true)} data-tour="clientes-dir-nuevo">
                <Plus className="size-4" />
                Nuevo cliente
              </Button>
            )}
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex items-center gap-2 py-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            className="max-w-sm"
            data-tour="clientes-dir-buscar"
            placeholder="Buscar por nombre, documento o teléfono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load()}
          />
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Buscar
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card data-tour="clientes-dir-tabla">
        <CardContent className="px-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                <TableHead className="hidden md:table-cell">Ciudad</TableHead>
                <TableHead className="text-right">
                  <Termino>Cupo</Termino>
                </TableHead>
                <TableHead className="text-center">Estado</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                rows.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.docType} {c.docNumber}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {c.phone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.city ?? "—"}
                    </TableCell>
                    <TableCell className="tnum text-right">
                      {c.creditLimit > 0 ? money.format(c.creditLimit) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.active ? "default" : "secondary"}>
                        {c.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 size-8 opacity-40" />
                    No hay clientes registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <CustomerDialog
          customer={creating ? "new" : editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={load}
        />
      )}
    </>
  )
}

function CustomerDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | "new" | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isNew = customer === "new"
  const editing = customer && customer !== "new" ? customer : null

  const [name, setName] = React.useState("")
  const [docType, setDocType] = React.useState<CustomerDocType>("CC")
  const [docNumber, setDocNumber] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [city, setCity] = React.useState("")
  const [creditLimit, setCreditLimit] = React.useState("0")
  // Lista con la que se le cobra. Vacío = precio de mostrador.
  const [priceListId, setPriceListId] = React.useState("")
  const [priceLists, setPriceLists] = React.useState<PriceList[]>([])
  const [active, setActive] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!customer) return
    setErr(null)
    if (editing) {
      setName(editing.name)
      setDocType(editing.docType)
      setDocNumber(editing.docNumber)
      setPhone(editing.phone ?? "")
      setEmail(editing.email ?? "")
      setCity(editing.city ?? "")
      setCreditLimit(String(editing.creditLimit ?? 0))
      setPriceListId(editing.priceListId ?? "")
      setActive(editing.active)
    } else {
      setName("")
      setDocType("CC")
      setDocNumber("")
      setPhone("")
      setEmail("")
      setCity("")
      setCreditLimit("0")
      setPriceListId("")
      setActive(true)
    }
  }, [customer, editing])

  // Las listas se cargan al abrir la ficha. Si falla, el selector se queda
  // vacío y deshabilitado: no poder elegir lista no debe impedir guardar el
  // cliente, que es lo que la persona vino a hacer.
  React.useEffect(() => {
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !customer) return
      try {
        const ls = await listPriceLists()
        if (vivo) setPriceLists(ls)
      } catch {
        if (vivo) setPriceLists([])
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [customer])

  if (!customer) return null

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      const base = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        creditLimit: Math.round(Number(creditLimit) || 0),
        // Cadena vacía = quitarle la lista y volver a cobrarle de mostrador.
        priceListId,
      }
      if (isNew) {
        await createCustomer({ ...base, docType, docNumber: docNumber.trim() })
      } else if (editing) {
        await updateCustomer(editing._id, { ...base, active })
      }
      await onSaved()
      onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={!!customer}
      onOpenChange={(o) => !o && onClose()}
      size="2xl"
      icon={isNew ? Plus : Pencil}
      title={isNew ? "Nuevo cliente" : "Editar cliente"}
      description="Los datos que salen en su factura y el cupo que le dejas fiar."
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => void save()}
          busy={busy}
          disabled={!name.trim() || (isNew && !docNumber.trim())}
          submitLabel={isNew ? "Registrar" : "Guardar"}
        />
      }
    >
      {err && <FormAlert>{err}</FormAlert>}

      <FormSection
        title="Identificación"
        description={
          isNew
            ? "El documento no se puede cambiar después: es lo que amarra al cliente con sus facturas."
            : "El documento no se edita para no romper el historial de facturas."
        }
      >
        <FieldGrid cols={3}>
          <FieldSpan span={3}>
            <Field id="c-name" label="Nombre o razón social" required>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="María Restrepo / Panadería El Trigal S.A.S."
              />
            </Field>
          </FieldSpan>

          <Field
            id="c-doctype"
            label="Tipo de documento"
            help={{ term: "tipoDocumento" }}
          >
            <NativeSelect
              id="c-doctype"
              value={docType}
              onChange={(v) => setDocType(v as CustomerDocType)}
              options={DOC_TYPES.map((d) => ({ value: d, label: d }))}
              disabled={!isNew}
            />
          </Field>
          <FieldSpan span={2}>
            <Field
              id="c-docnum"
              label="Número de documento"
              required={isNew}
              help={docType === "NIT" ? { term: "nit" } : undefined}
            >
              <Input
                id="c-docnum"
                inputMode="numeric"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                disabled={!isNew}
                placeholder="1020304050"
              />
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Contacto y crédito"
        description="Cómo lo ubicas y cuánto le dejas fiar."
      >
        <FieldGrid cols={3}>
          <Field id="c-phone" label="Teléfono">
            <Input
              id="c-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 123 4567"
            />
          </Field>
          <Field id="c-city" label="Ciudad">
            <Input
              id="c-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Medellín"
            />
          </Field>
          <Field id="c-email" label="Correo">
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@correo.com"
            />
          </Field>

          <Field
            id="c-credit"
            label="Cupo de crédito"
            help={{ term: "cupo" }}
            hint="Lo máximo que le dejas deber. Déjalo en 0 si no le fías."
          >
            <MoneyInput
              id="c-credit"
              value={Number(creditLimit) || 0}
              onValueChange={(v) => setCreditLimit(String(v ?? 0))}
              placeholder="0"
            />
          </Field>

          {/* La lista se aplica SOLA en cada venta que se le haga, pague como
              pague. Es lo que evita que el precio del mayorista dependa de que
              el cajero se acuerde de descontar a mano. */}
          <Field
            id="c-pricelist"
            label="Lista de precios"
            help={{ term: "listaPrecios" }}
            hint={
              priceLists.length === 0
                ? "Todavía no hay listas. Se crean en Productos → Listas de precios."
                : "Se le cobra con esta lista en todas sus compras. Vacío = precio de mostrador."
            }
          >
            <NativeSelect
              id="c-pricelist"
              value={priceListId}
              onChange={setPriceListId}
              options={[
                { value: "", label: "Precio de mostrador" },
                ...priceLists.map((l) => ({ value: l._id, label: l.name })),
              ]}
              disabled={priceLists.length === 0}
            />
          </Field>
        </FieldGrid>

        {!isNew && (
          <CheckboxField
            id="c-active"
            label="Cliente activo"
            hint="Un cliente inactivo deja de aparecer en el punto de venta, pero conserva su historial y su saldo."
            checked={active}
            onCheckedChange={setActive}
          />
        )}
      </FormSection>
    </FormDialog>
  )
}
