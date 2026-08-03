import { cn } from "@/lib/utils";

/**
 * Isotipo GoCheck: un recibo con la esquina inferior rasgada y un check dentro.
 * El doble sentido es deliberado — "check" es a la vez el visto bueno y la
 * cuenta que se cierra en la mesa.
 *
 * `draw` (0→1) controla cuánto trazo del check está dibujado. Con 1 (valor por
 * defecto) el logo se ve completo, que es lo correcto para usos estáticos como
 * el nav o el footer.
 */
export function GoCheckMark({
  className,
  draw = 1,
  filled = false,
  strokeWidth = 3.25,
}: {
  className?: string;
  draw?: number;
  filled?: boolean;
  strokeWidth?: number;
}) {
  const receipt =
    "M8 11 A6 6 0 0 1 14 5 H34 A6 6 0 0 1 40 11 V43 L36 39.5 L32 43 L28 39.5 L24 43 L20 39.5 L16 43 L12 39.5 L8 43 Z";

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={receipt}
        className={filled ? "fill-brand-700" : "fill-brand-50 stroke-brand-700"}
        strokeWidth={filled ? 0 : strokeWidth * 0.72}
        strokeLinejoin="round"
      />
      <path
        d="M16.5 23.5 L21.75 28.75 L32 17.5"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - Math.min(1, Math.max(0, draw))}
        className={filled ? "stroke-white" : "stroke-brand-700"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Isotipo + palabra. Para nav, footer y cualquier uso de tamaño normal.
 *
 * `tone="light"` es la versión para fondos oscuros: el isotipo pasa a contorno
 * claro y la palabra a blanco/lila, que sobre violeta 950 mantiene contraste
 * de sobra. En claro se usa el relleno violeta sólido.
 */
export function GoCheckLogo({
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
      <GoCheckMark className={cn("h-7 w-7", markClassName)} filled={!light} />
      <span
        className={cn(
          "text-[1.35rem] font-extrabold tracking-[-0.035em] transition-colors duration-300",
          light ? "text-white" : "text-ink",
        )}
      >
        Go
        <span className={light ? "text-brand-300" : "text-brand-700"}>Check</span>
      </span>
    </span>
  );
}
