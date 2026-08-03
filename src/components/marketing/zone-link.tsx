import { ArrowUpRight } from "lucide-react";

/**
 * Tarjeta-enlace a una zona del producto (Panel / POS). Se usa tras iniciar
 * sesión o registrarse para que el usuario elija a dónde entrar. `onNavigate`
 * permite navegar del lado del cliente (router.push) sin recargar.
 */
export function ZoneLink({
  href,
  onNavigate,
  icon,
  title,
  body,
}: {
  href: string;
  onNavigate: (href: string) => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-hairline bg-white p-5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 group-hover:bg-white">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-muted">{body}</span>
      </span>
      <ArrowUpRight
        className="size-5 text-brand-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden="true"
      />
    </button>
  );
}
