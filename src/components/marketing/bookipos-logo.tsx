import { cn } from "@/lib/utils";

/*
 * Geometría del isotipo, calcada del arte original (public/brand/bookipos-og.jpg)
 * con una cuadrícula encima: un recibo con tres estelas de velocidad a la
 * izquierda y la esquina inferior derecha despegándose.
 *
 * La versión anterior aproximaba el arte con rectángulos sueltos y una media
 * luna fina en la esquina. A tamaño de sidebar pasaba, pero en grande se veía
 * otro logo: el doblez del arte ocupa casi un tercio del cuerpo, tiene la
 * sombra clara del papel levantado y el borde inferior izquierdo es una curva
 * amplia, no una esquina. Ahora cuerpo y estelas son UN solo trazado (en el
 * arte las estelas nacen del cuerpo, no se le pegan) y el doblez es su forma.
 */
const CUERPO =
  "M16.64 4H41.75A4.4 4.4 0 0 1 46.15 8.4V29.5C46.15 30.35 45.8 31.15 45.17 31.8L35.41 41.56C34.05 42.92 32.5 44 30.6 44H27.6C23 44 19.56 40.5 19.56 36V34.8C19.56 33.3 20.35 32.65 20.2 31.6C20.05 30.6 19.2 30.1 17.85 30.1H9.64A2.755 2.755 0 0 1 9.64 24.59H22.22A2.37 2.37 0 0 0 22.22 19.85H4.68A2.68 2.68 0 0 1 4.68 14.49H30.9A2.32 2.32 0 0 0 30.9 9.85H16.64A2.925 2.925 0 0 1 16.64 4Z";

/** El doblez: la esquina del recibo levantándose. */
const DOBLEZ =
  "M46.15 20.6C45.7 24.6 43.5 27.5 40.3 27.7C37.6 27.9 35.3 27.5 33.9 28.5C32.5 29.5 32.24 31.2 32.24 33V37.2C32.24 40.6 31 43 27.85 43.95L30.6 44C32.5 44 34.05 42.92 35.41 41.56L45.17 31.8C45.8 31.15 46.15 30.35 46.15 29.5Z";

/** Sombra del papel bajo el doblez: es lo que hace que la esquina "levante". */
const SOMBRA =
  "M27.4 43.9C26.9 40.2 28.4 36 32.3 34.6L32.24 37.2C32.24 40.6 31 43 27.85 43.95Z";

/**
 * Isotipo BookiPos. Va en SVG y no en PNG a propósito: escala de 20px en el
 * sidebar a 10rem en la portada, se recolorea según el fondo y se anima.
 *
 * `draw` (0→1) controla cuánto asoman las estelas: con 0 solo se ve el cuerpo
 * del recibo y las estelas salen hacia la izquierda a medida que sube. Se hace
 * recortando el grupo con `clip-path: inset()` —no hace falta un id único, así
 * que el componente sigue siendo de servidor—. Con 1 (por defecto) no lleva
 * recorte ninguno.
 *
 * `tone="light"` es la versión del arte original, para fondos oscuros: recibo
 * blanco y doblez orquídea. `tone="brand"` es la de fondos claros: recibo
 * orquídea y doblez en la tinta del wordmark. Esta segunda la usa también el
 * sidebar del panel en modo oscuro, por eso el cuerpo no puede ser oscuro.
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
  // El cuerpo arranca al 36% del ancho del trazado: con t=0 se recorta justo
  // ahí y solo queda el recibo.
  const recorte = t < 1 ? { clipPath: `inset(0 0 0 ${((1 - t) * 36).toFixed(2)}%)` } : undefined;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g style={recorte}>
        <path d={CUERPO} className={light ? "fill-white" : "fill-brand-500"} />
      </g>
      {/* Renglón del recibo. */}
      <rect
        x={28.44}
        y={20}
        width={11.2}
        height={3}
        rx={0.3}
        className={light ? "fill-brand-400" : "fill-brand-950"}
        opacity={light ? 0.3 : 0.32}
      />
      <path d={SOMBRA} className={light ? "fill-brand-200" : "fill-brand-950"} opacity={light ? 0.55 : 0.28} />
      <path d={DOBLEZ} className={light ? "fill-brand-500" : "fill-brand-950"} />
    </svg>
  );
}

/**
 * Isotipo + palabra. Para nav, footer y cualquier uso de tamaño normal.
 *
 * La palabra va en la display (Outfit) y no en la Inter extrabold de antes: el
 * wordmark del arte es una geométrica de peso medio, de "o" redonda, y la
 * extrabold lo convertía en otra marca.
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
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BookiPosMark
        className={cn("h-8 w-8", markClassName)}
        tone={light ? "light" : "brand"}
      />
      <span
        className={cn(
          "font-display text-[1.4rem] font-semibold leading-none tracking-[-0.02em]",
          light ? "text-white" : "text-brand-950",
        )}
      >
        BookiPos
      </span>
    </span>
  );
}
