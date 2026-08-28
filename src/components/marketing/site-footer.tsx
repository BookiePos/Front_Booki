import Link from "next/link";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { APPS } from "@/lib/site";

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { label: "Beneficios", href: "#beneficios" },
      { label: "Módulos", href: "#modulos" },
      { label: "Novedades", href: "#novedades" },
      { label: "Precios", href: "#precios" },
    ],
  },
  {
    title: "Acceso",
    links: [
      { label: "Punto de venta", href: APPS.pos },
      { label: "Panel de operación", href: APPS.erp },
      { label: "Iniciar sesión", href: "/login" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Preguntas frecuentes", href: "#preguntas" },
      { label: "Hablar con ventas", href: "mailto:hola@bookipos.com" },
      { label: "Soporte", href: "mailto:soporte@bookipos.com" },
    ],
  },
];

/**
 * Pie de página.
 *
 * Contrastes medidos (WCAG 2.1) sobre blanco:
 *   · títulos de columna: eran `ink-faint` = 3.49:1 ✗ para 14px negrita
 *     (negrita solo cuenta como "texto grande" a partir de 18.66px). Pasan a
 *     `ink-muted` = 7.65:1 ✓ AAA.
 *   · línea legal y enlaces del pie: mismo cambio, 3.49:1 → 7.65:1 ✓.
 *   · enlaces de columna `ink-soft` = 13.28:1 ✓; hover `brand-700` = 8.15:1 ✓.
 *
 * Los enlaces llevan alto mínimo de 28px (WCAG 2.5.8 pide 24px) para que en
 * móvil no haya que apuntar a una línea de texto de 20px.
 */
export function SiteFooter() {
  return (
    <footer className="relative bg-gradient-to-b from-brand-50/60 to-white">
      {/* Filo de marca: hairline neutra en los extremos que se tiñe de
          orquídea en el centro. Separa el pie sin la barra gris de siempre. */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-hairline via-brand-300 to-hairline"
      />

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Link href="/" aria-label="BookiPos — inicio" className="inline-block">
              <BookiPosLogo />
            </Link>
            <p className="mt-5 max-w-sm text-pretty leading-relaxed text-ink-muted">
              Punto de venta y sistema operacional para negocios en Colombia.
              Restaurante, bar y retail — con la contabilidad al día.
            </p>
          </div>

          {/* Una sola columna por debajo de 416px: a 320px, dos columnas
              parten "Preguntas frecuentes" y "Panel de operación" en dos
              líneas cada una y el pie se lee como un amasijo. */}
          <nav
            aria-label="Pie de página"
            className="grid gap-x-6 gap-y-8 min-[26rem]:grid-cols-2 sm:grid-cols-3"
          >
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-1.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="inline-flex min-h-7 items-center text-[0.95rem] text-ink-soft transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-hairline pt-8 text-sm text-ink-muted sm:mt-14 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BookiPos. Hecho en Colombia.</p>
          <p className="flex flex-wrap gap-x-6 gap-y-1">
            <a
              href="#"
              className="inline-flex min-h-7 items-center transition-colors hover:text-brand-700"
            >
              Términos
            </a>
            <a
              href="#"
              className="inline-flex min-h-7 items-center transition-colors hover:text-brand-700"
            >
              Privacidad
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
