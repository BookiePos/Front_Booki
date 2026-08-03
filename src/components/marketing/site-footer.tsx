import Link from "next/link";
import { GoCheckLogo } from "@/components/marketing/gocheck-logo";
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
      { label: "Hablar con ventas", href: "mailto:hola@gocheck.co" },
      { label: "Soporte", href: "mailto:soporte@gocheck.co" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Link href="/" aria-label="GoCheck — inicio">
              <GoCheckLogo />
            </Link>
            <p className="mt-5 max-w-sm leading-relaxed text-ink-muted">
              Punto de venta y sistema operacional para negocios en Colombia.
              Restaurante, bar y retail — con la contabilidad al día.
            </p>
          </div>

          <nav aria-label="Pie de página" className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-faint">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-[0.95rem] text-ink-soft transition-colors hover:text-brand-700"
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

        <div className="mt-14 flex flex-col gap-4 border-t border-hairline pt-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} GoCheck. Hecho en Colombia.</p>
          <p className="flex gap-6">
            <a href="#" className="transition-colors hover:text-brand-700">
              Términos
            </a>
            <a href="#" className="transition-colors hover:text-brand-700">
              Privacidad
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
