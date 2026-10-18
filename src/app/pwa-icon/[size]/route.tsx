import { ImageResponse } from "next/og"

/**
 * Iconos PNG de la PWA, generados desde el mismo logo de `icon.svg`.
 * `512-maskable` deja margen de seguridad (el SO recorta con su propia forma).
 */
const TAMANOS: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "512-maskable": { px: 512, maskable: true },
}

const LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g transform="translate(1.5 0) scale(0.94)">` +
      `<rect x="13" y="8.75" width="9" height="6.5" rx="3.25" fill="#ffffff"/>` +
      `<rect x="4" y="17.25" width="18" height="6.5" rx="3.25" fill="#ffffff"/>` +
      `<rect x="9" y="25.75" width="13" height="6.5" rx="3.25" fill="#ffffff"/>` +
      `<path d="M28 8 H34 A8 8 0 0 1 42 16 V30 A10 10 0 0 1 32 40 H28 A8 8 0 0 1 20 32 V16 A8 8 0 0 1 28 8 Z" fill="#ffffff"/>` +
      `<path d="M42 26.5 V30 A10 10 0 0 1 32 40 H28.5 C36 37.6 41.2 33.2 42 26.5 Z" fill="#b160e4"/>` +
      `</g></svg>`,
  )

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params
  const cfg = TAMANOS[size]
  if (!cfg) return new Response("No encontrado", { status: 404 })
  const logo = Math.round(cfg.px * (cfg.maskable ? 0.56 : 0.72))
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#00081c",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} width={logo} height={logo} alt="" />
      </div>
    ),
    { width: cfg.px, height: cfg.px },
  )
}
