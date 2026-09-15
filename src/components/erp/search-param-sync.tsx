"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

/** Parámetro con el que el buscador principal abre una página ya filtrada. */
export const SEARCH_PARAM = "buscar"

function Sync({ onValue }: { onValue: (value: string) => void }) {
  const value = useSearchParams().get(SEARCH_PARAM)
  React.useEffect(() => {
    if (value !== null) onValue(value)
  }, [value, onValue])
  return null
}

/**
 * Pasa `?buscar=` al buscador de la página.
 *
 * Va en un componente aparte y con su propio `Suspense` porque
 * `useSearchParams` obliga a Next a renderizar en el cliente todo lo que queda
 * por encima del Suspense más cercano: puesto directo en la página, el build la
 * rechaza. Así solo este nodo vacío espera por la URL.
 */
export function SearchParamSync({
  onValue,
}: {
  onValue: (value: string) => void
}) {
  return (
    <React.Suspense fallback={null}>
      <Sync onValue={onValue} />
    </React.Suspense>
  )
}
