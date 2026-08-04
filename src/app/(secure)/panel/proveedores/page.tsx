"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  Building2,
  ShieldOff,
  Power,
  PowerOff,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  setSupplierStatus,
  SUPPLIER_DOC_TYPE_LABELS,
  type Supplier,
  type SupplierDocType,
} from "@/lib/erp/api-suppliers"

import { PageHeader } from "@/components/erp/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

const DOC_TYPES: SupplierDocType[] = ["NIT", "CC", "CE"]

function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  )
}

function TableSkeleton({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Supplier sheet (crear / editar) ─────────────────────────────────────────

interface SupplierSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  supplier?: Supplier
  onSuccess: () => void
}

function SupplierSheet({
  open,
  onOpenChange,
  mode,
  supplier,
  onSuccess,
}: SupplierSheetProps) {
  const [name, setName] = React.useState("")
  const [docType, setDocType] = React.useState<SupplierDocType>("NIT")
  const [docNumber, setDocNumber] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [city, setCity] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (mode === "edit" && supplier) {
        setName(supplier.name)
        setDocType(supplier.docType)
        setDocNumber(supplier.docNumber)
        setPhone(supplier.phone ?? "")
        setEmail(supplier.email ?? "")
        setContactName(supplier.contactName ?? "")
        setAddress(supplier.address ?? "")
        setCity(supplier.city ?? "")
        setCategory(supplier.category ?? "")
        setNotes(supplier.notes ?? "")
      } else {
        setName("")
        setDocType("NIT")
        setDocNumber("")
        setPhone("")
        setEmail("")
        setContactName("")
        setAddress("")
        setCity("")
        setCategory("")
        setNotes("")
      }
      setError(null)
    }
    void reset()
  }, [open, mode, supplier])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        docType,
        docNumber: docNumber.trim(),
        phone: phone.trim(),
        email: email.trim(),
        contactName: contactName.trim(),
        address: address.trim(),
        city: city.trim(),
        category: category.trim(),
        notes: notes.trim(),
      }
      if (mode === "create") {
        await createSupplier({
          ...payload,
          phone: payload.phone || undefined,
          email: payload.email || undefined,
          contactName: payload.contactName || undefined,
          address: payload.address || undefined,
          city: payload.city || undefined,
          category: payload.category || undefined,
          notes: payload.notes || undefined,
        })
      } else if (supplier) {
        // En edición la cadena vacía sí viaja: significa quitar el dato.
        await updateSupplier(supplier._id, payload)
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {mode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Inscribe un proveedor para llevar el control de tus compras."
              : "Modifica los datos del proveedor."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-name">Nombre o razón social</Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Distribuidora ABC S.A.S."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-doctype">Tipo de documento</Label>
              <Select
                value={docType}
                items={SUPPLIER_DOC_TYPE_LABELS}
                onValueChange={(v) => {
                  if (v !== null) setDocType(v as SupplierDocType)
                }}
              >
                <SelectTrigger id="s-doctype" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SUPPLIER_DOC_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-docnumber">Número de documento</Label>
              <Input
                id="s-docnumber"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="p. ej. 900123456"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-phone">Teléfono</Label>
              <Input
                id="s-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-contact">Nombre de contacto</Label>
            <Input
              id="s-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-address">Dirección</Label>
              <Input
                id="s-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-city">Ciudad</Label>
              <Input
                id="s-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-category">Categoría</Label>
            <Input
              id="s-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="p. ej. Carnes, lácteos, aseo (opcional)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-notes">Notas</Label>
            <Input
              id="s-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <FormError error={error} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !docNumber.trim()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProveedoresPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("inventory.view")
  const canManage = hasPermission("inventory.adjust")

  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState("")
  const [includeInactive, setIncludeInactive] = React.useState(false)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editingSupplier, setEditingSupplier] = React.useState<
    Supplier | undefined
  >()

  const fetchSuppliers = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSuppliers(await listSuppliers(includeInactive))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  React.useEffect(() => {
    if (!canView) return
    void fetchSuppliers()
  }, [canView, fetchSuppliers])

  async function handleToggleStatus(s: Supplier) {
    try {
      await setSupplierStatus(s._id, !s.active)
      void fetchSuppliers()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  if (!canView) {
    return (
      <>
        <PageHeader
          section="Comercial"
          title="Proveedores"
          description="Inscribe y administra los proveedores del restaurante."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver los proveedores. Contacta al
              administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.docNumber.toLowerCase().includes(q) ||
      (s.category ?? "").toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <>
      <PageHeader
        section="Comercial"
        title="Proveedores"
        description="Inscribe y administra los proveedores del restaurante."
        actions={
          canManage ? (
            <Button
              data-tour="proveedores-nuevo"
              onClick={() => {
                setSheetMode("create")
                setEditingSupplier(undefined)
                setSheetOpen(true)
              }}
            >
              <Plus />
              Nuevo proveedor
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Directorio</CardTitle>
            <CardDescription>
              {suppliers.length} proveedor(es) registrados
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-tour="proveedores-inactivos"
            >
              <Checkbox
                checked={includeInactive}
                onCheckedChange={(v) => setIncludeInactive(Boolean(v))}
              />
              Incluir inactivos
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o documento…"
              className="w-full sm:w-64"
              data-tour="proveedores-buscar"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton cols={5} />
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Building2 className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {suppliers.length === 0
                  ? "Aún no hay proveedores. Crea el primero con “Nuevo proveedor”."
                  : "Sin resultados para la búsqueda."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{s.name}</span>
                        {(s.category || s.city) && (
                          <span className="max-w-56 truncate text-xs text-muted-foreground">
                            {[s.category, s.city].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{s.docType} </span>
                      <span className="font-mono text-xs">{s.docNumber}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.phone || s.email || s.contactName ? (
                        <div className="flex flex-col">
                          {s.contactName && <span>{s.contactName}</span>}
                          <span className="text-xs text-muted-foreground">
                            {[s.phone, s.email].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.active ? "secondary" : "outline"}>
                        {s.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${s.name}`}
                            onClick={() => {
                              setSheetMode("edit")
                              setEditingSupplier(s)
                              setSheetOpen(true)
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={
                              s.active
                                ? `Desactivar ${s.name}`
                                : `Activar ${s.name}`
                            }
                            title={s.active ? "Desactivar" : "Activar"}
                            onClick={() => void handleToggleStatus(s)}
                          >
                            {s.active ? <PowerOff /> : <Power />}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SupplierSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        supplier={editingSupplier}
        onSuccess={() => void fetchSuppliers()}
      />
    </>
  )
}
