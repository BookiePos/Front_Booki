"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Check, X, FolderTree } from "lucide-react"
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type InvProduct,
  type InvCategory,
} from "@/lib/erp/api-inventory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormDialog, FormSection } from "@/components/ui/form-dialog"
import { Field } from "@/components/ui/field"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { errorMessage } from "@/components/inventario/helpers"
import { FormError } from "@/components/inventario/ui-comunes"

// ─── Categories sheet (crear, renombrar, eliminar) ───────────────────────────

export interface CategoriesSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: InvCategory[]
  products: InvProduct[]
  onChanged: () => void
}

export function CategoriesSheet({
  open,
  onOpenChange,
  categories,
  products,
  onChanged,
}: CategoriesSheetProps) {
  const [newName, setNewName] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const confirm = useConfirm()

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setNewName("")
      setEditingId(null)
      setEditName("")
      setError(null)
    }
    void reset()
  }, [open])

  // Cuántos ítems usan cada categoría (para avisar antes de eliminar).
  const usage = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const id = p.categoryId?._id
      if (id) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [products])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      await createCategory(name)
      setNewName("")
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      await updateCategory(id, name)
      setEditingId(null)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(cat: InvCategory) {
    if (
      !(await confirm({
        title: `¿Eliminar la categoría "${cat.name}"?`,
        destructive: true,
      }))
    )
      return
    setBusy(true)
    setError(null)
    try {
      await deleteCategory(cat._id)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={FolderTree}
      title="Categorías"
      description="Los grupos del catálogo: bebidas, aseo, panadería. Solo se pueden eliminar las que no tengan ítems."
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Listo
        </Button>
      }
    >
      <FormError error={error} />

      <FormSection title="Agregar una categoría" help={{ term: "categoria" }}>
        <form onSubmit={handleCreate} className="flex items-end gap-2">
          <Field id="cat-new" label="Nombre" className="flex-1">
            <Input
              id="cat-new"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Bebidas, aseo, panadería…"
            />
          </Field>
          <Button
            type="submit"
            className="shrink-0"
            disabled={busy || !newName.trim()}
          >
            <Plus />
            Agregar
          </Button>
        </form>
      </FormSection>

      <FormSection
        title="Categorías del catálogo"
        description={
          categories.length > 0 ? `${categories.length} en total.` : undefined
        }
      >
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay categorías. Agrega la primera arriba.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {categories.map((cat) => {
              const count = usage.get(cat._id) ?? 0
              const isEditing = editingId === cat._id
              return (
                <li
                  key={cat._id}
                  className="flex items-center gap-2 bg-card px-3.5 py-2.5"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        aria-label={`Nuevo nombre de ${cat.name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void handleRename(cat._id)
                          }
                          if (e.key === "Escape") setEditingId(null)
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Guardar nombre"
                        disabled={busy || !editName.trim()}
                        onClick={() => void handleRename(cat._id)}
                      >
                        <Check />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Cancelar edición"
                        onClick={() => setEditingId(null)}
                      >
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {cat.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {count} ítem{count !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Renombrar ${cat.name}`}
                        onClick={() => {
                          setEditingId(cat._id)
                          setEditName(cat.name)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${cat.name}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={busy}
                        onClick={() => void handleDelete(cat)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </FormSection>
    </FormDialog>
  )
}
