import type { Metadata } from "next"

// El token del enlace va en la URL: ningún recurso que cargue esta página debe
// recibirlo en el Referer (4.11). La cabecera la pone next.config.ts; esto es
// el respaldo en la propia página.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

export default function ConfirmarRegistroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
