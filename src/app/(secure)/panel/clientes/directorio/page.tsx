"use client"

import * as React from "react"
import { ShieldOff, Users, Plus, RefreshCw, Loader2, Search, Pencil } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  type Customer,
  type CustomerDocType,
} from "@/lib/erp/api-customers"
import { money, errorMessage } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

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
      <PageHeader
        section="Comercial"
        title="Directorio de clientes"
        description="Base de datos de clientes para facturación y cuentas por cobrar."
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
                <TableHead className="text-right">Cupo</TableHead>
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
        <CustomerSheet
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

function CustomerSheet({
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
      setActive(editing.active)
    } else {
      setName("")
      setDocType("CC")
      setDocNumber("")
      setPhone("")
      setEmail("")
      setCity("")
      setCreditLimit("0")
      setActive(true)
    }
  }, [customer, editing])

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
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Nuevo cliente" : "Editar cliente"}</SheetTitle>
          <SheetDescription>Datos del cliente para facturación y CxC.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nombre / razón social</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Tipo doc.</Label>
              <select
                className={inputClass}
                value={docType}
                onChange={(e) => setDocType(e.target.value as CustomerDocType)}
                disabled={!isNew}
              >
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <Label className="text-xs">Documento</Label>
              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                disabled={!isNew}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Ciudad</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Correo</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Cupo de crédito (fiado)</Label>
            <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          </div>
          {!isNew && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Cliente activo
            </label>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="mt-2 flex justify-end gap-2 pb-4">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={busy || !name.trim() || (isNew && !docNumber.trim())}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isNew ? "Registrar" : "Guardar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
