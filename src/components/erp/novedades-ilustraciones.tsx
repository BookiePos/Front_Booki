import type { IlustracionNovedad } from "@/lib/novedades"

/**
 * Los dibujos de la tarjeta de novedades, a mano y en SVG.
 *
 * Explicar un cambio de pantalla con un párrafo es pedirle a quien está en el
 * mostrador que se imagine la pantalla. Un esquema se entiende antes de leerlo:
 * tres rectángulos en fila ya dicen "ahora cabe todo junto" sin una sola
 * palabra. No pretenden ser bonitos, pretenden ahorrar la lectura.
 *
 * Van en SVG en línea y no como imágenes porque tienen que escalar de un
 * monitor de caja a un celular, y porque así usan los colores de la marca
 * directamente: un PNG habría que rehacerlo cada vez que cambie la paleta.
 *
 * Todos están pensados sobre el fondo morado oscuro de la tarjeta, que es el
 * mismo en tema claro y oscuro. Por eso aquí se pinta con blancos y con la
 * escala `brand`, que no cambian con el tema; el verde de "así queda ahora" es
 * un `emerald-300` fijo y no el token `success` a propósito: en tema claro ese
 * token es un verde oscuro que sobre este morado no se leería.
 */
export function IlustracionPagina({
  tipo,
  className,
}: {
  tipo: IlustracionNovedad
  className?: string
}) {
  if (tipo === "columnas-cobro") return <ColumnasCobro className={className} />
  if (tipo === "orden-inventario") return <OrdenInventario className={className} />
  return <CifrasClaras className={className} />
}

/**
 * Cobro: las tres columnas nuevas, y al lado la columna angosta de antes en
 * gris. La comparación es el dibujo — una sola de las dos no explicaría nada.
 */
function ColumnasCobro({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 180"
      role="img"
      aria-label="Antes el cobro iba en una columna angosta y tocaba bajar. Ahora son tres columnas a la vez: la venta, el pago con la devuelta, y el cliente."
      className={className}
    >
      <text x="10" y="14" fontSize="12" fontWeight="700" className="fill-brand-200">
        Ahora
      </text>
      <text x="294" y="14" fontSize="12" fontWeight="700" className="fill-white/45">
        Antes
      </text>

      {/* Columna 1: lo que se está cobrando. */}
      <rect
        x="10"
        y="24"
        width="78"
        height="142"
        rx="12"
        className="fill-white/10 stroke-white/25"
      />
      <text x="49" y="46" fontSize="11" fontWeight="700" textAnchor="middle" className="fill-white">
        La venta
      </text>
      <rect x="22" y="60" width="54" height="7" rx="3.5" className="fill-white/25" />
      <rect x="22" y="74" width="54" height="7" rx="3.5" className="fill-white/25" />
      <rect x="22" y="88" width="54" height="7" rx="3.5" className="fill-white/25" />
      <rect x="22" y="102" width="34" height="7" rx="3.5" className="fill-white/25" />

      {/* Columna 2: el pago, con la devuelta y el botón siempre a la vista. */}
      <rect
        x="94"
        y="24"
        width="94"
        height="142"
        rx="12"
        className="fill-white/10 stroke-white/25"
      />
      <text x="141" y="46" fontSize="11" fontWeight="700" textAnchor="middle" className="fill-white">
        El pago
      </text>
      <rect
        x="104"
        y="56"
        width="74"
        height="34"
        rx="10"
        className="fill-white/15 stroke-white/25"
      />
      <text x="141" y="79" fontSize="15" fontWeight="700" textAnchor="middle" className="fill-white">
        $45.000
      </text>
      <text x="141" y="106" fontSize="10" textAnchor="middle" className="fill-brand-200">
        Devuelta $5.000
      </text>
      <rect x="104" y="120" width="74" height="28" rx="9" className="fill-white" />
      <text
        x="141"
        y="138"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        className="fill-brand-900"
      >
        Cobrar
      </text>

      {/* Columna 3: cliente y domicilio. */}
      <rect
        x="194"
        y="24"
        width="78"
        height="142"
        rx="12"
        className="fill-white/10 stroke-white/25"
      />
      <text x="233" y="46" fontSize="11" fontWeight="700" textAnchor="middle" className="fill-white">
        El cliente
      </text>
      <circle cx="233" cy="66" r="9" className="fill-white/30" />
      <path d="M218 88a15 13 0 0 1 30 0z" className="fill-white/20" />
      <rect x="206" y="100" width="54" height="7" rx="3.5" className="fill-white/25" />
      <rect x="206" y="114" width="38" height="7" rx="3.5" className="fill-white/25" />
      <text x="233" y="140" fontSize="10" textAnchor="middle" className="fill-brand-200">
        Domicilio
      </text>

      <line x1="283" y1="20" x2="283" y2="170" strokeDasharray="4 5" className="stroke-white/20" />

      {/* El antes: una tira estrecha y larga, que es justo lo que se sentía. */}
      <rect
        x="294"
        y="24"
        width="56"
        height="142"
        rx="12"
        strokeDasharray="5 5"
        className="fill-white/5 stroke-white/20"
      />
      <rect x="302" y="36" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="48" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="60" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="72" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="84" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="96" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="108" width="40" height="5" rx="2.5" className="fill-white/15" />
      <rect x="302" y="120" width="40" height="5" rx="2.5" className="fill-white/15" />
      <path
        d="M322 134v16m-6-6 6 6 6-6"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-white/45"
      />
    </svg>
  )
}

