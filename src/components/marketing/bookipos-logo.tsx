import { cn } from "@/lib/utils";

/**
 * Isotipo BookiPos: un cuerpo redondeado con tres estelas de velocidad a la
 * izquierda y la esquina inferior derecha despegada como una calcomanía.
 *
 * La lectura es doble y deliberada: las estelas dicen "rápido" y la esquina
 * levantada dice "recibo" — que es exactamente lo que hace el producto,
 * cerrar cuentas sin que el negocio se detenga.
 *
 * Va en SVG y no en PNG a propósito: tiene que escalar de 20px en el sidebar
 * a 7rem en la portada, recolorearse solo según el tema, y animarse con
 * `draw`. Un bitmap no hace nada de eso.
 *
 * `draw` (0→1) controla cuánto se han extendido las estelas. Con 1 (valor por
 * defecto) el logo se ve completo, que es lo correcto para el nav y el footer;
 * la portada lo anima desde 0 para que la marca "arranque".
 *
 * `tone="light"` es la versión para fondos oscuros — cuerpo blanco y esquina
 * orquídea, tal cual el arte sobre marino. `tone="brand"` es la de fondos
 * claros: cuerpo orquídea y esquina en tinta.
 */
export function BookiPosMark({
  className,
  draw = 1,
  tone = "brand",
}: {
  className?: string;
  draw?: number;
  tone?: "brand" | "light";
}) {
  const t = Math.min(1, Math.max(0, draw));
  const light = tone === "light";

  // Cuerpo: rectángulo muy redondeado, esquina superior derecha la más suave.
  const cuerpo =
    "M28 8 H34 A8 8 0 0 1 42 16 V30 A10 10 0 0 1 32 40 H28 A8 8 0 0 1 20 32 V16 A8 8 0 0 1 28 8 Z";

  // Esquina despegada: media luna sobre el borde inferior derecho.
  const esquina = "M42 26.5 V30 A10 10 0 0 1 32 40 H28.5 C36 37.6 41.2 33.2 42 26.5 Z";

  // Estelas: la del medio es la más larga, como en el arte. Cada una entra
  // desde la derecha con su propio retardo, así el trazo se lee de dentro
  // hacia afuera en vez de aparecer entero de golpe.
  const estelas = [
    { y: 8.75, x: 13, retardo: 0.0 },
    { y: 17.25, x: 4, retardo: 0.18 },
    { y: 25.75, x: 9, retardo: 0.36 },
  ];

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {estelas.map((e, i) => {
        // Ventana propia por estela, normalizada a 0→1.
        const span = 0.64;
        const local = Math.min(1, Math.max(0, (t - e.retardo) / span));
        const ancho = 22 - e.x;
        return (
          <rect
            key={i}
            x={e.x}
            y={e.y}
            width={ancho}
            height={6.5}
            rx={3.25}
            className={light ? "fill-white" : "fill-brand-500"}
            style={{
              transform: `translateX(${(1 - local) * ancho}px)`,
              opacity: local,
              transformOrigin: "right center",
            }}
          />
        );
      })}

      <path d={cuerpo} className={light ? "fill-white" : "fill-brand-500"} />

      {/* Franja interior — el renglón del recibo. */}
      <rect
        x={26.5}
        y={18.5}
        width={12}
        height={4}
        rx={1.5}
        className={light ? "fill-brand-500" : "fill-brand-950"}
        opacity={0.32}
      />

      <path d={esquina} className={light ? "fill-brand-500" : "fill-brand-950"} />
    </svg>
  );
}

/**
 * Isotipo + palabra. Para nav, footer y cualquier uso de tamaño normal.
 *
 * `tone="light"` es la versión para fondos oscuros: isotipo blanco y palabra
 * en blanco. En claro, isotipo orquídea y palabra en la tinta del wordmark
 * (brand-950), que es la muestra exacta del arte original.
 */
export function BookiPosLogo({
  className,
  markClassName,
  tone = "dark",
}: {
  className?: string;
  markClassName?: string;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BookiPosMark
        className={cn("h-7 w-7", markClassName)}
        tone={light ? "light" : "brand"}
      />
      <span
        className={cn(
          "text-[1.35rem] font-extrabold tracking-[-0.035em] transition-colors duration-300",
          light ? "text-white" : "text-brand-950",
        )}
      >
        BookiPos
      </span>
    </span>
  );
}
