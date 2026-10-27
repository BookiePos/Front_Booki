import Link from "next/link";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { APPS } from "@/lib/site";
import { SOPORTE } from "@/lib/soporte";

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { label: "Cómo funciona", href: "/#como-funciona" },
      { label: "Precios", href: "/#precios" },
      { label: "Comparativa", href: "/comparativa" },
      { label: "Para contadores", href: "/contadores" },
    ],
  },
  {
    title: "Acceso",
    links: [
      { label: "Crear cuenta", href: "/registro" },
      { label: "Iniciar sesión", href: "/login" },
      { label: "Punto de venta", href: APPS.pos },
      { label: "Panel de operación", href: APPS.erp },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Preguntas frecuentes", href: "/#preguntas" },
      { label: "Hablar con ventas", href: `mailto:${SOPORTE.ventas}` },
      { label: "Soporte", href: `mailto:${SOPORTE.email}` },
      { label: "Estado del servicio", href: "/estado" },
    ],
  },
];

/**
 * Pie de página. Lo comparten la portada y las páginas de lectura
 * (comparativa, contadores, estado), todas claras: va en el gris de la mesa
 * con la raya de 2px de la portada arriba.
 *
 * Contrastes (WCAG 2.1) sobre #e9e9ec: enlaces navy-950 al 85% ≈ 12:1,
 * títulos y línea legal al 65% ≈ 6:1. Alto mínimo de 28px por enlace
 * (2.5.8 pide 24px).
 *
 * Sin "Términos" ni "Privacidad": apuntaban a `#`. Vuelven cuando exista el
 * texto al que llevar.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-navy-950/15 bg-mesa text-navy-950">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Link href="/" aria-label="BookiPos, inicio" className="inline-block">
              <BookiPosLogo />
            </Link>
            <p className="mt-5 max-w-sm text-pretty leading-relaxed text-navy-950/70">
              Punto de venta y sistema operacional para negocios en Colombia.
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
                <h2 className="text-[0.8125rem] font-semibold text-navy-950/65">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-1.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="inline-flex min-h-7 items-center text-[0.95rem] text-navy-950/85 underline-offset-4 transition-colors hover:text-brand-700 hover:underline"
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

        <p className="mt-12 border-t border-navy-950/20 pt-8 text-[0.8125rem] text-navy-950/65 sm:mt-14">
          © {new Date().getFullYear()} BookiPos. Hecho en Colombia.
        </p>
      </div>
    </footer>
  );
}