/** Inventario: el orden de los tres pasos, numerado y con flechas. */
function OrdenInventario({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label="El orden es uno, Inventario, lo que compras; dos, Producto, lo que vendes; tres, Caja, lo que cobras."
      className={className}
    >
      <Paso x={6} numero="1" titulo="Inventario" pie="lo que compras" />
      <Flecha x={110} />
      <Paso x={131} numero="2" titulo="Producto" pie="lo que vendes" />
      <Flecha x={235} />
      <Paso x={256} numero="3" titulo="Caja" pie="lo que cobras" />
      <text x="180" y="142" fontSize="11" textAnchor="middle" className="fill-brand-200">
        Siempre en este orden
      </text>
    </svg>
  )
}

function Paso({
  x,
  numero,
  titulo,
  pie,
}: {
  x: number
  numero: string
  titulo: string
  pie: string
}) {
  const centro = x + 49
  return (
    <>
      <rect
        x={x}
        y="26"
        width="98"
        height="96"
        rx="14"
        className="fill-white/10 stroke-white/25"
      />
      <circle cx={centro} cy="48" r="13" className="fill-white/15 stroke-white/35" />
      <text
        x={centro}
        y="53"
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        className="fill-white"
      >
        {numero}
      </text>
      <text
        x={centro}
        y="84"
        fontSize="13"
        fontWeight="700"
        textAnchor="middle"
        className="fill-white"
      >
        {titulo}
      </text>
      <text x={centro} y="103" fontSize="10" textAnchor="middle" className="fill-brand-200">
        {pie}
      </text>
    </>
  )
}

function Flecha({ x }: { x: number }) {
  return (
    <path
      d={`M${x} 74h15m-5-5 5 5-5 5`}
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-brand-200"
    />
  )
}

/**
 * Cifras: arriba el campo de precio antes y después; abajo el bulto con su
 * contenido. Son los dos cambios que se cuentan en esa página, uno encima del
 * otro, porque son la misma idea — que la cuenta la haga el sistema.
 */
function CifrasClaras({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 190"
      role="img"
      aria-label="Antes se escribía 45000 a secas y ahora se ve 45.000 pesos con su punto. Un bulto de harina de 25 kilos entra al inventario como 25.000 gramos."
      className={className}
    >
      <text x="10" y="14" fontSize="11" fontWeight="700" className="fill-white/45">
        Antes
      </text>
      <rect
        x="10"
        y="22"
        width="120"
        height="42"
        rx="11"
        strokeDasharray="5 5"
        className="fill-white/5 stroke-white/20"
      />
      <text x="70" y="50" fontSize="17" textAnchor="middle" className="fill-white/50">
        45000
      </text>
      <line x1="42" y1="43" x2="98" y2="43" strokeWidth="2" className="stroke-white/45" />

      <path
        d="M144 43h22m-6-6 6 6-6 6"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-brand-200"
      />

      <text x="182" y="14" fontSize="11" fontWeight="700" className="fill-brand-200">
        Ahora
      </text>
      <rect
        x="182"
        y="22"
        width="150"
        height="42"
        rx="11"
        className="fill-emerald-300/15 stroke-emerald-300/45"
      />
      <text
        x="257"
        y="52"
        fontSize="22"
        fontWeight="700"
        textAnchor="middle"
        className="fill-emerald-300"
      >
        $45.000
      </text>

      <line x1="10" y1="84" x2="350" y2="84" className="stroke-white/15" />

      {/* El bulto: el cuello amarrado de arriba es lo que lo hace reconocible
          como costal y no como una caja —o como un bolso, que es lo que
          parecía cuando el remate era un asa curva—. */}
      <rect
        x="40"
        y="106"
        width="76"
        height="54"
        rx="10"
        className="fill-white/12 stroke-white/30"
      />
      <path d="M62 106l6-14h20l6 14z" className="fill-white/20 stroke-white/30" />
      <text x="78" y="139" fontSize="16" fontWeight="700" textAnchor="middle" className="fill-white">
        25 kg
      </text>
      <text x="78" y="178" fontSize="11" textAnchor="middle" className="fill-brand-200">
        1 bulto de harina
      </text>

      <path
        d="M128 133h22m-6-6 6 6-6 6"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-brand-200"
      />

      <rect
        x="170"
        y="106"
        width="150"
        height="54"
        rx="10"
        className="fill-white/10 stroke-white/25"
      />
      <text
        x="245"
        y="139"
        fontSize="19"
        fontWeight="700"
        textAnchor="middle"
        className="fill-white"
      >
        25.000 g
      </text>
      <text x="245" y="178" fontSize="11" textAnchor="middle" className="fill-brand-200">
        lo que suma en inventario
      </text>
    </svg>
  )
}
