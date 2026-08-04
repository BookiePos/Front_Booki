"use client"

import { MapPin } from "lucide-react"

/**
 * Mapa de ubicación de una sede usando la API de Google Maps Embed.
 *
 * Geocodifica la dirección (modo `place`) — no requiere latitud/longitud, así
 * que funciona con las sedes existentes que solo tienen `address`. La API key
 * pública se toma de `NEXT_PUBLIC_GOOGLE_MAPS_KEY`.
 *
 * La Embed API (modo place) es gratuita e ilimitada; basta habilitar
 * "Maps Embed API" en la consola de Google Cloud y restringir la key por
 * dominio (HTTP referrer) para que sea segura al exponerse en el cliente.
 */

/**
 * Expande la abreviatura del tipo de vía al inicio de la dirección (dg → Diagonal,
 * cra → Carrera, cl → Calle…). Google geocodifica mal las abreviaturas locales
 * ("dg 52g" caía en una diagonal cercana equivocada); con el tipo de vía escrito
 * completo la dirección queda inequívoca.
 */
const STREET_TYPES: Record<string, string> = {
  cl: "Calle",
  cll: "Calle",
  calle: "Calle",
  cra: "Carrera",
  cr: "Carrera",
  kra: "Carrera",
  kr: "Carrera",
  carrera: "Carrera",
  av: "Avenida",
  avda: "Avenida",
  avenida: "Avenida",
  dg: "Diagonal",
  diag: "Diagonal",
  diagonal: "Diagonal",
  tv: "Transversal",
  trans: "Transversal",
  transv: "Transversal",
  transversal: "Transversal",
  autop: "Autopista",
  mz: "Manzana",
  mza: "Manzana",
}

function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/^([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\.?\s+/, (match, word: string) => {
      const key = word
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
      const full = STREET_TYPES[key]
      return full ? `${full} ` : match
    })
}
export function SedeMap({
  address,
  ciudad,
  departamento,
  name,
}: {
  address?: string | null
  ciudad?: string | null
  departamento?: string | null
  name?: string
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

  // Sin dirección no hay nada que geocodificar.
  if (!address || !address.trim()) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
        <MapPin className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Esta sede no tiene dirección registrada.
        </p>
        <p className="text-xs text-muted-foreground">
          Edítala y agrega una dirección para ver el mapa.
        </p>
      </div>
    )
  }

  // Sin API key el iframe no puede cargar: mostramos una guía en vez de un error.
  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
        <MapPin className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Mapa no configurado.</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Define <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> en{" "}
          <code className="font-mono">frontend/gocheck/.env.local</code> con tu
          API key de Google Maps (Maps Embed API) y reinicia el servidor.
        </p>
      </div>
    )
  }

  // Geocodificamos con la dirección COMPLETA (dirección + ciudad + departamento
  // + país). Sin la ciudad, una "Calle 10 #5-20" es ambigua y Google la ubica
  // en cualquier parte de Colombia; con ciudad y departamento cae en el punto
  // correcto. Se descartan los campos vacíos.
  const parts = [normalizeAddress(address), ciudad, departamento, "Colombia"]
    .map((p) => p?.trim())
    .filter(Boolean)
  const query = encodeURIComponent(parts.join(", "))
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&language=es&region=CO`

  return (
    <div className="flex flex-col gap-2">
      <iframe
        title={name ? `Mapa de ${name}` : "Mapa de la sede"}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="h-72 w-full rounded-lg border border-border"
      />
      {/* Escape hatch: si la geocodificación no cae exacta, el usuario puede
          abrir/verificar la ubicación en Google Maps. */}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
      >
        <MapPin className="size-3.5" />
        ¿No coincide? Ábrelo en Google Maps
      </a>
    </div>
  )
}
