"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { useRouter } from "next/navigation"
import {
  Boxes,
  Building2,
  Contact,
  Loader2,
  Package,
  Search,
  X,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { dashboardItem, getNavSections } from "@/lib/erp/navigation"
import { listProducts, type InvProduct } from "@/lib/erp/api-inventory"
import { listCatalogProducts, type CatalogProduct } from "@/lib/erp/api-catalog"
import { listCustomers, type Customer } from "@/lib/erp/api-customers"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { money } from "@/lib/erp/finance-format"
import { normalizeSearch } from "@/components/ui/searchable-select"
import { SEARCH_PARAM } from "@/components/erp/search-param-sync"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Result {
  id: string
  group: string
  title: string
  detail?: string
  href: string
  icon: React.ReactNode
}

interface Directory {
  inventory: InvProduct[]
  catalog: CatalogProduct[]
  customers: Customer[]
  suppliers: Supplier[]
}

/**
 * Cuánto se reutilizan los datos ya cargados. Buscar varias veces seguidas no
 * debe pedir todo otra vez, pero un producto creado hace un rato sí tiene que
 * aparecer.
 */
const CACHE_MS = 60_000
const PER_GROUP = 5

const ICON_CLASS = "size-4 shrink-0 text-muted-foreground"

function withParam(path: string, value: string): string {
  return `${path}?${SEARCH_PARAM}=${encodeURIComponent(value)}`
}

/**
 * Buscador principal del panel.
 *
 * Busca en los datos de la empresa —productos de inventario, productos de
 * venta, clientes y proveedores— y en las secciones del menú. Cada grupo solo
 * se consulta si el usuario tiene permiso para verlo, con los mismos permisos
 * que el menú lateral, así que nadie encuentra aquí lo que no podría abrir.
 *
 * Los datos se cargan al enfocar el buscador y no al abrir el panel: la
 * mayoría de las visitas no busca nada y no tiene por qué pagar esas consultas.
 * Elegir un resultado abre su página ya filtrada (`?buscar=`).
 */
export function GlobalSearch() {
  const { hasPermission, hasFeature, tipoNegocio } = useAuth()
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()

  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [directory, setDirectory] = React.useState<Directory | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const loadedAt = React.useRef(0)
  const loadingRef = React.useRef(false)

  const load = React.useCallback(async () => {
    if (loadingRef.current || Date.now() - loadedAt.current < CACHE_MS) return
    loadingRef.current = true
    setLoading(true)
    const canInventory = hasPermission("inventory.view")
    const [inventory, catalog, customers, suppliers] = await Promise.allSettled([
      canInventory ? listProducts() : Promise.resolve([] as InvProduct[]),
      canInventory
        ? listCatalogProducts()
        : Promise.resolve([] as CatalogProduct[]),
      hasPermission("customers.view")
        ? listCustomers()
        : Promise.resolve([] as Customer[]),
      canInventory && hasFeature("purchasing")
        ? listSuppliers()
        : Promise.resolve([] as Supplier[]),
    ])
    setDirectory({
      inventory: inventory.status === "fulfilled" ? inventory.value : [],
      catalog: catalog.status === "fulfilled" ? catalog.value : [],
      customers: customers.status === "fulfilled" ? customers.value : [],
      suppliers: suppliers.status === "fulfilled" ? suppliers.value : [],
    })
    setFailed(
      [inventory, catalog, customers, suppliers].some(
        (r) => r.status === "rejected",
      ),
    )
    loadedAt.current = Date.now()
    loadingRef.current = false
    setLoading(false)
  }, [hasPermission, hasFeature])

  const results = React.useMemo<Result[]>(() => {
    const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
    if (words.length === 0) return []
    const hit = (...fields: (string | undefined)[]) => {
      const haystack = normalizeSearch(fields.filter(Boolean).join(" "))
      return words.every((word) => haystack.includes(word))
    }
    const out: Result[] = []

    const sections = [
      { label: "", items: [dashboardItem] },
      ...getNavSections(tipoNegocio, hasPermission, hasFeature),
    ]
    const navHits = sections
      .flatMap((section) =>
        section.items.map((item) => ({ item, label: section.label })),
      )
      .filter(({ item, label }) => hit(item.title, label))
      .slice(0, PER_GROUP)
    for (const { item, label } of navHits) {
      out.push({
        id: `nav-${item.href}`,
        group: "Secciones",
        title: item.title,
        detail: label || undefined,
        href: item.href,
        icon: React.createElement(item.icon, {
          className: ICON_CLASS,
          "aria-hidden": true,
        }),
      })
    }

    if (!directory) return out

    for (const p of directory.inventory
      .filter((p) => hit(p.name, p.sku, p.barcode, p.brand))
      .slice(0, PER_GROUP)) {
      out.push({
        id: `inv-${p._id}`,
        group: "Inventario",
        title: p.name,
        detail: `SKU ${p.sku}${p.itemType === "assembly" ? " · Montaje" : ""}`,
        href: withParam("/panel/inventario", p.name),
        icon: <Boxes className={ICON_CLASS} aria-hidden />,
      })
    }
    for (const p of directory.catalog
      .filter((p) => hit(p.name, p.sku))
      .slice(0, PER_GROUP)) {
      out.push({
        id: `cat-${p._id}`,
        group: "Productos de venta",
        title: p.name,
        detail: `SKU ${p.sku} · ${money.format(p.salePrice)}`,
        href: withParam("/panel/productos", p.name),
        icon: <Package className={ICON_CLASS} aria-hidden />,
      })
    }
    for (const c of directory.customers
      .filter((c) => hit(c.name, c.docNumber, c.phone, c.email))
      .slice(0, PER_GROUP)) {
      out.push({
        id: `cli-${c._id}`,
        group: "Clientes",
        title: c.name,
        detail: [`${c.docType} ${c.docNumber}`, c.phone].filter(Boolean).join(" · "),
        href: withParam("/panel/clientes/directorio", c.name),
        icon: <Contact className={ICON_CLASS} aria-hidden />,
      })
    }
    for (const s of directory.suppliers
      .filter((s) => hit(s.name, s.docNumber, s.contactName, s.phone))
      .slice(0, PER_GROUP)) {
      out.push({
        id: `pro-${s._id}`,
        group: "Proveedores",
        title: s.name,
        detail: `${s.docType} ${s.docNumber}`,
        href: withParam("/panel/proveedores", s.name),
        icon: <Building2 className={ICON_CLASS} aria-hidden />,
      })
    }
    return out
  }, [query, directory, tipoNegocio, hasPermission, hasFeature])

  const focusInput = React.useCallback(() => {
    // `flushSync` pinta el buscador ANTES de enfocarlo: en el celular está
    // oculto, y el teclado del iPhone solo se abre si el foco llega dentro del
    // mismo toque.
    flushSync(() => setMobileOpen(true))
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        focusInput()
      } else if (event.key === "/" && !typing) {
        event.preventDefault()
        focusInput()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [focusInput])

  function close() {
    setOpen(false)
    setMobileOpen(false)
    setQuery("")
    // Se suelta el foco sin pasar por la ref: `close` se llama desde los
    // resultados que se pintan en el render y el compilador de React no deja
    // leer refs por ese camino.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  function go(result: Result) {
    router.push(result.href)
    close()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      )
    } else if (event.key === "Enter") {
      const result = results[active]
      if (result) {
        event.preventDefault()
        go(result)
      }
    } else if (event.key === "Escape") {
      event.preventDefault()
      close()
    }
  }

  const showPanel = open && query.trim() !== ""
  const activeResult = showPanel ? results[active] : undefined

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 sm:hidden"
        aria-label="Buscar"
        onClick={focusInput}
      >
        <Search />
      </Button>

      <div
        data-tour="buscar"
        className={cn(
          "ml-1 max-w-md flex-1",
          mobileOpen
            ? "absolute inset-x-0 top-0 z-40 m-0 flex h-16 max-w-none items-center gap-2 bg-card px-3 sm:static sm:ml-1 sm:h-auto sm:max-w-md sm:bg-transparent sm:px-0"
            : "hidden sm:block",
        )}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="topbar-search" className="sr-only">
            Buscar en BookiPos
          </label>
          <Input
            ref={inputRef}
            id="topbar-search"
            type="search"
            role="combobox"
            autoComplete="off"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeResult ? `${listId}-${activeResult.id}` : undefined
            }
            placeholder="Buscar productos, clientes, proveedores…"
            className="h-9 pl-9 lg:pr-16"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => {
              setOpen(true)
              void load()
            }}
            onBlur={() => {
              setOpen(false)
              if (!query) setMobileOpen(false)
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:block">
            Ctrl K
          </kbd>

          {showPanel && (
            <div
              id={listId}
              role="listbox"
              aria-label="Resultados de la búsqueda"
              // Sin esto, pulsar un resultado quita el foco del campo, el panel
              // se cierra y el clic no llega a ningún lado.
              onMouseDown={(event) => event.preventDefault()}
              className="absolute top-full left-0 z-50 mt-2 max-h-[min(70svh,32rem)] w-full min-w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
            >
              {loading && !directory ? (
                <p className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Cargando la información de tu negocio…
                </p>
              ) : results.length === 0 ? (
                <p className="px-2.5 py-3 text-sm text-muted-foreground">
                  Nada coincide con “{query.trim()}”.
                </p>
              ) : (
                results.map((result, index) => (
                  <React.Fragment key={result.id}>
                    {result.group !== results[index - 1]?.group && (
                      <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {result.group}
                      </p>
                    )}
                    <div
                      id={`${listId}-${result.id}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(result)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                        index === active && "bg-accent text-accent-foreground",
                      )}
                    >
                      {result.icon}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {result.title}
                        </span>
                        {result.detail && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {result.detail}
                          </span>
                        )}
                      </span>
                    </div>
                  </React.Fragment>
                ))
              )}
              {failed && (
                <p className="px-2.5 pt-2 pb-1 text-xs text-muted-foreground">
                  Parte de la información no se pudo cargar; vuelve a intentarlo
                  en un momento.
                </p>
              )}
            </div>
          )}
        </div>

        {mobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 sm:hidden"
            aria-label="Cerrar la búsqueda"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => close()}
          >
            <X />
          </Button>
        )}
      </div>
    </>
  )
}
